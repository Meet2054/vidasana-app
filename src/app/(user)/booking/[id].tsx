import dayjs from 'dayjs';
import {supabase, fetchPaymentSheetParams} from '@/utils';
import {Ionicons} from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {useQuery} from '@tanstack/react-query';
import React, {useState} from 'react';
import {useAppStore} from '@/store';
import {useStripe} from '@stripe/stripe-react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {View, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView} from 'react-native';
import {H3, Body, Loader, Caption} from '@/components';

dayjs.extend(customParseFormat);

export default function BookingScreen() {
  const {user} = useAppStore((s) => s.session!);
  const {id} = useLocalSearchParams<{id: string}>();
  const router = useRouter();
  const {initPaymentSheet, presentPaymentSheet} = useStripe();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(dayjs());

  // Fetch Service Details
  const {data: service, isLoading: isServiceLoading} = useQuery({
    queryKey: ['service', id],
    queryFn: async () => {
      const {data, error} = await supabase.rpc('get_service_by_id', {target_id: id});
      if (error) throw error;
      return (data as any) ?? null;
    },
    enabled: !!id,
  });

  // Calendar Logic
  const calendarDays = (() => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startDayOfWeek = startOfMonth.day(); // 0 (Sun) to 6 (Sat)
    const days = [];

    // Fill previous month days (empty placeholders or disabled)
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({date: startOfMonth.subtract(startDayOfWeek - i, 'day'), isCurrentMonth: false});
    }

    // Fill current month days
    for (let i = 1; i <= endOfMonth.date(); i++) {
      days.push({date: startOfMonth.date(i), isCurrentMonth: true});
    }

    return days;
  })();

  const canSelectDate = (date: dayjs.Dayjs) => {
    const today = dayjs();
    const maxDate = today.add(7, 'day'); // Next 7 days constraint

    // Check if date is within range
    const isInRange = date.isAfter(today, 'day') && date.isBefore(maxDate.add(1, 'day'), 'day');
    if (!isInRange) return false;

    // Check if weekday is active for this service
    if (service?.week_day) {
      // Map dayjs day() (0=Sun, 1=Mon...) to Supabase Enum ('sun', 'mon'...)
      const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dayName = daysMap[date.day()];
      if (!service.week_day.includes(dayName as any)) return false;
    }

    return true;
  };

  // Fetch Existing Bookings for Selected Date
  const {data: existingBookings} = useQuery({
    enabled: !!id && !!selectedDate,
    queryKey: ['bookings', id, selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const startOfDay = dayjs(selectedDate).startOf('day').toISOString();
      const endOfDay = dayjs(selectedDate).endOf('day').toISOString();

      const {data, error} = await supabase
        .from('services_booking')
        .select('appointed')
        .eq('service', id)
        .neq('status', 'cancel') // Exclude cancelled bookings
        .gte('appointed', startOfDay)
        .lte('appointed', endOfDay);

      if (error) throw error;
      return data.map((b) => dayjs(b.appointed).format('h:mm A'));
    },
  });

  // Generate Time Slots based on start_at/end_at
  const timeSlots = (() => {
    if (!selectedDate || !service || !service.start_at || !service.end_at) return [];

    // Default duration 60 mins since not in schema
    const DURATION_MINUTES = 60;

    const slots = [];
    // Parse times (assuming HH:mm:ss format)
    let current = dayjs(`2000-01-01 ${service.start_at}`);
    const end = dayjs(`2000-01-01 ${service.end_at}`);

    while (current.isBefore(end)) {
      const timeString = current.format('h:mm A');
      // valid if NOT in existingBookings
      if (!existingBookings?.includes(timeString)) {
        slots.push(timeString);
      }
      current = current.add(DURATION_MINUTES, 'minute');
    }
    return slots;
  })();

  const handlePayment = async () => {
    if (!service || !selectedDate || !selectedTime)
      return Toast.show({type: 'error', text1: 'Missing Information', text2: 'Please select a date and time.'});

    setIsProcessing(true);
    try {
      if (!user) throw new Error('Not authenticated');

      // Check if price is greater than 0
      if ((service.price || 0) > 0) {
        // 1. Fetch Payment Params
        const {paymentIntent, customer, ephemeralKey, publishableKey} = await fetchPaymentSheetParams({
          id: service.id,
          type: 'service',
        });

        if (!paymentIntent) throw new Error('Failed to fetch payment params');

        // 2. Initialize Payment Sheet
        const {error: initError} = await initPaymentSheet({
          merchantDisplayName: 'VidaSana Wellness',
          customerId: customer,
          customerEphemeralKeySecret: ephemeralKey,
          paymentIntentClientSecret: paymentIntent,
          allowsDelayedPaymentMethods: true,
          defaultBillingDetails: {name: user.email},
        });

        if (initError) throw initError;

        // 3. Present Payment Sheet
        const {error: paymentError} = await presentPaymentSheet();

        if (paymentError) {
          if (paymentError.code === 'Canceled') {
            // User cancelled, do nothing
            return;
          } else {
            Toast.show({type: 'error', text1: 'Payment Failed', text2: paymentError.message});
            return;
          }
        } else {
          // Success - Create Booking with Payment
          await createBooking(paymentIntent);
        }
      } else {
        // Free Service - Bypass Payment
        await createBooking(null);
      }
    } catch (error: any) {
      console.error(error);
      Toast.show({type: 'error', text1: 'Error', text2: error.message});
    } finally {
      setIsProcessing(false);
    }
  };

  const createBooking = async (paymentIntentId: string | null) => {
    try {
      let paymentId = null;

      // 1. Create Payment Record (only if paid)
      if (paymentIntentId) {
        const {data: paymentData, error: paymentError} = await supabase
          .from('payments')
          .insert({currency: 'usd', status: 'succeeded', amount: service?.price || 0})
          .select()
          .single();

        if (paymentError) throw paymentError;
        paymentId = paymentData.id;
      }

      // 2. Format Appointment Date (Date + Time) robustly
      const datePart = dayjs(selectedDate); // The date selected

      // Parse "4:30 PM" manually to avoid plugin issues
      // Format is "h:mm A" -> ["4", "30", "PM"]
      if (!selectedTime) return Toast.show({type: 'error', text1: 'Please select a time'});

      const [timeStr, period] = selectedTime.split(' ');
      const [hoursStr, minutesStr] = timeStr.split(':');

      let hour = parseInt(hoursStr, 10);
      const minute = parseInt(minutesStr, 10);

      if (period === 'PM' && hour !== 12) {
        hour += 12;
      } else if (period === 'AM' && hour === 12) {
        hour = 0;
      }

      const appointmentDate = datePart
        .hour(hour)
        .minute(minute)
        .startOf('minute') // reset seconds/ms
        .toISOString();

      const {data: bookingData, error: bookingError} = await supabase
        .from('services_booking')
        .insert({service: id, status: 'booked', payment_id: paymentId, price: service?.price || 0, appointed: appointmentDate})
        .select()
        .single();

      if (bookingError) throw bookingError;

      Toast.show({type: 'success', text1: 'Booking Confirmed!', text2: 'Processing receipt...'});
      // Navigate to E-Receipt instead of bookings list
      router.replace(`/(user)/receipt/${bookingData.id}`);
    } catch (err: any) {
      console.error('Booking creation error:', err);
      Toast.show({type: 'error', text1: 'Booking Failed', text2: 'Payment successful, but booking failed. Support ID: ' + paymentIntentId});
    }
  };

  if (isServiceLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Loader visible />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center p-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 rounded-full bg-gray-100 p-2">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <H3>Booking Details</H3>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Service Info Summary */}
        <View className="mb-6 rounded-2xl bg-gray-50 p-4">
          <Body className="font-nunito-bold text-lg text-gray-900">{(service as any)?.title || 'Service'}</Body>
          <Body className="text-gray-500">{(service as any)?.provider?.name || 'Provider'}</Body>
          {(service as any)?.address && <Caption className="mt-1 text-gray-400">{(service as any).address}</Caption>}
        </View>

        {/* Custom Full Month Calendar */}
        <H3 className="mb-3">Select Date</H3>
        <View className="mb-6 rounded-3xl bg-primary/5 p-4">
          {/* Month Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <Body className="font-nunito-bold text-lg text-gray-900">{currentMonth.format('MMMM YYYY')}</Body>
            <View className="flex-row gap-4">
              <TouchableOpacity onPress={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}>
                <Ionicons name="chevron-back" size={24} color="#00594f" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCurrentMonth(currentMonth.add(1, 'month'))}>
                <Ionicons name="chevron-forward" size={24} color="#00594f" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Days Header */}
          <View className="mb-2 flex-row justify-between">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <Body key={day} className="w-[13.5%] text-center font-semibold text-gray-500">
                {day}
              </Body>
            ))}
          </View>

          {/* Days Grid */}
          <View className="flex-row flex-wrap">
            {calendarDays.map((item, index) => {
              const isSelected = selectedDate === item.date.format('YYYY-MM-DD');
              const isSelectable = canSelectDate(item.date);

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => isSelectable && setSelectedDate(item.date.format('YYYY-MM-DD'))}
                  disabled={!isSelectable}
                  className={`mb-2 h-9 w-[13.5%] items-center justify-center rounded-full  
                                ${isSelected ? 'bg-primary' : ''}`}>
                  <Body
                    className={`${isSelectable ? 'font-nunito-bold' : 'font-medium'}
                                ${
                                  isSelected
                                    ? 'text-white'
                                    : isSelectable
                                      ? 'text-primary'
                                      : item.date.isAfter(dayjs(), 'day')
                                        ? 'text-gray-900'
                                        : 'text-gray-300'
                                }
                                ${!item.isCurrentMonth ? 'opacity-0' : ''} 
                            `}>
                    {item.date.format('D')}
                  </Body>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Time Slots */}
        <H3 className="mb-3">Choose Start Time</H3>
        <View className="mb-8 flex-row flex-wrap gap-3">
          {!selectedDate ? (
            <Body className="italic text-gray-500">Please select a date above to see available times.</Body>
          ) : timeSlots.length === 0 ? (
            <Body className="text-gray-500">No slots available for this date.</Body>
          ) : (
            timeSlots.map((time, index) => {
              const isSelected = selectedTime === time;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedTime(time)}
                  className={`rounded-full border px-4 py-2 ${isSelected ? 'border-primary bg-primary' : 'border-primary bg-white'}`}>
                  <Body className={`font-nunito-bold ${isSelected ? 'text-white' : 'text-primary'}`}>{time}</Body>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="border-t border-gray-100 p-4">
        <TouchableOpacity
          onPress={handlePayment}
          disabled={isProcessing || !selectedDate || !selectedTime}
          className={`w-full items-center rounded-2xl py-4 ${isProcessing || !selectedDate || !selectedTime ? 'bg-gray-300' : 'bg-primary'}`}>
          {isProcessing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Body className="font-nunito-bold text-lg text-white">Continue - ${service?.price || 0}</Body>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
