import React, {useState} from 'react';
import {View, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator, Modal, Pressable} from 'react-native';
import {useLocalSearchParams, useRouter, Link} from 'expo-router';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Feather, Ionicons} from '@expo/vector-icons';
import {supabase} from '@/utils/supabase';
import Toast from 'react-native-toast-message';
import {useTranslation} from 'react-i18next';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {H2, H3, Body, Caption, ImageCarousel} from '@/components';

export default function ServiceDetailsScreen() {
  const {t, i18n} = useTranslation();
  const {id} = useLocalSearchParams<{id: string}>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {top} = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);

  // Fetch Service Details
  const {
    error,
    isLoading,
    data: service,
  } = useQuery({
    queryKey: ['service', id],
    queryFn: async () => {
      const {data, error} = await supabase.from('services').select(`*, categories(name)`).eq('id', id).single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch Rating Summary
  const {data: ratingSummary} = useQuery({
    queryKey: ['service_rating_summary', id],
    queryFn: async () => {
      const {data, error} = await supabase.rpc('get_service_rating_summary', {target_service_id: id});
      if (error) throw error;
      return data && data.length > 0 ? data[0] : {avg_rating: 0, count: 0};
    },
    enabled: !!id,
  });

  // Fetch Reviews
  const {data: reviews} = useQuery({
    queryKey: ['service_reviews', id],
    queryFn: async () => {
      const {data, error} = await supabase.rpc('get_service_reviews', {target_service_id: id});
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

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

  // Generate Image URL (use first image for now, can be carousel later)
  const imageUrl =
    service.images && service.images.length > 0 ? supabase.storage.from('images').getPublicUrl(service.images[0]).data.publicUrl : null;

  const lat = (service.location as any)?.coordinates ? (service.location as any).coordinates[1] : null;
  const lng = (service.location as any)?.coordinates ? (service.location as any).coordinates[0] : null;

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

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Valid Image */}
        <View className="aspect-square w-full bg-gray-100">
          <ImageCarousel images={service?.images} aspectRatio="square" />
        </View>

        <View className="p-5 pb-20">
          {/* Category & Status */}
          <View className="mb-2 flex-row items-center justify-between">
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

          {/* Title & Price */}
          <View className="mb-4 flex-row items-start justify-between">
            <View className="flex-1">
              <H2 className="mr-2 text-2xl text-gray-900">{service.title}</H2>
              {/* Rating Summary */}
              <View className="mt-1 flex-row items-center gap-1">
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Body className="font-bold text-gray-900">{ratingSummary?.avg_rating?.toFixed(1) || '0.0'}</Body>
                <Body className="text-gray-500">({ratingSummary?.count || 0} reviews)</Body>
              </View>
            </View>
            <H2 className="text-2xl text-primary">${service.price}</H2>
          </View>

          {/* Details Row */}
          <View className="mb-6 flex-row justify-between rounded-xl bg-gray-50 p-4">
            <View className="flex-1 items-center border-r border-gray-200">
              <Feather name="clock" size={20} color="#4B5563" className="mb-1" />
              <Caption className="mb-1 text-gray-500">{t('services.duration')}</Caption>
              <Body className="font-bold text-gray-900">
                {service.start_at?.slice(0, 5)} - {service.end_at?.slice(0, 5)}
              </Body>
            </View>
            <View className="flex-1 items-center">
              <Feather name="users" size={20} color="#4B5563" className="mb-1" />
              <Caption className="mb-1 text-gray-500">{t('events.capacity')}</Caption>
              <Body className="font-bold text-gray-900">{service.capacity} People</Body>
            </View>
          </View>

          {/* Location Map */}
          {lat && lng && (
            <View className="mb-6 h-40 overflow-hidden rounded-xl bg-gray-100">
              <MapView
                provider={PROVIDER_GOOGLE}
                style={{flex: 1}}
                initialRegion={{
                  latitude: lat,
                  longitude: lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}>
                <Marker coordinate={{latitude: lat, longitude: lng}} />
              </MapView>
              <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center">
                <View className="mb-4">
                  <Feather name="map-pin" size={32} color="#15803d" />
                </View>
              </View>
            </View>
          )}

          {/* Description */}
          <H3 className="mb-2 text-lg text-gray-900">{t('services.aboutService')}</H3>
          <Body className="mb-6 leading-6 text-gray-600">{service.description || 'No description provided.'}</Body>

          {/* Schedule */}
          <H3 className="mb-3 text-lg text-gray-900">{t('services.schedule')}</H3>
          <View className="mb-6 flex-row flex-wrap gap-2">
            {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
              const isActive = service.week_day?.includes(day as any);
              return (
                <View key={day} className={`h-10 w-10 items-center justify-center rounded-full ${isActive ? 'bg-primary' : 'bg-gray-100'}`}>
                  <Caption className={`font-bold uppercase ${isActive ? 'text-white' : 'text-gray-400'}`}>{day.slice(0, 3)}</Caption>
                </View>
              );
            })}
          </View>

          {/* Reviews List */}
          <View className="mt-2">
            <H3 className="mb-2 text-lg text-gray-900">Reviews ({ratingSummary?.count || 0})</H3>
            {reviews && reviews.length > 0 ? (
              reviews.map((review: any) => (
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
                      <Body className="font-bold text-gray-900">{review.user_name || 'Anonymous'}</Body>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Caption className="ml-1 font-bold text-gray-900">{review.rating}</Caption>
                    </View>
                  </View>
                  {review.comment && <Body className="text-gray-600">{review.comment}</Body>}
                </View>
              ))
            ) : (
              <Body className="italic text-gray-500">No reviews yet.</Body>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
