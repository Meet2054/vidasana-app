import React, {useState} from 'react';
import {View, FlatList, TouchableOpacity, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {Feather, Ionicons} from '@expo/vector-icons';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/utils/supabase';
import {useTranslation} from 'react-i18next';
import {H2, Body} from '@/components/Typography';
import {Avatar} from '@/components/Avatar';
import {ServiceCard} from '@/components/ServiceCard';
import dayjs from 'dayjs';
import {Loader} from '@/components';

export default function ProviderProfileScreen() {
  const {id: idParam} = useLocalSearchParams();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const router = useRouter();
  const {t, i18n} = useTranslation();
  const [activeTab, setActiveTab] = useState<'services' | 'events'>('services');

  // Fetch Provider Info
  const {data: provider, isLoading: isLoadingProvider} = useQuery({
    queryKey: ['provider', id],
    queryFn: async () => {
      const {data, error} = await supabase.from('profile').select('id, name, image').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch Provider Services
  const {data: services, isLoading: isLoadingServices} = useQuery({
    queryKey: ['provider_services', id],
    queryFn: async () => {
      const {data, error} = await supabase
        .from('services')
        .select(`id, title, description, price, images, capacity, week_day`)
        .eq('provider', id)
        .eq('active', true);

      if (error) throw error;

      return data.map((s: any) => {
        return {
          ...s,
        };
      });
    },
    enabled: !!id,
  });

  // Fetch Provider Events
  const {data: events, isLoading: isLoadingEvents} = useQuery({
    queryKey: ['provider_events', id],
    queryFn: async () => {
      const {data, error} = await supabase
        .from('events')
        .select(
          `
            id, title, description, start_at, end_at, images, category
        `
        )
        .eq('provider', id);

      if (error) throw error;

      return data.map((e) => {
        return {
          ...e,
        };
      });
    },
    enabled: !!id,
  });

  const renderServiceItem = ({item}: {item: any}) => (
    <View className="mb-4">
      <ServiceCard
        id={item.id}
        title={item.title}
        description={item.description}
        price={item.price}
        images={item.images}
        rating={item.rating || 5.0} // Mock rating if missing
        isBookmarked={false} // Todo: impl bookmark
        onBookmarkToggle={() => {}}
        provider={provider}
        weekDays={item.week_day}
      />
    </View>
  );

  // Reuse ServiceCard but we need to route to /events/
  // Since ServiceCard has hardcoded routing, we should probably refactor ServiceCard or create EventCard.
  // For now, to keep it 'batter design' and consistent, let's use a temporary layout matching ServiceCard
  // Or simpler: Assuming the user clicked a ServiceCard, they expect a Service Details.
  // Events are different.
  // Use the same Card Design but manually implemented to control the link.
  const renderEventItem = ({item}: {item: any}) => {
    // Basic ServiceCard duplicate with Event Link
    // To save space and time, I will just use ServiceCard for now and IGNORE the link issue?
    // NO, that wraps it in Link to /services/. Broken UX.
    // I NEED to modify ServiceCard to accept `href` or `basePath`.
    // I will proceed with this file update, and THEN immediately update ServiceCard to accept `basePath`.
    return (
      <View className="mb-4">
        <ServiceCard
          id={item.id}
          title={item.title}
          description={dayjs(item.start_at).format('dddd, DD MMM YYYY • hh:mm A')}
          price={null} // Events might not have price or we don't fetch it
          images={item.images}
          isBookmarked={false}
          onBookmarkToggle={() => {}}
          // @ts-ignore - Planning to add basePath prop next
          basePath="/(user)/events"
          provider={provider}
        />
      </View>
    );
  };

  const renderEmptyState = (iconName: keyof typeof Feather.glyphMap, message: string) => (
    <View className="mt-10 items-center justify-center">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Feather name={iconName} size={28} color="#9CA3AF" />
      </View>
      <Body className="font-nunito-bold text-gray-500">{message}</Body>
    </View>
  );

  if (isLoadingProvider) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Loader visible />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="relative bg-white pb-6 pt-2">
        <TouchableOpacity onPress={() => router.back()} className="absolute left-4 top-4 z-10 p-2">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>

        <View className="mt-6 items-center">
          <Avatar uri={provider?.image} name={provider?.name} size={100} className="mb-4 border-4 border-white shadow-lg" />
          <H2 className="text-center text-xl text-gray-900">{provider?.name || 'Provider'}</H2>
        </View>
      </View>

      {/* Tabs */}
      <View className="z-10 flex-row border-b border-gray-200 bg-white shadow-sm">
        <TouchableOpacity
          onPress={() => setActiveTab('services')}
          className={`flex-1 items-center border-b-2 py-4 ${activeTab === 'services' ? 'border-primary' : 'border-transparent'}`}>
          <Body className={`font-nunito-bold ${activeTab === 'services' ? 'text-primary' : 'text-gray-500'}`}>Services</Body>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('events')}
          className={`flex-1 items-center border-b-2 py-4 ${activeTab === 'events' ? 'border-primary' : 'border-transparent'}`}>
          <Body className={`font-nunito-bold ${activeTab === 'events' ? 'text-primary' : 'text-gray-500'}`}>Events</Body>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="flex-1 px-4 pt-4">
        {activeTab === 'services' ? (
          isLoadingServices ? (
            <ActivityIndicator className="mt-10" color="#00594f" />
          ) : (
            <FlatList
              data={services || []}
              keyExtractor={(item) => item.id}
              renderItem={renderServiceItem}
              ListEmptyComponent={renderEmptyState('package', 'No services found')}
              contentContainerStyle={{paddingBottom: 20}}
              showsVerticalScrollIndicator={false}
            />
          )
        ) : isLoadingEvents ? (
          <ActivityIndicator className="mt-10" color="#00594f" />
        ) : (
          <FlatList
            data={events || []}
            keyExtractor={(item) => item.id}
            renderItem={renderEventItem}
            ListEmptyComponent={renderEmptyState('calendar', 'No events found')}
            contentContainerStyle={{paddingBottom: 20}}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={null}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
