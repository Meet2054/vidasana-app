import {ActivityIndicator, TouchableOpacity, View, Platform, Linking, Modal, TextInput, KeyboardAvoidingView, ScrollView} from 'react-native';
import {Feather, Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {supabase, formatTime, fetchPaymentSheetParams} from '@/utils';
import {Link, useLocalSearchParams, useRouter} from 'expo-router';
import {useState} from 'react';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useAppStore} from '@/store';
import Toast from 'react-native-toast-message';
import {Avatar, LikeButton, ImageCarousel, H2, H3, Body, Caption, Subtitle} from '@/components';
import {Rating} from 'react-native-ratings';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import {useStripe} from '@stripe/stripe-react-native';
import dayjs from 'dayjs';

export default function UserServiceDetailsScreen() {
  const {id: idParam} = useLocalSearchParams();
  const {user} = useAppStore((s) => s.session!);
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const {back} = useRouter();
  const {t, i18n} = useTranslation();
  const queryClient = useQueryClient();
  const {initPaymentSheet, presentPaymentSheet} = useStripe();

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [ratingInput, setRatingInput] = useState(0);
  const [commentInput, setCommentInput] = useState('');
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isBookingLoading, setBookingLoading] = useState(false);

  const handleBooking = async (date: Date) => {
    setDatePickerVisible(false);
    setBookingLoading(true);
    try {
      // 0. Validate Week Day
      const weekDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const selectedDayIndex = date.getDay();
      const selectedDay = weekDays[selectedDayIndex];

      if (service?.week_day && !service.week_day.includes(selectedDay as any)) {
        Toast.show({
          type: 'error',
          text1: 'Unavailable on this day',
          text2: `Available days: ${service.week_day.map((d: string) => d.toUpperCase()).join(', ')}`,
        });
        setBookingLoading(false);
        return;
      }

      const {paymentIntent, ephemeralKey, customer} = await fetchPaymentSheetParams({id, type: 'service'});

      // Only require paymentIntent if price is greater than 0
      if (service.price > 0 && !paymentIntent) {
        throw new Error('Failed to fetch payment params');
      }

      // 2. Initialize and Present Payment Sheet (Only if not free)
      if (service.price > 0) {
        const {error: initError} = await initPaymentSheet({
          customerId: customer,
          merchantDisplayName: 'VidaSana Wellness',
          paymentIntentClientSecret: paymentIntent!,
          customerEphemeralKeySecret: ephemeralKey,
          defaultBillingDetails: {email: user.email, name: user.user_metadata?.full_name || 'User'},
        });

        if (initError) {
          console.error(initError);
          Toast.show({type: 'error', text1: 'Payment Init Failed', text2: initError.message});
          setBookingLoading(false);
          return;
        }

        const {error: presentError} = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code === 'Canceled') {
            console.log('Payment canceled');
          } else {
            Toast.show({type: 'error', text1: 'Payment Failed', text2: presentError.message});
          }
          setBookingLoading(false);
          return;
        }
      }

      // 3. Success - Create Database Records
      // 4a. Create Payment Record (Required for booking, even if $0)
      const {data: paymentData, error: paymentError} = await supabase
        .from('payments')
        .insert({
          currency: 'usd',
          status: 'succeeded',
          amount: service?.price || 0,
          user: user.id, // Explicitly pass user ID
        })
        .select()
        .single();

      if (paymentError) {
        console.error('Payment record creation failed:', paymentError);
        return Toast.show({type: 'error', text1: 'Database Error', text2: 'Could not record payment'});
      }

      // 4b. Create Booking Record linked to Payment
      const {error: bookingError} = await supabase.from('services_booking').insert({
        service: id,
        status: 'booked',
        price: service?.price || 0,
        payment_id: paymentData.id,
        appointed: date.toISOString(),
      });

      if (bookingError) {
        console.error('Booking creation failed:', bookingError);
        console.log('Stripe Payment Intent:', paymentIntent); // fallback log
        Toast.show({text2: 'Please contact support with ID: ' + paymentIntent});
      } else {
        Toast.show({type: 'success', text1: 'Booking Confirmed!', text2: 'Payment successful'});
        // Navigate to bookings or success screen
        // router.replace('/(user)/bookings'); // Example navigation
      }
    } catch (error: any) {
      console.error(error);
      Toast.show({type: 'error', text1: 'Error', text2: error.message});
    } finally {
      setBookingLoading(false);
    }
  };

  const {
    data: service,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['service', id],
    queryFn: async () => {
      const {data, error} = await supabase.rpc('get_service_by_id', {target_id: id});
      if (error) throw error;
      return (data as any) ?? null;
    },
    enabled: !!id,
  });

  const ratingSummary = {avg_rating: service?.avg_rating ?? 0, count: service?.review_count ?? 0};
  const reviews: any[] = service?.reviews ?? [];

  const toggleBookmarkMutation = useMutation({
    mutationFn: async ({isBookmarked}: {isBookmarked: boolean}) => {
      if (isBookmarked) {
        const {error} = await supabase.from('bookmark').delete().eq('item_id', id).eq('type', 'service').eq('user', user.id);
        if (error) throw error;
      } else {
        const {error} = await supabase.from('bookmark').insert({item_id: id, type: 'service', user: user.id});
        if (error) throw error;
      }
    },
    onMutate: async ({isBookmarked}) => {
      await queryClient.cancelQueries({queryKey: ['service', id]});
      const previousService = queryClient.getQueryData(['service', id]);
      queryClient.setQueryData(['service', id], (old: any) => ({...old, is_bookmarked: !isBookmarked}));
      return {previousService};
    },
    onError: (err, newTodo, context) => {
      if (context?.previousService) {
        queryClient.setQueryData(['service', id], context.previousService);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: ['service', id]});
      queryClient.invalidateQueries({queryKey: ['liked-items']});
    },
  });

  // Submit Review Mutation
  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      if (ratingInput === 0) {
        throw new Error('Please select a rating (at least 1 star)');
      }
      const {error} = await supabase
        .from('service_reviews')
        .upsert({service_id: id, user_id: user.id, rating: ratingInput, comment: commentInput}, {onConflict: 'service_id, user_id'});
      if (error) throw error;
    },
    onSuccess: () => {
      setReviewModalVisible(false);
      Toast.show({type: 'success', text1: 'Review submitted'});
      queryClient.invalidateQueries({queryKey: ['service', id]});
    },
    onError: (err: any) => {
      console.log('🚀 ~ UserServiceDetailsScreen ~ err:', err);
      Toast.show({type: 'error', text1: 'Failed to submit review', text2: err.message});
    },
  });

  const title = (service as any)?.title || 'Untitled Service';
  const description = (service as any)?.description || 'No description available';

  // Fetch User's Bookings for this Service
  const {data: userBookings} = useQuery({
    queryKey: ['user_service_bookings', id, user.id],
    queryFn: async () => {
      const {data, error} = await supabase.from('services_booking').select('*').eq('service', id).eq('user', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!user,
  });

  const canReview = userBookings?.some((b) => {
    const isCompleted = b.status === 'completed';
    const appointedTime = dayjs(b.appointed);
    const isPast = appointedTime.add(1, 'hour').isBefore(dayjs());
    return (isCompleted || (b.status === 'booked' && isPast)) && b.status !== 'cancel';
  });

  // Capacity Logic
  const availableSeats = (() => {
    if (!service || service.capacity === null) return null;
    const total = service.capacity;
    const booked = service.booked_count || 0;
    return Math.max(0, total - booked);
  })();

  // Format Available Days
  const availableDaysText = (() => {
    if (!service || !service.week_day) return 'All Days';
    if (service.week_day.length === 7) return 'Every Day';

    const orderedDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    // Sort days
    const sortedDays = service.week_day.sort((a: string, b: string) => orderedDays.indexOf(a) - orderedDays.indexOf(b));

    return sortedDays.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
  })();

  const imageUrl =
    service?.images && service.images.length > 0 ? supabase.storage.from('images').getPublicUrl(service.images[0]).data.publicUrl : null;

  const isBookmarked = service?.is_bookmarked || false;

  const openAddressOnMap = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ios: 'maps:0,0?q=', android: 'geo:0,0?q='});
    const latLng = `${lat},${lng}`;
    const url = Platform.select({ios: `${scheme}${label}@${latLng}`, android: `${scheme}${latLng}(${label})`});
    if (url) Linking.openURL(url).catch((err) => Toast.show({type: 'error', text1: 'Error opening map', text2: err.message}));
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (!service || error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Body className="text-center text-gray-500">Service not found or an error occurred.</Body>
        <Caption className="mt-2 text-center text-gray-400">{(error as any)?.message || 'Please check the service ID or try again.'}</Caption>
        <TouchableOpacity onPress={() => back()} className="mt-4 rounded-full bg-gray-100 px-6 py-3">
          <Body>Go Back</Body>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView className="flex-1 bg-white" contentContainerStyle={{paddingBottom: 100}} showsVerticalScrollIndicator={false}>
        {/* 1. Header Images (Carousel) */}
        <View className="relative w-full bg-gray-200">
          <ImageCarousel images={service?.images} aspectRatio="square" />

          {/* Back Button */}
          <TouchableOpacity onPress={() => back()} className="absolute left-4 top-4 z-10 rounded-full bg-white/30 p-2 backdrop-blur-md">
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>

          {/* Like Button */}
          <View className="absolute right-4 top-4 z-10">
            <LikeButton
              isLiked={isBookmarked}
              onToggle={() => {
                if (!toggleBookmarkMutation.isPending) {
                  toggleBookmarkMutation.mutate({isBookmarked});
                }
              }}
              isLoading={toggleBookmarkMutation.isPending}
            />
          </View>
        </View>

        {/* 2. Main Content (Sheet Effect - Less padding for mobile) */}
        <View className="bg-white px-6 pb-6 pt-5 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          {/* 2a. Title Section (Centered) */}
          <View className="mb-2 items-center">
            <H2 align="center" className="mb-2 font-nunito-extra-bold text-[24px] leading-8 text-gray-900">
              {title}
            </H2>
          </View>

          <View className="mb-5 h-[1px] w-full bg-gray-100" />

          {/* 2b. Hosted By Section */}
          <View className="mb-5">
            <H2 className="mb-3 text-[18px] text-gray-900">Hosted by</H2>
            <Link href={`/(user)/provider/${(service.provider as any).id}`}>
              <View className="flex-row items-center gap-3">
                <Avatar size={44} name={(service.provider as any)?.name} uri={(service.provider as any)?.image} />
                <View>
                  <H3 className="font-nunito-bold text-[16px] capitalize text-gray-900">{(service.provider as any)?.name}</H3>
                  <Body className="text-primary">View profile</Body>
                </View>
              </View>
            </Link>
          </View>

          <View className="mb-5 h-[1px] w-full bg-gray-100" />

          {/* 2c. About Section */}
          <View className="mb-5">
            <H2 className="mb-3 text-[18px] text-gray-900">About this experience</H2>
            <Body className="text-[15px] leading-6 text-gray-600">
              {description || 'Join us for a transformative experience. Unlock your potential in a supportive environment.'}
            </Body>
          </View>

          <View className="mb-5 h-[1px] w-full bg-gray-100" />

          {/* 2d. Event Details Section */}
          <View className="mb-2">
            <H2 className="mb-4 text-[18px] text-gray-900">Service Details</H2>

            {/* Availability (Weeks) */}
            <View className="mb-4 flex-row gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0F0]">
                <Ionicons name="calendar" size={20} color="#E9967A" />
              </View>
              <View className="flex-1 justify-center">
                <Subtitle className="font-nunito-bold  tracking-widest text-gray-500">AVAILABILITY</Subtitle>
                <H3 className="text-[15px] capitalize text-gray-900">{availableDaysText}</H3>
              </View>
            </View>

            {/* Location */}
            <View className="mb-4 flex-row gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0F0]">
                <Ionicons name="location" size={20} color="#E9967A" />
              </View>
              <View className="flex-1 justify-center">
                <Subtitle className="font-nunito-bold  tracking-widest text-gray-500">LOCATION</Subtitle>
                <H3 className="text-[15px] leading-5 text-gray-900">{service.address}</H3>
                <TouchableOpacity onPress={() => openAddressOnMap(service.lat || 0, service.lng || 0, title || '')}>
                  <Body className="font-nunito-bold text-[13px] text-primary">View on map</Body>
                </TouchableOpacity>
              </View>
            </View>

            {/* Capacity */}
            <View className="mb-4 flex-row gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
                <Ionicons name="people" size={20} color="#6B7280" />
              </View>
              <View className="flex-1 justify-center">
                <Subtitle className="font-nunito-bold  tracking-widest text-gray-500">CAPACITY</Subtitle>
                <H3 className="text-[15px] text-gray-900">{service.capacity || '0'} participants</H3>
              </View>
            </View>

            {/* Duration (Start - End Time) */}
            <View className="flex-row gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
                <Ionicons name="time-outline" size={20} color="#6B7280" />
              </View>
              <View className="flex-1 justify-center">
                <Subtitle className="font-nunito-bold  tracking-widest text-gray-500">Time</Subtitle>
                <H3 className="text-[15px] text-gray-900">
                  {service.start_at && service.end_at ? `${formatTime(service.start_at)} - ${formatTime(service.end_at)}` : 'N/A'}
                </H3>
              </View>
            </View>
          </View>

          <View className="mb-5 h-[1px] w-full bg-gray-100" />

          {/* 2e. Reviews Section */}
          <View className="mb-6">
            <View className="mb-4 flex-row items-center justify-between">
              <H2 className="text-[18px] text-gray-900">Reviews</H2>
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Body className="font-nunito-bold text-[15px] text-gray-900">{ratingSummary?.avg_rating?.toFixed(1) || '0.0'}</Body>
                <Caption className="text-gray-500">({ratingSummary?.count || 0})</Caption>
              </View>
            </View>

            {/* List of Reviews */}
            {reviews && reviews.length > 0 ? (
              reviews.map((review: any) => (
                <View key={review.id} className="mb-4 bg-transparent">
                  <View className="mb-2 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <Avatar size={36} name={review.user_name} uri={review.user_image} />
                      <View>
                        <Body className="font-nunito-bold text-[14px] text-gray-900">{review.user_name}</Body>
                        <View className="flex-row items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Ionicons
                              key={i}
                              size={10}
                              name={i < review.rating ? 'star' : 'star-outline'}
                              color={i < review.rating ? '#F59E0B' : '#D1D5DB'}
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                    <Caption className="text-gray-400">{review.created_at ? dayjs(review.created_at).format('DD MMM YYYY') : ''}</Caption>
                  </View>
                  <Body className="pl-[48px] text-[14px] leading-5 text-gray-600">{review.comment}</Body>
                </View>
              ))
            ) : (
              <View className="items-center justify-center py-4">
                <Body className="italic text-gray-500">No reviews yet. Be the first!</Body>
              </View>
            )}

            {/* Write Review Button - Gated */}
            {(() => {
              // Fetch user bookings for this service (Optimized: Check if any valid booking exists)
              // We'll use a specific query for this check to avoid fetching ALL bookings if not needed,
              // but for now, let's just use the logic we planned.
              // Since we can't easily hook a new useQuery inside this callback, we need to move the query up top.
              // Logic placeholder: See the changes in the upper part of the file for the query.
              return canReview ? (
                <TouchableOpacity
                  onPress={() => setReviewModalVisible(true)}
                  className="mt-2 flex-row items-center justify-center rounded-xl bg-gray-50 py-3 active:bg-gray-100">
                  <Ionicons name="create-outline" size={18} color="#4B5563" />
                  <Body className="ml-2 font-nunito-bold text-gray-700">Write a Review</Body>
                </TouchableOpacity>
              ) : null;
            })()}
          </View>
        </View>
      </ScrollView>

      {/* 3. Sticky Footer */}
      <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between rounded-t-[32px] border-t border-gray-100 bg-white p-5 px-6 pb-8 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.08)]">
        <View>
          <H2 className="font-nunito-bold text-[24px] text-gray-900">${service.price?.toFixed(2) || '0.00'}</H2>
          <Caption className="text-gray-400">per person</Caption>
        </View>

        <Link href={`/(user)/booking/${id}`} asChild>
          <TouchableOpacity className="rounded-full bg-primary px-10 py-4 shadow active:opacity-90" disabled={!service.active}>
            <Body className="font-nunito-bold text-[17px] text-white">{service.active ? 'Reserve' : 'Unavailable'}</Body>
          </TouchableOpacity>
        </Link>
      </View>

      {/* Modals (Keep existing) */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleBooking}
        onCancel={() => setDatePickerVisible(false)}
        minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
        maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
      />

      {/* Review Modal */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-3xl bg-white p-6 pb-12">
            <View className="mb-6 flex-row items-center justify-between">
              <H3>Write a Review</H3>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Feather name="x" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <View className="mb-6 items-center">
              <Rating
                type="star"
                ratingCount={5}
                imageSize={40}
                startingValue={ratingInput}
                onFinishRating={setRatingInput}
                style={{paddingVertical: 10}}
              />
            </View>

            <Body className="mb-2 font-semibold text-gray-700">Comment</Body>
            <TextInput
              className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-900"
              multiline
              numberOfLines={4}
              placeholder="Share your experience..."
              value={commentInput}
              onChangeText={setCommentInput}
              style={{minHeight: 100, textAlignVertical: 'top'}}
            />

            <TouchableOpacity
              onPress={() => submitReviewMutation.mutate()}
              disabled={submitReviewMutation.isPending}
              className={`items-center rounded-xl py-4 ${submitReviewMutation.isPending ? 'bg-gray-400' : 'bg-primary'}`}>
              {submitReviewMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Body className="font-nunito-bold text-lg text-white">Submit Review</Body>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
