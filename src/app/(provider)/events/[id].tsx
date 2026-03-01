import {Feather} from '@expo/vector-icons';
import {supabase} from '@/utils/supabase';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Link, useLocalSearchParams, useRouter} from 'expo-router';
import React, {useState} from 'react';
import {ActivityIndicator, ScrollView, TouchableOpacity, View, Modal, Pressable, Alert} from 'react-native';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {useTranslation} from 'react-i18next';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ImageCarousel} from '@/components';
import {H2, H3, Body, Caption} from '@/components';
import Toast from 'react-native-toast-message';

export default function EventDetailsScreen() {
  const {id: idParam} = useLocalSearchParams();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const {back} = useRouter();
  const {t, i18n} = useTranslation();
  const queryClient = useQueryClient();
  const [menuVisible, setMenuVisible] = useState(false);

  // Delete Event Mutation (Soft Delete)
  const deleteEventMutation = useMutation({
    mutationFn: async () => {
      const {error} = await supabase.from('events').update({delete: true}).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['events']});
      queryClient.invalidateQueries({queryKey: ['events_search_home']});
      queryClient.invalidateQueries({queryKey: ['event', id]});
      Toast.show({type: 'success', text1: 'Event deleted successfully'});
      setMenuVisible(false);
      back();
    },
    onError: (err: any) => Toast.show({type: 'error', text1: 'Delete failed', text2: err.message}),
  });

  const handleDeleteEvent = () => {
    setMenuVisible(false);
    Alert.alert(t('events.deleteTitle'), t('events.deleteConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {style: 'destructive', text: t('events.deleteButton'), onPress: () => deleteEventMutation.mutate()},
    ]);
  };

  const {data: event, isLoading} = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const {data, error} = await supabase.from('events').select('*, event_ticket_types(*), categories(*)').eq('id', id).single();

      if (error) throw error;

      return {
        ...data,
        lat: (data as any).location?.coordinates ? (data as any).location.coordinates[1] : null,
        lng: (data as any).location?.coordinates ? (data as any).location.coordinates[0] : null,
      };
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#00594f" />
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Body className="text-gray-500">Event not found</Body>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="relative z-10 flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
        <TouchableOpacity onPress={() => back()} className="-ml-2 p-2">
          <Feather name="arrow-left" size={24} color="black" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMenuVisible(true)} className="-mr-2 p-2">
          <Feather name="more-vertical" size={24} color="black" />
        </TouchableOpacity>

        {/* Custom Menu Modal/Popup */}
        <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable className="flex-1 bg-black/10" onPress={() => setMenuVisible(false)}>
            <View
              // Calculate top offset based on safe area if needed, but here simple implementation
              className="absolute right-4 top-24 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
              <Link href={`/(provider)/events/edit/${id}`} asChild onPress={() => setMenuVisible(false)}>
                <Pressable className="flex-row items-center border-b border-gray-50 px-4 py-3 active:bg-gray-50">
                  <Feather name="edit-2" size={16} color="#374151" />
                  <Body className="ml-3 text-gray-700">Edit</Body>
                </Pressable>
              </Link>

              <Pressable onPress={handleDeleteEvent} className="flex-row items-center px-4 py-3 active:bg-gray-50">
                <Feather name="trash-2" size={16} color="#EF4444" />
                <Body className="ml-3 text-red-600">{t('events.deleteButton')}</Body>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Image Carousel */}
        <View className="relative aspect-square w-full bg-gray-200">
          <ImageCarousel images={event?.images} aspectRatio="square" />
        </View>

        {/* Content */}
        <View className="p-5">
          {/* Category Badge */}
          {event.categories && (
            <View className="mb-3 self-start rounded-full bg-primary/10 px-3 py-1">
              <Caption className="font-nunito-bold text-primary">{event.categories.name}</Caption>
            </View>
          )}

          {/* Title */}
          <H2 className="mb-2 text-gray-900">{event.title}</H2>

          {/* Date & Time */}
          <View className="mb-6 rounded-xl bg-gray-50 p-4">
            <View className="mb-3 flex-row items-center">
              <View className="mr-3 rounded-full bg-primary/10 p-2">
                <Feather name="calendar" size={20} color="#00594f" />
              </View>
              <View>
                <Caption className="text-gray-500">{t('events.date')}</Caption>
                <Body className="font-nunito-bold text-gray-900">
                  {new Date(event.start_at).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Body>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="mr-3 rounded-full bg-primary/10 p-2">
                <Feather name="clock" size={20} color="#00594f" />
              </View>
              <View>
                <Caption className="text-gray-500">{t('events.time')}</Caption>
                <Body className="font-nunito-bold text-gray-900">
                  {new Date(event.start_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} -{' '}
                  {new Date(event.end_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                </Body>
              </View>
            </View>

            {event.book_till && (
              <View className="mt-3 border-t border-gray-200 pt-3">
                <Caption className="font-medium text-red-500">
                  {t('events.bookingDeadline')}: {new Date(event.book_till).toLocaleDateString()}
                </Caption>
              </View>
            )}
          </View>

          {/* Description */}
          <View className="mb-6">
            <H3 className="mb-2 text-gray-900">{t('events.aboutEvent')}</H3>
            <Body className="leading-6 text-gray-600">{event.description}</Body>
          </View>

          {/* Location Map */}
          {event.lat && event.lng ? (
            <View className="mb-6">
              <H3 className="mb-2 text-gray-900">{t('events.location')}</H3>
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
                  <Marker coordinate={{latitude: event.lat, longitude: event.lng}} title={event.title || undefined} />
                </MapView>
              </View>
            </View>
          ) : null}

          {/* Tickets */}
          {event.event_ticket_types && event.event_ticket_types.length > 0 && (
            <View className="mb-6">
              <H3 className="mb-3 text-gray-900">{t('events.tickets')}</H3>
              {event.event_ticket_types.map((ticket: any) => (
                <View key={ticket.id} className="mb-3 flex-row items-center justify-between rounded-xl border border-gray-200 p-4">
                  <View>
                    <Body className="font-nunito-bold text-gray-900">{ticket.name}</Body>
                    <Caption className="text-gray-500">Capacity: {ticket.capacity}</Caption>
                  </View>
                  <Body className="font-nunito-bold text-lg text-primary">${ticket.price}</Body>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
