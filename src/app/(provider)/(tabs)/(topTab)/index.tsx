import {Link} from 'expo-router';
import {supabase} from '@/utils/supabase';
import {Feather} from '@expo/vector-icons';
import {useQuery} from '@tanstack/react-query';
import {ActivityIndicator, FlatList, Pressable, RefreshControl, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAppStore} from '@/store';
import {H3, Body, ServiceCard} from '@/components';

export default function ServicesScreen() {
  const {t, i18n} = useTranslation();
  const {user} = useAppStore((s) => s.session!);

  const {
    data: services,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['services', i18n.language],
    queryFn: async () => {
      const {data, error} = await supabase.from('services').select('*').eq('provider', user.id).order('created_at', {ascending: false});

      if (error) throw error;

      return data;
    },
  });

  const renderItem = ({item}: {item: any}) => {
    return (
      <ServiceCard
        id={item.id}
        title={item.title}
        description={item.description}
        price={item.price}
        images={item.images}
        weekDays={item.week_day}
        isBookmarked={false} // Provider doesn't need to bookmark own services
        onBookmarkToggle={() => {}}
        rating={item.rating || 0} // Assuming rating exists now or is 0
        variant="provider"
        isActive={item.active}
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
            data={services}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingBottom: 100}}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
            ListEmptyComponent={() => (
              <View className="mt-20 items-center justify-center">
                <View className="mb-4 h-24 w-24 items-center justify-center rounded-full bg-gray-50">
                  <Feather name="briefcase" size={40} color="#D1D5DB" />
                </View>
                <H3 className="mb-2 text-lg text-gray-900">{t('services.noServices')}</H3>
                <Body className="mb-6 text-center text-gray-500">{t('services.noServicesSubtitle')}</Body>
              </View>
            )}
          />
        )}
      </View>

      {/* FAB */}
      <Link href="/(provider)/services/create" asChild>
        <Pressable className="absolute bottom-6 h-14 w-14 items-center justify-center self-center rounded-full bg-primary shadow-lg">
          <Feather name="plus" size={30} color="white" />
        </Pressable>
      </Link>
    </View>
  );
}
