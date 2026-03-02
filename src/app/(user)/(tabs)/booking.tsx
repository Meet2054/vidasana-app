import {useQuery} from '@tanstack/react-query';
import React, {useMemo, useState} from 'react';
import {View, SectionList, TouchableOpacity, RefreshControl, StatusBar} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {supabase} from '@/utils';
import {useAppStore} from '@/store';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import dayjs from 'dayjs';
import {H2, H3, Body, Caption, BookingCard} from '@/components';

type Booking = {
  id: string;
  created_at: string;
  status: string;
  appointed?: string; // Service date
  event_start_at?: string; // Event date
  title: string;
  description?: string;
  location?: string;
  images: string[];
  type: 'service' | 'event';
  price: number;
};

type GroupedBooking = {
  title: string;
  data: Booking[];
};

export default function BookingsScreen() {
  const {user} = useAppStore((s) => s.session!);
  const [activeTab, setActiveTab] = useState<'service' | 'event'>('service');
  const router = useRouter();

  const {
    data: allBookings = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ['bookings', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // 1. Fetch Service Bookings
      const {data: serviceBookings, error: serviceError} = await supabase
        .from('services_booking')
        .select(
          `
          id, created_at, status, price, appointed,
          services (
            location,
            images,
            title, description
          )
        `
        )
        .eq('user', user.id);

      if (serviceError) throw serviceError;

      // 2. Fetch Event Bookings
      const {data: eventBookings, error: eventError} = await supabase
        .from('event_booking')
        .select(
          `
          id, created_at, status, total_price,
          events (
            start_at,
            location, 
            images,
            title, description
          )
        `
        )
        .eq('user', user.id);

      if (eventError) throw eventError;

      // 3. Normalize Data
      const combined: Booking[] = [
        ...(serviceBookings || []).map((b: any) => ({
          id: b.id,
          created_at: b.created_at,
          status: b.status,
          appointed: b.appointed,
          title: b.services?.title || 'Service',
          description: b.services?.description,
          location: b.services?.location,
          images: b.services?.images || [],
          type: 'service' as const,
          price: b.price,
        })),
        ...(eventBookings || []).map((b: any) => ({
          id: b.id,
          created_at: b.created_at,
          status: b.status || 'booked',
          event_start_at: b.events?.start_at,
          title: b.events?.title || 'Event',
          description: b.events?.description,
          location: b.events?.location,
          images: b.events?.images || [],
          type: 'event' as const,
          price: b.total_price,
        })),
      ];

      return combined;
    },
    enabled: !!user,
  });

  const sections = useMemo(() => {
    // Filter and Group locally
    const filtered = allBookings.filter((b) => b.type === activeTab);

    // Sort by Date Descending
    filtered.sort((a, b) => {
      const dateA = dayjs(a.appointed || a.event_start_at || a.created_at);
      const dateB = dayjs(b.appointed || b.event_start_at || b.created_at);
      return dateB.diff(dateA);
    });

    // Group by Date String
    const grouped: GroupedBooking[] = [];
    filtered.forEach((b) => {
      const dateStr = dayjs(b.appointed || b.event_start_at).format('dddd, MMMM D');
      const existing = grouped.find((g) => g.title === dateStr);
      if (existing) {
        existing.data.push(b);
      } else {
        grouped.push({title: dateStr, data: [b]});
      }
    });

    return grouped;
  }, [allBookings, activeTab]);

  const renderSectionHeader = ({section: {title}}: {section: {title: string}}) => (
    <View className="bg-gray-50 pb-4 pt-6">
      <H3 className="text-black">{title}</H3>
    </View>
  );

  const renderItem = ({item}: {item: Booking}) => {
    const startTime = dayjs(item.appointed || item.event_start_at);
    const endTime = startTime.add(1, 'hour'); // Mock duration
    const now = dayjs();

    // Dispute Logic:
    // Show if (Now > EndTime) AND (Now < EndTime + 72h) AND (Status != 'disputed')
    const canDispute = now.isAfter(endTime) && now.isBefore(endTime.add(72, 'hour')) && item.status !== 'disputed';

    // Resolve Image URL
    let imageUrl = item.images?.[0];
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = supabase.storage.from('images').getPublicUrl(imageUrl).data.publicUrl;
    }

    return (
      <View className="mb-4">
        <BookingCard
          title={item.title}
          description={item.description}
          startTime={startTime.format('h:mm a')}
          endTime={endTime.format('h:mm a')}
          image={imageUrl}
          price={item.price}
          status={item.status}
          onPress={() => router.push(`/(user)/receipt/${item.id}?type=${item.type}` as any)}
        />

        {/* Status / Action Footer */}
        <View className="mt-2 flex-row items-center justify-end px-1">
          {canDispute && (
            <TouchableOpacity
              onPress={() => router.push(`/(user)/dispute/create?bookingId=${item.id}&type=${item.type}` as any)}
              className="flex-row items-center space-x-1">
              <Feather name="alert-circle" size={14} color="#EF4444" />
              <Caption className="font-nunito-bold text-red-500">Report Issue</Caption>
            </TouchableOpacity>
          )}

          {item.status === 'disputed' && (
            <TouchableOpacity
              onPress={() => router.push(`/(user)/dispute/${item.id}` as any)}
              className="flex-row items-center space-x-1 rounded-full border border-red-100 bg-red-50 px-3 py-1">
              <Feather name="eye" size={14} color="#EF4444" />
              <Caption className="ml-1 font-nunito-bold text-red-500">View Dispute</Caption>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 px-6" edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View className="mb-4 mt-1 flex-row items-center justify-between">
        <H2 className="text-gray-900">My Bookings</H2>
      </View>

      {/* Tabs */}
      <View className="flex-row rounded-full bg-white">
        <TouchableOpacity
          onPress={() => setActiveTab('service')}
          className={`flex-1 items-center rounded-full py-2 ${activeTab === 'service' ? 'bg-primary shadow-sm' : 'shadow-none'}`}>
          <Body className={`font-nunito-bold ${activeTab === 'service' ? 'text-white' : 'text-gray-400'}`}>Services</Body>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('event')}
          className={`flex-1 items-center rounded-full py-2 ${activeTab === 'event' ? 'bg-primary shadow-sm' : 'shadow-none'}`}>
          <Body className={`font-nunito-bold ${activeTab === 'event' ? 'text-white' : 'text-gray-400'}`}>Events</Body>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
        contentContainerStyle={{paddingBottom: 40}}
        ListEmptyComponent={
          !loading ? (
            <View className="mt-20 items-center">
              <Feather name="calendar" size={48} color="#D4C3B7" />
              <Body className="mt-4 text-gray-500">No {activeTab} bookings found</Body>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
