import React, {useState} from 'react';
import {View, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRouter} from 'expo-router';
import {Ionicons, Feather} from '@expo/vector-icons';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/utils/supabase';
import {useTranslation} from 'react-i18next';
import {useAppStore} from '@/store';
import {H2, Body, Caption} from '@/components';

export default function LikedItemsScreen() {
  const router = useRouter();
  const {t, i18n} = useTranslation();
  const {user} = useAppStore((s) => s.session!);
  const [activeTab, setActiveTab] = useState<'services' | 'events'>('services');

  const {
    data: likedItems,
    isLoading,
    refetch,
    isRefetching,
    error,
  } = useQuery({
    queryKey: ['liked-items', user?.id, activeTab],
    queryFn: async () => {
      if (activeTab === 'services') {
        // Fetch Service Bookmarks
        const {data: bookmarks, error} = await supabase
          .from('services_bookmark')
          .select(
            `
            id,
            created_at,
            service:services (
              id, title, description, price, images, capacity
            )
          `
          )
          .eq('user', user.id);

        if (error) {
          console.error('Error fetching service bookmarks:', error);
          throw error;
        }

        return bookmarks
          .filter((b) => b.service)
          .map((b) => {
            const s = b.service as any;
            return {
              ...s,
              bookmark_id: b.id,
            };
          });
      } else {
        // Fetch Event Bookmarks (Likes)
        const {data: bookmarks, error} = await supabase
          .from('event_bookmarks')
          .select('id, created_at, event:events (id, title, description, start_at, end_at, images, category, delete)')
          .eq('user', user.id);

        if (error) throw error;

        return bookmarks
          .filter((b) => b.event && !b.event.delete)
          .map((b) => {
            const e = b.event as any;
            return {
              ...e,
              bookmark_id: b.id,
            };
          });
      }
    },
    enabled: !!user?.id,
  });
  console.log('🚀 ~ LikedItemsScreen ~ error:', error);

  const renderServiceItem = ({item}: {item: any}) => {
    const imageUrl = item.images && item.images.length > 0 ? supabase.storage.from('images').getPublicUrl(item.images[0]).data.publicUrl : null;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(user)/services/${item.id}`)}
        className="mb-4 flex-row overflow-hidden rounded-2xl bg-white shadow-sm"
        style={{shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2}}>
        <View className="aspect-square w-32 bg-gray-200">
          {imageUrl ? (
            <Image source={{uri: imageUrl}} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Feather name="image" size={24} color="gray" />
            </View>
          )}
        </View>
        <View className="flex-1 justify-between p-3">
          <View>
            <Body numberOfLines={1} className="mb-1 font-nunito-bold text-base text-gray-900">
              {item.title}
            </Body>
            <Caption numberOfLines={2} className="text-gray-500">
              {item.description}
            </Caption>
          </View>
          <View className="flex-row items-center justify-between">
            <Body className="font-nunito-bold text-primary">${item.price}</Body>
            {/* We don't render LikeButton here to avoid complex list state mgmt for now, just list them */}
            <Ionicons name="heart" size={20} color="#ef4444" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEventItem = ({item}: {item: any}) => {
    const imageUrl = item.images && item.images.length > 0 ? supabase.storage.from('images').getPublicUrl(item.images[0]).data.publicUrl : null;

    const date = new Date(item.start_at).toLocaleDateString();

    return (
      <TouchableOpacity
        onPress={() => router.push(`/(user)/events/${item.id}`)}
        className="mb-4 flex-row overflow-hidden rounded-2xl bg-white shadow-sm"
        style={{shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2}}>
        <View className="aspect-square w-32 bg-gray-200">
          {imageUrl ? (
            <Image source={{uri: imageUrl}} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Feather name="image" size={24} color="gray" />
            </View>
          )}
        </View>
        <View className="flex-1 justify-between p-3">
          <View>
            <Body numberOfLines={1} className="mb-1 font-nunito-bold text-base text-gray-900">
              {item.title}
            </Body>
            <View className="flex-row items-center">
              <Feather name="calendar" size={12} color="gray" />
              <Caption className="ml-1 text-gray-500">{date}</Caption>
            </View>
          </View>
          <View className="flex-row items-center justify-between">
            <Caption className="font-nunito-bold text-primary">View Details</Caption>
            <Ionicons name="heart" size={20} color="#ef4444" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 from-white to-gray-50" edges={['top']}>
      {/* Header */}
      <View className="relative flex-row items-center justify-center border-b border-gray-100 bg-white px-4 py-4">
        <TouchableOpacity onPress={() => router.back()} className="absolute left-4 z-10 rounded-full bg-gray-100 p-2">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <H2 className="text-gray-900">Liked Items</H2>
      </View>

      {/* Tabs */}
      <View className="flex-row p-4">
        <TouchableOpacity
          onPress={() => setActiveTab('services')}
          className={`mr-3 flex-1 items-center justify-center rounded-xl py-3 ${activeTab === 'services' ? 'bg-primary' : 'bg-white'}`}
          style={activeTab !== 'services' && {borderWidth: 1, borderColor: '#E5E7EB'}}>
          <Body className={`font-nunito-bold ${activeTab === 'services' ? 'text-white' : 'text-gray-600'}`}>Services</Body>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('events')}
          className={`flex-1 items-center justify-center rounded-xl py-3 ${activeTab === 'events' ? 'bg-primary' : 'bg-white'}`}
          style={activeTab !== 'events' && {borderWidth: 1, borderColor: '#E5E7EB'}}>
          <Body className={`font-nunito-bold ${activeTab === 'events' ? 'text-white' : 'text-gray-600'}`}>Events</Body>
        </TouchableOpacity>
      </View>

      {/* List */}
      <View className="flex-1 px-4">
        {isLoading ? (
          <View className="mt-10 items-center">
            <ActivityIndicator size="large" color="#00594f" />
          </View>
        ) : (
          <FlatList
            data={likedItems || []}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingBottom: 40}}
            renderItem={activeTab === 'services' ? renderServiceItem : renderEventItem}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#00594f" />}
            ListEmptyComponent={
              <View className="mt-20 items-center justify-center">
                <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-gray-100">
                  <Ionicons name="heart-outline" size={40} color="#D1D5DB" />
                </View>
                <H2 className="text-gray-900">No liked {activeTab}</H2>
                <Body className="mt-2 text-center text-gray-500">Items you like will appear here.</Body>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
