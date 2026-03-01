import {Feather, Ionicons} from '@expo/vector-icons';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
  Platform,
  Linking,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import dayjs from 'dayjs';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {useAppStore} from '@/store';
import {Rating} from 'react-native-ratings';
import Toast from 'react-native-toast-message';
import {useEffect, useState} from 'react';
import {useStripe} from '@stripe/stripe-react-native';
import {supabase, fetchPaymentSheetParams} from '@/utils';
import {LikeButton, ImageCarousel, H2, H3, Body, Caption} from '@/components';

export default function UserEventDetailsScreen() {
  const {id: idParam} = useLocalSearchParams();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const router = useRouter();
  const {t, i18n} = useTranslation();
  const {user} = useAppStore((s) => s.session!);
  const queryClient = useQueryClient();

  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [isBooking, setIsBooking] = useState(false);
  const {initPaymentSheet, presentPaymentSheet} = useStripe();

  // Reset quantity when ticket changes
  useEffect(() => {
    setQuantity(1);
  }, [selectedTicket]);

  const incrementQuantity = () => {
    if (!selectedTicket) return;

    // Check available capacity
    const bookedCount = ticketBookings?.[selectedTicket.id] || 0;
    const availableTickets = selectedTicket.capacity - bookedCount;

    if (quantity >= availableTickets) {
      Toast.show({type: 'info', text1: 'Maximum capacity reached', text2: `Only ${availableTickets} tickets available`});
      return;
    }

    setQuantity((prev) => prev + 1);
  };

  const decrementQuantity = () => {
    if (quantity > 1) setQuantity((prev) => prev - 1);
  };

  // Handle Booking
  const handleBookEvent = async () => {
    if (!selectedTicket || isBooking) {
      if (!selectedTicket) Toast.show({type: 'error', text1: 'Please select a ticket'});
      return;
    }

    setIsBooking(true);
    try {
      // 1. Fetch Payment Params
      const {paymentIntent, customer, ephemeralKey} = await fetchPaymentSheetParams({
        id: id,
        type: 'event',
        ticketId: selectedTicket.id,
      });

      if (!paymentIntent) throw new Error('Failed to fetch payment params');

      // 2. Initialize Payment Sheet
      const {error: initError} = await initPaymentSheet({
        merchantDisplayName: 'VidaSana Wellness',
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        defaultBillingDetails: {
          name: user.user_metadata?.full_name,
          email: user.email,
        },
      });

      if (initError) throw initError;

      // 3. Present Payment Sheet
      const {error: paymentError} = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code === 'Canceled') {
          // User canceled, do nothing
          return;
        }
        throw paymentError;
      }

      // 4. Create Payment Record (Required for Booking)
      const {data: paymentData, error: paymentRecordError} = await supabase
        .from('payments')
        .insert({
          amount: selectedTicket.price * quantity,
          status: 'succeeded',
          currency: 'usd',
        })
        .select()
        .single();

      if (paymentRecordError) {
        console.error('Payment Record Creation Error:', paymentRecordError);
        // If payment succeeded but record creation failed, we might want to alert support or handle differently.
        // For now, throwing to show error.
        throw new Error('Payment recorded failed, please contact support');
      }

      // 5. Create Booking Record
      const {data: bookingData, error: bookingError} = await supabase
        .from('event_booking')
        .insert({
          event_id: id,
          ticket_type_id: selectedTicket.id,
          payment_id: paymentData.id,
          unit_price: selectedTicket.price,
          total_price: selectedTicket.price * quantity,
          quantity: quantity,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;
      if (!bookingData) throw new Error('Booking creation failed');

      Toast.show({type: 'success', text1: 'Booking Confirmed!', text2: 'Processing receipt...'});
      router.replace(`/(user)/receipt/${bookingData.id}?type=event`);
      // Navigate to Home or Stay?
      // router.replace('/(user)/bookings'); // Optional
    } catch (err: any) {
      console.error('Event Booking Error:', err);
      Toast.show({type: 'error', text1: 'Booking Failed', text2: err.message});
    } finally {
      setIsBooking(false);
    }
  };

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [ratingInput, setRatingInput] = useState(0);
  const [commentInput, setCommentInput] = useState('');

  const {
    data: event,
    isLoading,
    refetch,
    isRefetching,
    error,
    isError,
  } = useQuery({
    queryKey: ['event', id, i18n.language],
    queryFn: async () => {
      console.log('[EventDetails] Fetching event with ID:', id);
      const {data, error} = await supabase.from('events').select('*, event_ticket_types(*), categories(*)').eq('id', id).single();

      if (error) {
        console.error('Fetch Event Error:', error);
        throw error;
      }

      // Check if liked
      const {count} = await supabase
        .from('bookmark')
        .select('*', {count: 'exact', head: true})
        .eq('item_id', id)
        .eq('type', 'event')
        .eq('user', user.id);

      return {
        ...data,
        lat: (data as any).location?.coordinates ? (data as any).location.coordinates[1] : null,
        lng: (data as any).location?.coordinates ? (data as any).location.coordinates[0] : null,
        is_liked: count ? count > 0 : false,
      };
    },
    enabled: !!id,
  });

  // Fetch Rating Summary
  const {data: ratingSummary} = useQuery({
    queryKey: ['event_rating_summary', id],
    queryFn: async () => {
      const {data, error} = await supabase.rpc('get_event_rating_summary', {target_event_id: id});
      if (error) throw error;
      return data && data.length > 0 ? data[0] : {avg_rating: 0, count: 0};
    },
    enabled: !!id,
  });

  // Fetch Reviews
  const {data: reviews} = useQuery({
    queryKey: ['event_reviews', id],
    queryFn: async () => {
      const {data, error} = await supabase.rpc('get_event_reviews', {target_event_id: id});
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch Ticket Bookings Count
  const {data: ticketBookings} = useQuery({
    enabled: !!id,
    queryKey: ['event_ticket_bookings', id],
    queryFn: async () => {
      const {data, error} = await supabase.from('event_booking').select('ticket_type_id, quantity').eq('event_id', id);

      if (error) throw error;

      // Aggregate bookings by ticket type
      const bookingMap: Record<string, number> = {};
      data?.forEach((booking: any) => {
        const ticketId = booking.ticket_type_id;
        bookingMap[ticketId] = (bookingMap[ticketId] || 0) + (booking.quantity || 0);
      });

      return bookingMap;
    },
  });

  // Fetch User's Bookings for this Event
  const {data: userEventBookings} = useQuery({
    queryKey: ['user_event_bookings', id, user.id],
    queryFn: async () => {
      const {data, error} = await supabase.from('event_booking').select('*').eq('event_id', id).eq('user', user.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!user,
  });

  const canReview = userEventBookings?.some((b: any) => {
    const isCompleted = b.status === 'completed';
    // For events, we check if the event end time has passed
    const eventEndTime = event?.end_at ? dayjs(event.end_at) : dayjs().add(1, 'year');
    const isPast = eventEndTime.isBefore(dayjs());
    return (isCompleted || (b.status === 'booked' && isPast)) && b.status !== 'cancelled';
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async ({isLiked}: {isLiked: boolean}) => {
      if (isLiked) {
        const {error} = await supabase.from('bookmark').delete().eq('item_id', id).eq('type', 'event').eq('user', user.id);
        if (error) throw error;
      } else {
        const {error} = await supabase.from('bookmark').insert({item_id: id, type: 'event', user: user.id});
        if (error) throw error;
      }
    },
    onMutate: async ({isLiked}) => {
      await queryClient.cancelQueries({queryKey: ['event', id, i18n.language]});
      const previousEvent = queryClient.getQueryData(['event', id, i18n.language]);
      queryClient.setQueryData(['event', id, i18n.language], (old: any) => ({...old, is_liked: !isLiked}));
      return {previousEvent};
    },
    onError: (err, variables, context) => {
      if (context?.previousEvent) {
        queryClient.setQueryData(['event', id, i18n.language], context.previousEvent);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: ['event', id, i18n.language]});
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
        .from('event_reviews')
        .upsert({event_id: id, user_id: user.id, rating: ratingInput, comment: commentInput}, {onConflict: 'event_id, user_id'});
      if (error) throw error;
    },
    onSuccess: () => {
      setReviewModalVisible(false);
      Toast.show({type: 'success', text1: 'Review submitted'});
      queryClient.invalidateQueries({queryKey: ['event_reviews', id]});
      queryClient.invalidateQueries({queryKey: ['event_rating_summary', id]});
    },
    onError: (err: any) => {
      console.log('🚀 ~ UserEventDetailsScreen ~ err:', err);
      Toast.show({type: 'error', text1: 'Failed to submit review', text2: err.message});
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#00594f" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Body className="font-nunito text-red-500">Error loading event</Body>
        <Caption className="text-gray-500">{(error as any)?.message}</Caption>
        <TouchableOpacity onPress={() => refetch()} className="mt-4 rounded-lg bg-primary px-4 py-2">
          <Body className="text-white">Retry</Body>
        </TouchableOpacity>
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Body className="font-nunito text-gray-500">Event not found</Body>
      </View>
    );
  }

  const imageUrl = event.images && event.images.length > 0 ? supabase.storage.from('images').getPublicUrl(event.images[0]).data.publicUrl : null;

  const openAddressOnMap = () => {
    if (!event.lat || !event.lng) return;
    const label = event.title;
    const url = Platform.select({ios: `maps:0,0?q=${label}@${event.lat},${event.lng}`, android: `geo:0,0?q=${event.lat},${event.lng}(${label})`});
    if (url) Linking.openURL(url);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView
        className="mb-28 flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#00594f" />}>
        {/* Header Image Carousel */}
        <View className="relative aspect-square w-full bg-gray-200">
          <ImageCarousel images={event?.images} aspectRatio="square" />

          {/* Back Button */}
          <TouchableOpacity onPress={() => router.back()} className="absolute left-4 top-4 rounded-full bg-black/30 p-2 backdrop-blur-md">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          {/* Like Button */}
          <View className="absolute right-4 top-4">
            <LikeButton
              isLiked={event?.is_liked || false}
              onToggle={() => {
                if (!toggleLikeMutation.isPending) {
                  toggleLikeMutation.mutate({isLiked: event?.is_liked || false});
                }
              }}
              isLoading={toggleLikeMutation.isPending}
            />
          </View>
        </View>

        {/* Content */}
        <View className="p-5 pb-10">
          {/* Title & Rating */}
          <View className="mb-4">
            {event.categories && (
              <View className="mb-2 self-start rounded-full bg-primary/10 px-3 py-1">
                <Caption className="font-nunito-bold text-xs text-primary">{event.categories.name}</Caption>
              </View>
            )}
            <H2 className="mb-1 font-nunito-bold text-2xl text-gray-900">{event.title}</H2>

            <View className="flex-row items-center gap-1">
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Body className="font-nunito-bold text-gray-900">{ratingSummary?.avg_rating?.toFixed(1) || '0.0'}</Body>
              <Body className="font-nunito text-gray-500">({ratingSummary?.count || 0} reviews)</Body>
            </View>
          </View>

          {/* Date & Time */}
          <View className="mb-6 rounded-xl bg-gray-50 p-4">
            <View className="mb-3 flex-row items-center">
              <View className="mr-3 rounded-full bg-primary/10 p-2">
                <Feather name="calendar" size={20} color="#00594f" />
              </View>
              <View>
                <Caption className="font-nunito text-xs text-gray-500">{t('events.date')}</Caption>
                <Body className="font-nunito-bold text-gray-900">
                  {new Date(event.start_at).toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                </Body>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="mr-3 rounded-full bg-primary/10 p-2">
                <Feather name="clock" size={20} color="#00594f" />
              </View>
              <View>
                <Caption className="font-nunito text-xs text-gray-500">{t('events.time')}</Caption>
                <Body className="font-nunito-bold text-gray-900">
                  {new Date(event.start_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} -{' '}
                  {new Date(event.end_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                </Body>
              </View>
            </View>

            {event.book_till && (
              <View className="mt-3 border-t border-gray-200 pt-3">
                <Caption className="font-nunito text-xs font-medium text-red-500">
                  {t('events.bookingDeadline')}: {new Date(event.book_till).toLocaleDateString()}
                </Caption>
              </View>
            )}
          </View>

          {/* Description */}
          <View className="mb-6">
            <H3 className="mb-2 font-nunito-bold text-lg text-gray-900">{t('events.aboutEvent')}</H3>
            <Body className="font-nunito leading-6 text-gray-600">{event.description}</Body>
          </View>

          {/* Location Map */}
          {event.lat && event.lng ? (
            <View className="mb-6">
              <H3 className="mb-2 font-nunito-bold text-lg text-gray-900">{t('events.location')}</H3>
              <View className="h-48 w-full overflow-hidden rounded-xl border border-gray-200">
                <MapView
                  style={{flex: 1}}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={{
                    latitude: event.lat,
                    longitude: event.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}>
                  <Marker coordinate={{latitude: event.lat, longitude: event.lng}} title={event.title || undefined} pinColor="#00594f" />
                </MapView>

                {/* Overlay for interaction */}
                <TouchableOpacity className="absolute bottom-0 left-0 right-0 top-0 active:bg-black/5" onPress={openAddressOnMap} />
              </View>
              <TouchableOpacity onPress={openAddressOnMap} className="mt-2 flex-row items-center">
                <Feather name="external-link" size={14} color="#00594f" />
                <Body className="ml-1 font-nunito-bold text-sm text-primary">Open in Maps</Body>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Tickets */}
          {event.event_ticket_types && event.event_ticket_types.length > 0 && (
            <View className="mb-6">
              <H3 className="mb-3 text-lg font-bold text-gray-900">{t('events.tickets')}</H3>
              {event.event_ticket_types.map((ticket: any) => {
                const isSelected = selectedTicket?.id === ticket.id;
                const bookedCount = ticketBookings?.[ticket.id] || 0;
                const availableTickets = ticket.capacity - bookedCount;
                const isSoldOut = availableTickets <= 0;

                return (
                  <TouchableOpacity
                    key={ticket.id}
                    onPress={() => !isSoldOut && setSelectedTicket(ticket)}
                    disabled={isSoldOut}
                    className={`mb-3 flex-row items-center justify-between rounded-xl border p-4 ${
                      isSoldOut ? 'border-gray-200 bg-gray-100 opacity-50' : isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
                    }`}>
                    <View>
                      <Body className={`font-bold ${isSoldOut ? 'text-gray-400' : isSelected ? 'text-primary' : 'text-gray-900'}`}>
                        {ticket.name}
                      </Body>
                      <Caption className="text-xs text-gray-500">
                        {isSoldOut ? 'Sold Out' : `${availableTickets} / ${ticket.capacity} available`}
                      </Caption>
                    </View>
                    <Body className={`text-lg font-bold ${isSoldOut ? 'text-gray-400' : isSelected ? 'text-primary' : 'text-green-700'}`}>
                      ${ticket.price}
                    </Body>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Reviews Section */}
          <View className="mt-4">
            <View className="mb-4 flex-row items-center justify-between">
              <H3 className="text-lg font-bold text-gray-900">Reviews</H3>
              {canReview && (
                <TouchableOpacity onPress={() => setReviewModalVisible(true)}>
                  <Body className="font-semibold text-green-700">Write a Review</Body>
                </TouchableOpacity>
              )}
            </View>

            {/* Review List */}
            {reviews && reviews.length > 0 ? (
              reviews.map((review) => (
                <View key={review.id} className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      {review.user_image ? (
                        <Image
                          source={{uri: supabase.storage.from('avatars').getPublicUrl(review.user_image).data.publicUrl}}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-gray-300">
                          <Feather name="user" size={16} color="white" />
                        </View>
                      )}
                      <Body className="font-semibold text-gray-900">{review.user_name || 'Anonymous'}</Body>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Caption className="ml-1 text-xs font-bold text-gray-900">{review.rating}</Caption>
                    </View>
                  </View>
                  {review.comment && <Body className="text-gray-600">{review.comment}</Body>}
                </View>
              ))
            ) : (
              <Body className="italic text-gray-500">No reviews yet. Be the first!</Body>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 3. Sticky Footer with Quantity & Book Button */}
      <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between rounded-t-[32px] border-t border-gray-100 bg-white p-5 px-6 pb-8 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.08)]">
        {/* Quantity Selector (Left) */}
        <View className="flex-row items-center gap-4 rounded-full bg-gray-50 px-2 py-2">
          <TouchableOpacity
            onPress={decrementQuantity}
            disabled={!selectedTicket || quantity <= 1}
            className={`h-10 w-10 items-center justify-center rounded-full shadow-none ${!selectedTicket || quantity <= 1 ? 'bg-gray-100' : 'bg-white shadow-sm'}`}>
            <Feather name="minus" size={18} color={quantity <= 1 ? '#9CA3AF' : '#1F2937'} />
          </TouchableOpacity>

          <Body className="min-w-[20px] text-center font-nunito-bold text-lg text-gray-900">{quantity}</Body>

          <TouchableOpacity
            onPress={incrementQuantity}
            disabled={!selectedTicket}
            className={`h-10 w-10 items-center justify-center rounded-full shadow-none ${!selectedTicket ? 'bg-gray-100' : 'bg-white shadow-sm'}`}>
            <Feather name="plus" size={18} color={!selectedTicket ? '#9CA3AF' : '#1F2937'} />
          </TouchableOpacity>
        </View>

        {/* Book Button (Right) */}
        <TouchableOpacity
          onPress={handleBookEvent}
          disabled={!selectedTicket || isBooking}
          className={`ml-4 flex-1 items-center rounded-full py-4 shadow active:opacity-90 ${selectedTicket && !isBooking ? 'bg-primary' : 'bg-gray-300'}`}>
          {isBooking ? (
            <ActivityIndicator color="white" />
          ) : (
            <Body className="font-nunito-bold text-[17px] text-white">
              {selectedTicket ? `Book - $${(selectedTicket.price * quantity).toFixed(2)}` : 'Select Ticket'}
            </Body>
          )}
        </TouchableOpacity>
      </View>

      {/* Review Modal */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-3xl bg-white p-6 pb-12">
            <View className="mb-6 flex-row items-center justify-between">
              <H3 className="font-nunito-bold text-xl">Write a Review</H3>
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

            <Body className="mb-2 font-nunito-bold text-gray-700">Comment</Body>
            <TextInput
              className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 font-nunito text-gray-900"
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
