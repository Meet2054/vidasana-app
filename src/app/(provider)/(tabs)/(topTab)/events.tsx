import {supabase} from '@/utils';
import {Feather} from '@expo/vector-icons';
import {useQuery} from '@tanstack/react-query';
import {ActivityIndicator, FlatList, RefreshControl, View} from 'react-native';
import {useAppStore} from '@/store';
import {useTranslation} from 'react-i18next';
import {H3, Body, EventCard} from '@/components';

export default function EventsScreen() {
  const {t, i18n} = useTranslation();
  const {
    data: events,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['events', i18n.language],
    queryFn: async () => {
      const {user} = useAppStore.getState().session!;
      if (!user) throw new Error('Not authenticated');

      const {data, error} = await supabase
        .from('events')
        .select('*')
        .eq('provider', user.id)
        .eq('delete', false)
        .order('created_at', {ascending: false});

      if (error) throw error;

      return data;
    },
  });

  const renderItem = ({item}: {item: any}) => {
    return (
      <EventCard
        id={item.id}
        title={item.title}
        description={item.description}
        price={null} // Events price logic might vary, passing null or item.price if available
        images={item.images}
        startAt={item.start_at}
        variant="provider"
        rating={item.rating || 0}
      />
    );
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 px-4 pt-2">
        {isLoading ? (
          <ActivityIndicator size="large" color="#15803d" className="mt-10" />
        ) : (
          <FlatList
            data={events}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingBottom: 100}}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
            ListEmptyComponent={() => (
              <View className="mt-20 items-center justify-center">
                <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-gray-50">
                  <Feather name="calendar" size={40} color="#D1D5DB" />
                </View>
                <H3 className="mb-2 text-lg text-gray-900">{t('events.noEvents')}</H3>
                <Body className="mb-6 text-center text-gray-500">{t('events.noEventsSubtitle')}</Body>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}
