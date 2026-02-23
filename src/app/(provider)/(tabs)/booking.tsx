import React, {useState} from 'react';
import {View, SectionList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Linking} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/utils/supabase';
import {useAppStore} from '@/store';
import dayjs from 'dayjs';
import {Ionicons, Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {H2, Body, Caption} from '@/components';
import {useRouter, Link} from 'expo-router';

export default function ProviderBookingsScreen() {
  const {user} = useAppStore((s) => s.session!);
  const {t, i18n} = useTranslation();
  const [activeTab, setActiveTab] = useState<'service' | 'event'>('service');
  const router = useRouter();

  const {
    data: bookings = [],
    error,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['provider-bookings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // 1. Fetch Service Bookings
      const {data: serviceBookings, error: serviceError} = await supabase
        .from('services_booking')
        .select(
          `id, created_at, status, price, appointed, service:services!inner (id, images, provider, translations:service_translations(title, lang_code)), user:profile (id, name, image, phone)`
        )
        .eq('service.provider', user.id);

      if (serviceError) throw serviceError;

      // 2. Fetch Event Bookings
      const {data: eventBookings, error: eventError} = await supabase
        .from('event_booking')
        .select(
          `id, created_at, status, total_price, event:events!inner (id, start_at, images, provider, translations:event_translations(title, lang_code)), user:profile (id, name, image, phone)`
        )
        .eq('event.provider', user.id);

      if (eventError) throw eventError;

      // 3. Normalize & Combine
      const normalizedServices = (serviceBookings || []).map((b: any) => ({
        id: b.id,
        created_at: b.created_at,
        date: b.appointed,
        status: b.status,
        price: b.price,
        type: 'service',
        title: getTranslation(b.service?.translations, i18n.language),
        image: b.service?.images?.[0],
        user: b.user,
      }));

      const normalizedEvents = (eventBookings || []).map((b: any) => ({
        id: b.id,
        created_at: b.created_at,
        date: b.event?.start_at,
        status: b.status || 'booked', // Default if null
        price: b.total_price,
        type: 'event',
        title: getTranslation(b.event?.translations, i18n.language),
        image: b.event?.images?.[0],
        user: b.user,
      }));

      return [...normalizedServices, ...normalizedEvents];
    },
    enabled: !!user?.id,
  });

  const getTranslation = (translations: any[], lang: string) => {
    const tr = translations?.find((t) => t.lang_code === lang) || translations?.find((t) => t.lang_code === 'en') || translations?.[0];
    return tr?.title || 'Untitled';
  };

  // Group bookings by day
  const sections = (() => {
    if (!bookings) return [];

    const filtered = bookings.filter((b: any) => b.type === activeTab);
    const groups: {[key: string]: any[]} = {};

    filtered.forEach((booking: any) => {
      const dateKey = dayjs(booking.date).format('YYYY-MM-DD');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(booking);
    });

    return Object.keys(groups)
      .sort()
      .map((dateKey) => ({title: dateKey, data: groups[dateKey]}));
  })();

  const renderSectionHeader = ({section: {title}}: any) => {
    const date = dayjs(title);
    let headerText = date.format('dddd, D MMMM');
    const today = dayjs();
    const tomorrow = dayjs().add(1, 'day');
    if (date.isSame(today, 'day')) headerText = 'Today';
    else if (date.isSame(tomorrow, 'day')) headerText = 'Tomorrow';

    return (
      <View className="mt-2 bg-gray-100 px-5 py-3">
        <Body className="font-nunito-bold text-sm uppercase tracking-wide text-gray-500">{headerText}</Body>
      </View>
    );
  };

  const renderItem = ({item}: {item: any}) => {
    const userImage = item.user?.image ? {uri: supabase.storage.from('avatars').getPublicUrl(item.user.image).data.publicUrl} : null;

    return (
      <View className="flex-row items-center border-b border-gray-100 bg-white p-4">
        <View className="mr-3 w-16 items-center justify-center border-r border-gray-100 pr-3">
          <Body className="font-nunito-bold text-lg text-gray-900">{dayjs(item.date).format('h:mm')}</Body>
          <Caption className="font-nunito font-semibold text-gray-500">{dayjs(item.date).format('A')}</Caption>
        </View>

        <View className="mr-4">
          {userImage ? (
            <Image source={userImage} className="h-12 w-12 rounded-full bg-gray-200" />
          ) : (
            <View className="h-12 w-12 items-center justify-center rounded-full bg-gray-200">
              <Feather name="user" size={20} color="gray" />
            </View>
          )}
        </View>

        <View className="flex-1">
          <Body className="font-nunito-bold text-base text-gray-900" numberOfLines={1}>
            {item.user?.name || 'Unknown User'}
          </Body>
          <Caption className="mt-0.5 text-gray-500" numberOfLines={1}>
            {item.title}
          </Caption>
          <View className="mt-1 flex-row items-center">
            <View
              className={`rounded-full px-2 py-0.5 ${item.status === 'booked' ? 'bg-sage/20' : item.status === 'disputed' ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Caption
                className={`font-nunito-bold capitalize ${item.status === 'booked' ? 'text-sage' : item.status === 'disputed' ? 'text-red-700' : 'text-gray-600'}`}>
                {item.status}
              </Caption>
            </View>
            <Caption className="ml-3 font-medium text-gray-400">ID: {item.id.substring(0, 6)}</Caption>
            {item.status === 'disputed' && (
              <TouchableOpacity
                onPress={() => router.push(`/(provider)/dispute/${item.id}` as any)}
                className="ml-3 flex-row items-center space-x-1 rounded-full border border-red-100 bg-red-50 px-3 py-1">
                <Feather name="eye" size={14} color="#EF4444" />
                <Caption className="ml-1 font-nunito-bold text-red-500">View Dispute</Caption>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="items-end">
          <Body className="font-nunito-bold text-base text-gray-900">${item.price}</Body>
          <TouchableOpacity
            className="mt-2 rounded-full bg-gray-50 p-2"
            onPress={() => {
              if (item.user?.phone) Linking.openURL(`tel:${item.user.phone}`);
            }}>
            <Ionicons name="call-outline" size={18} color="gray" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading && !isRefetching) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#00594f" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-col border-b border-gray-100 px-5 py-4">
        <View className="mb-4 flex-row items-center justify-between">
          <H2 className="text-gray-900">{t('bookings.providerTitle')}</H2>
          <Link href="/(provider)/scan-qr" asChild>
            <TouchableOpacity className="flex-row items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-2">
              <Ionicons name="qr-code-outline" size={18} color="#00594f" />
              <Caption className="ml-2 font-nunito-bold text-sm text-primary">{t('bookings.scan')}</Caption>
            </TouchableOpacity>
          </Link>
        </View>

        <View className="flex-row rounded-full bg-gray-100 p-1">
          <TouchableOpacity
            onPress={() => setActiveTab('service')}
            className={`flex-1 items-center rounded-full py-2 shadow-none ${activeTab === 'service' ? 'bg-white shadow-sm' : 'bg-transparent'}`}>
            <Body className={`font-nunito-bold ${activeTab === 'service' ? 'text-primary' : 'text-gray-500'}`}>Services</Body>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('event')}
            className={`flex-1 items-center rounded-full py-2 shadow-none ${activeTab === 'event' ? 'bg-white shadow-sm' : 'bg-transparent'}`}>
            <Body className={`font-nunito-bold ${activeTab === 'event' ? 'text-primary' : 'text-gray-500'}`}>Events</Body>
          </TouchableOpacity>
        </View>
      </View>

      {bookings && bookings.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={isLoading || isRefetching} onRefresh={refetch} tintColor="#00594f" />}
          contentContainerStyle={{paddingBottom: 20}}
        />
      ) : (
        <View className="flex-1 items-center justify-center p-10">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <Feather name="calendar" size={32} color="gray" />
          </View>
          <Body className="text-center font-nunito-bold text-lg text-gray-900">{t('bookings.noBookingsYet')}</Body>
          <Body className="mt-2 text-center text-gray-500">{t('bookings.noBookingsMessage')}</Body>
          <TouchableOpacity onPress={() => refetch()} className="mt-6 rounded-full bg-primary px-6 py-3">
            <Body className="font-nunito-bold text-white">{t('bookings.refresh')}</Body>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
