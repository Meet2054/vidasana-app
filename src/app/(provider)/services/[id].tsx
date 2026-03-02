import React, {useState} from 'react';
import {View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, Pressable, Platform, Linking} from 'react-native';
import {useLocalSearchParams, useRouter, Link} from 'expo-router';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Feather, Ionicons} from '@expo/vector-icons';
import {supabase, formatTime, parseLocation} from '@/utils';
import Toast from 'react-native-toast-message';
import {useTranslation} from 'react-i18next';
import dayjs from 'dayjs';
import {Avatar, H2, H3, Body, Caption, Subtitle, ImageCarousel} from '@/components';

export default function ServiceDetailsScreen() {
  const {t} = useTranslation();
  const {id} = useLocalSearchParams<{id: string}>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {top} = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);

  // Single RPC — returns service, rating summary, and reviews together
  const {
    error,
    isLoading,
    data: service,
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

  // Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const {error} = await supabase
        .from('services')
        .update({active})
        .eq('id', id as string);
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({queryKey: ['services']});
      queryClient.invalidateQueries({queryKey: ['service', id]});
      Toast.show({type: 'success', text1: newStatus ? t('services.active') : t('services.disabled')});
      setMenuVisible(false);
    },
    onError: (err: any) => {
      Toast.show({type: 'error', text1: 'Update failed', text2: err.message});
    },
  });

  const handleToggleStatus = () => {
    setMenuVisible(false);
    const isActive = service?.active;
    Alert.alert(
      isActive ? t('services.disableService') : t('services.enableService'),
      isActive ? t('services.disableConfirm') : t('services.enableConfirm'),
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: isActive ? 'Disable' : 'Enable',
          style: isActive ? 'destructive' : 'default',
          onPress: () => toggleStatusMutation.mutate(!isActive),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#00594f" />
      </View>
    );
  }

  if (error || !service) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white p-4">
        <Body className="mb-4 text-red-500">Failed to load service details.</Body>
        <TouchableOpacity onPress={() => router.back()} className="rounded-lg bg-gray-200 px-4 py-2">
          <Body>Go Back</Body>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const {lat, lng} = parseLocation(service.location);

  const openAddressOnMap = (mapLat: number | null, mapLng: number | null, label: string) => {
    let url: string | undefined;
    if (mapLat && mapLng) {
      const scheme = Platform.select({ios: 'maps:0,0?q=', android: 'geo:0,0?q='});
      const latLng = `${mapLat},${mapLng}`;
      url = Platform.select({ios: `${scheme}${label}@${latLng}`, android: `${scheme}${latLng}(${label})`});
    } else if (label) {
      // Fall back to address search if no coordinates
      url = Platform.select({
        ios: `maps:?q=${encodeURIComponent(label)}`,
        android: `geo:0,0?q=${encodeURIComponent(label)}`,
      });
    }
    if (url) Linking.openURL(url).catch((err) => Toast.show({type: 'error', text1: 'Error opening map', text2: err.message}));
  };

  // Format Available Days
  const availableDaysText = (() => {
    if (!service || !service.week_day) return 'All Days';
    if (service.week_day.length === 7) return 'Every Day';
    const orderedDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const sortedDays = [...service.week_day].sort((a: string, b: string) => orderedDays.indexOf(a) - orderedDays.indexOf(b));
    return sortedDays.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
  })();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="relative z-10 flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="-ml-2 p-2">
          <Feather name="arrow-left" size={24} color="black" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMenuVisible(true)} className="-mr-2 p-2">
          <Feather name="more-vertical" size={24} color="black" />
        </TouchableOpacity>

        {/* Custom Menu Modal/Popup */}
        <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable className="flex-1 bg-black/10" onPress={() => setMenuVisible(false)}>
            <View
              style={{marginTop: top + 60}}
              className="absolute right-4 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
              <Link href={`/(provider)/services/edit/${id}`} asChild onPress={() => setMenuVisible(false)}>
                <Pressable className="flex-row items-center border-b border-gray-50 px-4 py-3 active:bg-gray-50">
                  <Feather name="edit-2" size={16} color="#374151" />
                  <Body className="ml-3 text-gray-700">Edit</Body>
                </Pressable>
              </Link>

              <Pressable onPress={handleToggleStatus} className="flex-row items-center px-4 py-3 active:bg-gray-50">
                <Feather name={service.active ? 'slash' : 'check-circle'} size={16} color={service.active ? '#EF4444' : '#00594f'} />
                <Body className={`ml-3 ${service.active ? 'text-red-600' : 'text-primary'}`}>
                  {service.active ? t('services.disabled') : t('services.active')}
                </Body>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 40}}>
        {/* Image Carousel */}
        <View className="aspect-square w-full bg-gray-100">
          <ImageCarousel images={service?.images} aspectRatio="square" />
        </View>

        <View className="bg-white px-6 pb-6 pt-5">
          {/* Category & Status */}
          <View className="mb-3 flex-row items-center justify-between">
            <View className="rounded-full bg-primary/20 px-3 py-1">
              <Caption className="font-bold uppercase text-primary">{service.categories?.name || 'Service'}</Caption>
            </View>
            <View className={`flex-row items-center rounded-full px-2 py-1 ${service.active ? 'bg-primary/20' : 'bg-red-100'}`}>
              <View className={`mr-1.5 h-2 w-2 rounded-full ${service.active ? 'bg-primary' : 'bg-red-500'}`} />
              <Caption className={`font-bold ${service.active ? 'text-primary' : 'text-red-700'}`}>
                {service.active ? t('services.active') : t('services.disabled')}
              </Caption>
            </View>
          </View>

          {/* Title, Rating & Price */}
          <View className="mb-2 items-center">
            <H2 align="center" className="mb-2 font-nunito-extra-bold text-[24px] leading-8 text-gray-900">
              {service.title}
            </H2>
            <View className="flex-row items-center gap-1">
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Body className="font-bold text-gray-900">{ratingSummary?.avg_rating?.toFixed(1) || '0.0'}</Body>
              <Body className="text-gray-500">({ratingSummary?.count || 0} reviews)</Body>
              <Body className="ml-4 font-nunito-bold text-[20px] text-primary">${service.price?.toFixed(2) || '0.00'}</Body>
            </View>
          </View>

          <View className="mb-5 mt-3 h-[1px] w-full bg-gray-100" />

          {/* About Section */}
          <View className="mb-5">
            <H2 className="mb-3 text-[18px] text-gray-900">{t('services.aboutService')}</H2>
            <Body className="text-[15px] leading-6 text-gray-600">{service.description || 'No description provided.'}</Body>
          </View>

          <View className="mb-5 h-[1px] w-full bg-gray-100" />

          {/* Service Details Section */}
          <View className="mb-2">
            <H2 className="mb-4 text-[18px] text-gray-900">Service Details</H2>

            {/* Availability */}
            <View className="mb-3 flex-row gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0F0]">
                <Ionicons name="calendar" size={20} color="#E9967A" />
              </View>
              <View className="flex-1 justify-center">
                <Subtitle className="font-nunito-bold tracking-widest text-gray-500">AVAILABILITY</Subtitle>
                <H3 className="text-[15px] capitalize text-gray-900">{availableDaysText}</H3>
              </View>
            </View>

            {/* Location */}
            <View className="mb-4 flex-row gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0F0]">
                <Ionicons name="location" size={20} color="#E9967A" />
              </View>
              <View className="flex-1 justify-center">
                <Subtitle className="font-nunito-bold tracking-widest text-gray-500">LOCATION</Subtitle>
                <H3 className="text-[15px] leading-5 text-gray-900">{service.address || 'Not specified'}</H3>
                {(service.address || lat) && (
                  <TouchableOpacity onPress={() => openAddressOnMap(lat, lng, service.address || service.title || '')}>
                    <Body className="font-nunito-bold text-[13px] text-primary">View on map</Body>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Capacity */}
            <View className="mb-4 flex-row gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
                <Ionicons name="people" size={20} color="#6B7280" />
              </View>
              <View className="flex-1 justify-center">
                <Subtitle className="font-nunito-bold tracking-widest text-gray-500">CAPACITY</Subtitle>
                <H3 className="text-[15px] text-gray-900">{service.capacity || '0'} participants</H3>
              </View>
            </View>

            {/* Time */}
            <View className="flex-row gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
                <Ionicons name="time-outline" size={20} color="#6B7280" />
              </View>
              <View className="flex-1 justify-center">
                <Subtitle className="font-nunito-bold tracking-widest text-gray-500">TIME</Subtitle>
                <H3 className="text-[15px] text-gray-900">
                  {service.start_at && service.end_at ? `${formatTime(service.start_at)} - ${formatTime(service.end_at)}` : 'N/A'}
                </H3>
              </View>
            </View>
          </View>

          <View className="mb-5 mt-5 h-[1px] w-full bg-gray-100" />

          {/* Reviews Section */}
          <View className="mb-2">
            <View className="mb-4 flex-row items-center justify-between">
              <H2 className="text-[18px] text-gray-900">Reviews</H2>
              <View className="flex-row items-center gap-1">
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Body className="font-nunito-bold text-[15px] text-gray-900">{ratingSummary?.avg_rating?.toFixed(1) || '0.0'}</Body>
                <Caption className="text-gray-500">({ratingSummary?.count || 0})</Caption>
              </View>
            </View>

            {reviews && reviews.length > 0 ? (
              reviews.map((review: any) => (
                <View key={review.id} className="mb-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <Avatar size={36} name={review.user_name} uri={review.user_image} />
                      <View>
                        <Body className="font-nunito-bold text-[14px] text-gray-900">{review.user_name || 'Anonymous'}</Body>
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
                  {review.comment && <Body className="pl-[48px] text-[14px] leading-5 text-gray-600">{review.comment}</Body>}
                </View>
              ))
            ) : (
              <View className="items-center justify-center py-4">
                <Body className="italic text-gray-500">No reviews yet.</Body>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
