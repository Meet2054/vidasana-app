import React, {useState} from 'react';
import {View, ScrollView, TouchableOpacity, Alert, Modal} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {Ionicons, Feather} from '@expo/vector-icons';
import {supabase} from '@/utils';
import {useQuery} from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import dayjs from 'dayjs';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import {H3, Body, Caption, Loader} from '@/components';
import {IMAGES} from '@/assets/images';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';

export default function ReceiptScreen() {
  const {t} = useTranslation();
  const {back, navigate} = useRouter();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const {id, type} = useLocalSearchParams<{id: string; type?: string}>();

  // Fetch Booking Details with Joins
  const {data: booking, isLoading} = useQuery({
    queryKey: ['booking-receipt', id, type],
    queryFn: async () => {
      // EVENT BOOKING
      if (type === 'event') {
        const {data, error} = await supabase
          .from('event_booking')
          .select(` *, event:events ( *, provider:profile (*)), ticket:event_ticket_types (*), payment:payments (*)`)
          .eq('id', id)
          .single();

        if (error) throw error;

        // Extract location from PostGIS point if available
        const locationData = data.event?.location as any;
        let locationAddress = 'TBA';
        if (locationData?.coordinates) {
          locationAddress = `${locationData.coordinates[1]?.toFixed(4)}, ${locationData.coordinates[0]?.toFixed(4)}`;
        }

        // Normalize structure for UI
        return {
          ...data,
          title: data.event?.title || 'Event',
          subtitle: data.ticket?.name || 'Ticket',
          providerName: data.event?.provider?.name || 'Organizer',
          date: data.event?.start_at,
          price: data.total_price,
          isEvent: true,
          location: locationAddress,
          ticketType: data.ticket?.name,
          quantity: data.quantity || 1,
          status: data.status,
          service_id: null,
          event_id: data.event_id,
        };
      }

      // SERVICE BOOKING (Default)
      const {data, error} = await supabase
        .from('services_booking')
        .select(
          `
            *,
            service:services (
                *,
                provider:profile (*),
                category:categories (*)
            ),
            payment:payments (*)
        `
        )
        .eq('id', id)
        .single();

      if (error) throw error;

      // Normalize structure for UI
      return {
        ...data,
        title: data.service?.title || 'Service',
        subtitle: data.service?.category?.name || 'Wellness',
        providerName: data.service?.provider?.name || 'Provider',
        date: data.appointed,
        price: data.price,
        isEvent: false,
        location: null,
        ticketType: null,
        quantity: null,
        status: data.status,
        service_id: typeof data.service === 'string' ? data.service : (data as any).service?.id || null,
        event_id: null,
      };
    },
    enabled: !!id,
  });

  // Dispute Logic
  const now = dayjs();
  const endTime = booking?.date ? dayjs(booking.date).add(1, 'hour') : now; // Fallback duration 1h if unavailable
  // Note: For services, duration might be variable, but 1h is safe default or we should fetch it.
  // Ideally `booking.date` + duration. For now, assuming standard logic or just using start time if end time missing?
  // User booking uses `item.end_time` or `start_time + duration`.
  // Let's use `booking.date` as start.
  const canDispute = booking && now.isAfter(endTime) && now.isBefore(endTime.add(72, 'hour')) && booking.status !== 'disputed';

  const generateHtml = () => {
    if (!booking) return '';
    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        </head>
        <body style="text-align: center;">
          <h1 style="font-size: 50px; font-family: Helvetica Neue; font-weight: normal;">
            ${t('receipt.headerTitle')}
          </h1>
          <h3 style="color: #666; font-family: Helvetica Neue;">
            ${t('receipt.bookingId')}: ${booking.id.split('-')[0]}
          </h3>
          <p>
            ${booking.isEvent ? t('receipt.event') : t('receipt.service')}: ${booking.title} <br />
            ${booking.isEvent ? t('receipt.organizer') : t('receipt.provider')}: ${booking.providerName} <br />
            ${t('receipt.date')}: ${dayjs(booking.date).format('MMM D, YYYY | h:mm A')} <br />
            ${t('receipt.amount')}: $${booking.price} <br />
            ${t('receipt.status')}: ${booking.payment?.status || t('receipt.unpaid')} <br />
            ${t('receipt.transactionId')}: ${booking.payment?.id || 'N/A'}
          </p>
        </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    try {
      await Print.printAsync({html: generateHtml()});
      setIsMenuVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to print receipt');
    }
  };

  const handleShare = async () => {
    try {
      const {uri} = await Print.printToFileAsync({html: generateHtml()});
      await Sharing.shareAsync(uri, {UTI: '.pdf', mimeType: 'application/pdf'});
      setIsMenuVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  const handleDownload = async () => {
    // On mobile, "Download" is often just "Share/Save to Files"
    handleShare();
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Loader visible />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="relative flex-row items-center justify-between border-b border-gray-100 p-4 pb-3">
        <TouchableOpacity onPress={() => back()} className="rounded-full bg-gray-100 p-2">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <H3 className="text-gray-900">{t('receipt.title')}</H3>
        <TouchableOpacity onPress={() => setIsMenuVisible(!isMenuVisible)} className="rounded-full bg-gray-100 p-2">
          <Feather name="more-horizontal" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu Modal */}
      <Modal visible={isMenuVisible} transparent animationType="fade" onRequestClose={() => setIsMenuVisible(false)}>
        <TouchableOpacity onPress={() => setIsMenuVisible(false)} className="flex-1" activeOpacity={1}>
          <View className="absolute right-4 top-32 w-60 rounded-2xl border border-gray-100 bg-white shadow-xl" style={{elevation: 8}}>
            <TouchableOpacity
              onPress={() => {
                setIsMenuVisible(false);
                handleShare();
              }}
              className={`flex-row items-center p-4 active:bg-gray-50 ${!canDispute && booking?.status !== 'disputed' ? 'rounded-t-2xl' : ''}`}>
              <Feather name="send" size={20} color="#00594f" />
              <Body className="font-nunito-semibold ml-3 text-gray-900">{t('receipt.share')}</Body>
            </TouchableOpacity>
            <View className="mx-4 h-[1px] bg-gray-100" />
            <TouchableOpacity
              onPress={() => {
                setIsMenuVisible(false);
                handleDownload();
              }}
              className="flex-row items-center p-4 active:bg-gray-50">
              <Feather name="download" size={20} color="#00594f" />
              <Body className="font-nunito-semibold ml-3 text-gray-900">{t('receipt.download')}</Body>
            </TouchableOpacity>
            <View className="mx-4 h-[1px] bg-gray-100" />
            <TouchableOpacity
              onPress={() => {
                setIsMenuVisible(false);
                handlePrint();
              }}
              className="flex-row items-center rounded-b-2xl p-4 active:bg-gray-50">
              <Feather name="printer" size={20} color="#00594f" />
              <Body className="font-nunito-semibold ml-3 text-gray-900">{t('receipt.print')}</Body>
            </TouchableOpacity>

            {/* Dispute Options */}
            {canDispute && (
              <>
                <View className="mx-4 h-[1px] bg-gray-100" />
                <TouchableOpacity
                  onPress={() => {
                    setIsMenuVisible(false);
                    navigate(`/(user)/dispute/create?bookingId=${booking?.id}&type=${type}` as any);
                  }}
                  className="flex-row items-center rounded-t-2xl p-4 active:bg-gray-50">
                  <Feather name="alert-circle" size={20} color="#EF4444" />
                  <Body className="font-nunito-semibold ml-3 text-red-500">{t('dispute.createTitle')}</Body>
                </TouchableOpacity>
              </>
            )}

            {booking?.status === 'disputed' && (
              <>
                <View className="mx-4 h-[1px] bg-gray-100" />
                <TouchableOpacity
                  onPress={() => {
                    setIsMenuVisible(false);
                    navigate(`/(user)/dispute/${booking?.id}` as any);
                  }}
                  className="flex-row items-center rounded-t-2xl p-4 active:bg-gray-50">
                  <Feather name="eye" size={20} color="#EF4444" />
                  <Body className="font-nunito-semibold ml-3 text-red-500">{t('dispute.title')}</Body>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        {/* QR Code Section */}
        <View className="mb-8 items-center py-4">
          <QRCode
            size={180}
            logoSize={40}
            // color="#00594f"
            logo={IMAGES.logo}
            backgroundColor="white"
            logoBackgroundColor="white"
            value={`vidasana://receipt/${booking?.id}${type ? `?type=${type}` : ''}`}
          />
          <Body className="mt-4 font-nunito-bold tracking-widest text-gray-400">{booking?.id?.split('-')[0]?.toUpperCase()}</Body>
        </View>

        {/* Details Card */}
        <View className="mb-5 rounded-2xl bg-gray-50 p-5">
          <View className="mb-5 border-b border-gray-200 pb-4">
            <Caption className="mb-1 text-center uppercase tracking-wide text-gray-400">
              {booking?.isEvent ? t('receipt.event') : t('receipt.service')}
            </Caption>
            <H3 className="text-center text-xl font-extrabold text-primary">{booking?.title || 'N/A'}</H3>
            {booking?.isEvent && booking?.ticketType && (
              <Body className="font-nunito-semibold mt-2 text-center text-gray-500">
                {booking.ticketType} × {booking.quantity}
              </Body>
            )}
          </View>

          {/* Date & Time with proper spacing */}
          <View className="mb-3 flex-row justify-between py-2">
            <Body className="text-gray-500">{t('receipt.date')}</Body>
            <Body className="font-nunito-bold text-gray-900">{booking?.date ? dayjs(booking.date).format('MMM D, YYYY') : 'N/A'}</Body>
          </View>

          <View className="mb-3 flex-row justify-between py-2">
            <Body className="text-gray-500">{t('receipt.time')}</Body>
            <Body className="font-nunito-bold text-gray-900">{booking?.date ? dayjs(booking.date).format('h:mm A') : 'N/A'}</Body>
          </View>

          {/* Location for events */}
          {booking?.isEvent && booking?.location && (
            <View className="mb-3 flex-row justify-between py-2">
              <Body className="text-gray-500">{t('receipt.location')}</Body>
              <Body className="max-w-[60%] text-right font-nunito-bold text-gray-900" numberOfLines={2}>
                {booking.location}
              </Body>
            </View>
          )}

          {/* Provider/Organizer */}
          <View className="mt-2 flex-row justify-between border-t border-gray-200 pt-4">
            <Body className="text-gray-500">{booking?.isEvent ? t('receipt.organizer') : t('receipt.provider')}</Body>
            <Body className="font-nunito-bold text-gray-900">{booking?.providerName || 'N/A'}</Body>
          </View>

          {/* View Service/Event Details */}
          <View className="mt-4 border-t border-gray-200 pt-4">
            <TouchableOpacity
              onPress={() => {
                const targetPath = booking?.isEvent
                  ? `/(user)/events/${(booking as any).event_id || (booking as any).event?.id}`
                  : `/(user)/services/${(booking as any).service_id || (booking as any).service?.id}`;
                navigate(targetPath as any);
              }}
              className="flex-row items-center justify-center space-x-2 rounded-xl bg-gray-100 py-3 active:bg-gray-200">
              <Body className="font-nunito-bold text-primary">
                {booking?.isEvent ? t('receipt.viewEventDetails') : t('receipt.viewServiceDetails')}
              </Body>
              <Ionicons name="chevron-forward" size={16} color="#00594f" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment Details Card */}
        <View className="mb-8 rounded-2xl bg-gray-50 p-5">
          <View className="mb-5 flex-row items-center justify-between">
            <Body className="font-nunito-bold text-gray-700">{t('receipt.paymentDetails')}</Body>
            <Ionicons name="card-outline" size={20} color="#00594f" />
          </View>

          <View className="mb-3 flex-row justify-between py-2">
            <Body className="text-gray-500">{t('receipt.amount')}</Body>
            <Body className="font-nunito-extrabold text-lg text-primary">${booking?.price ? Number(booking.price).toFixed(2) : '0.00'}</Body>
          </View>

          <View className="mb-3 flex-row justify-between py-2">
            <Body className="text-gray-500">{t('receipt.paymentMethod')}</Body>
            <Body className="font-nunito-bold text-gray-900">{t('receipt.card')} •••• ••••</Body>
          </View>

          <View className="mb-3 flex-row justify-between py-2">
            <Body className="text-gray-500">{t('receipt.paymentDate')}</Body>
            <Body className="font-nunito-bold text-gray-900">
              {booking?.payment?.created_at ? dayjs(booking.payment.created_at).format('MMM D, YYYY') : 'N/A'}
            </Body>
          </View>

          <View className="mb-3 flex-row items-center justify-between py-2">
            <Body className="text-gray-500">{t('receipt.transactionId')}</Body>
            <TouchableOpacity
              className="flex-row items-center"
              onPress={async () => {
                if (booking?.payment?.id) {
                  await Clipboard.setStringAsync(booking.payment.id);
                  Toast.show({type: 'success', text1: t('receipt.copied'), text2: t('receipt.idCopied')});
                }
              }}>
              <Body className="mr-2 max-w-[140px] font-nunito-bold text-xs text-gray-900" numberOfLines={1}>
                {booking?.payment?.id ? booking.payment.id.split('-')[0].toUpperCase() : 'N/A'}
              </Body>
              {booking?.payment?.id && <Ionicons name="copy-outline" size={16} color="#00594f" />}
            </TouchableOpacity>
          </View>

          <View className="mt-2 flex-row items-center justify-between border-t border-gray-200 pt-4">
            <Body className="text-gray-500">{t('receipt.status')}</Body>
            <View className="rounded-full bg-green-50 px-3 py-1.5">
              <Caption className="font-nunito-bold capitalize text-green-700">{booking?.payment?.status || t('receipt.pending')}</Caption>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
