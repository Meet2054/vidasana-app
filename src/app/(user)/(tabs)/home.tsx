import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {View, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import React, {useState, useEffect} from 'react';
import {HomeHeader, H3, Body, CategoryGrid, MoodCheckInModal, FilterModal, ServiceCard, EventCard, FilterState} from '@/components';
import {useUserLocation, useDebouncer} from '@/hooks';
import {useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/utils';
import {useAppStore} from '@/store';
import Toast from 'react-native-toast-message';

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest';
type ExploreMode = 'services' | 'events';

export default function HomeScreen() {
  const {t, i18n} = useTranslation();
  const queryClient = useQueryClient();
  const {user} = useAppStore((s) => s.session!);
  const hasSeenMoodModal = useAppStore((s) => s.hasSeenMoodModal);
  const setHasSeenMoodModal = useAppStore((s) => s.setHasSeenMoodModal);
  const {location: userLocation} = useUserLocation();

  // -- UI State --
  const [activeTab, setActiveTab] = useState<ExploreMode>('services');
  const [searchQuery, setSearchQuery, debouncedSearchQuery] = useDebouncer('', 500);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // -- Filter State (Global) --
  // We share some state but interpret it differently based on activeTab
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [isNearMeEnabled, setIsNearMeEnabled] = useState(true);
  const [radius, setRadius] = useState<number>(50);

  // Specific Filters
  const [selectedDays, setSelectedDays] = useState<string[]>([]); // Services
  const [dateFrom, setDateFrom] = useState<Date | null>(null); // Events
  const [dateTo, setDateTo] = useState<Date | null>(null); // Events

  // Mood Check-in Trigger
  useEffect(() => {
    !hasSeenMoodModal && setTimeout(() => setShowMoodModal(true), 500);
  }, [hasSeenMoodModal]);

  const handleMoodSelect = (moodId: number) => {
    setShowMoodModal(false);
    setHasSeenMoodModal(true);
    // Switch to Services tab for mood recommendations usually?
    setActiveTab('services');
    setSelectedCategories([moodId]);
  };

  // -- Services Query --
  const activeQueryKey = [
    'integrated_search_home',
    activeTab,
    i18n.language,
    debouncedSearchQuery,
    selectedCategories,
    selectedDays,
    dateFrom,
    dateTo,
    userLocation,
    sortBy,
    isNearMeEnabled,
    radius,
  ];

  const activeQuery = useInfiniteQuery({
    queryKey: activeQueryKey,
    initialPageParam: 0,
    queryFn: async ({pageParam = 0}) => {
      const LIMIT = 10;
      const {data: rpcData, error} = await supabase.rpc('integrated_search', {
        p_type: activeTab === 'services' ? 'service' : 'event',
        search_query: debouncedSearchQuery || undefined,
        target_lang: i18n.language,
        category_filter: selectedCategories.length > 0 ? selectedCategories : undefined,
        day_filter: activeTab === 'services' && selectedDays.length > 0 ? selectedDays : undefined,
        date_from: activeTab === 'events' && dateFrom ? dateFrom.toISOString() : undefined,
        date_to: activeTab === 'events' && dateTo ? dateTo.toISOString() : undefined,
        user_lat: userLocation?.latitude || undefined,
        user_lng: userLocation?.longitude || undefined,
        radius_meters: isNearMeEnabled ? radius * 1000 : undefined,
        sort_by: sortBy,
        page_offset: pageParam,
        page_limit: LIMIT,
      });

      if (error) {
        console.error(`Search ${activeTab} Error:`, error);
        throw error;
      }

      return rpcData as unknown as any[];
    },
    getNextPageParam: (lastPage, allPages) => (lastPage.length === 10 ? allPages.length * 10 : undefined),
  });
  const dataList = activeQuery.data?.pages.flatMap((page) => page) || [];

  // Manual Refresh
  const onRefresh = async () => {
    setIsRefreshing(true);
    await activeQuery.refetch();
    setIsRefreshing(false);
  };

  // Filter Apply
  const handleApplyFilters = (filters: FilterState) => {
    setSelectedCategories(filters.categories);
    setSortBy(filters.sortBy);
    setIsNearMeEnabled(filters.isNearMeEnabled);
    setRadius(filters.radius);

    if (activeTab === 'services') {
      setSelectedDays(filters.days);
    } else {
      setDateFrom(filters.dateFrom);
      setDateTo(filters.dateTo);
    }
  };

  const activeFilterCount = (() => {
    let count = 0;
    if (sortBy !== 'relevance') count++;
    if (radius !== 50) count++;
    if (activeTab === 'services' && selectedDays.length > 0) count++;
    if (activeTab === 'events' && (dateFrom || dateTo)) count++;
    // We don't count categories here as they are visible in grid? or maybe we should?
    // Let's count them if selected via modal logic, which syncs with grid.
    if (selectedCategories.length > 0) count++;
    return count;
  })();

  // -- Unified Bookmark Mutation --
  const toggleBookmarkMutation = useMutation({
    mutationFn: async ({itemId, itemType, isBookmarked}: {itemId: string; itemType: 'service' | 'event'; isBookmarked: boolean}) => {
      if (isBookmarked) {
        await supabase.from('bookmark').delete().eq('item_id', itemId).eq('type', itemType).eq('user', user.id);
      } else {
        await supabase.from('bookmark').insert({item_id: itemId, type: itemType, user: user.id});
      }
    },
    onMutate: async ({itemId, isBookmarked}) => {
      await queryClient.cancelQueries({queryKey: activeQueryKey});
      const previousData = queryClient.getQueryData(activeQueryKey);
      queryClient.setQueryData(activeQueryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any[]) => page.map((item: any) => (item.id === itemId ? {...item, is_bookmarked: !isBookmarked} : item))),
        };
      });
      return {previousData};
    },
    onError: (err, variables, context: any) => {
      if (context?.previousData) queryClient.setQueryData(activeQueryKey, context.previousData);
      Toast.show({type: 'error', text1: 'Failed to update bookmark'});
    },
    onSettled: () => queryClient.invalidateQueries({queryKey: activeQueryKey}),
  });

  const renderServiceItem = ({item}: {item: any}) => (
    <View className="px-4">
      <ServiceCard
        id={item.id}
        title={item.title}
        description={item.description}
        price={item.price}
        images={item.images || []}
        distance={item.dist_meters}
        isBookmarked={item.is_bookmarked || false}
        onBookmarkToggle={() => toggleBookmarkMutation.mutate({itemId: item.id, itemType: 'service', isBookmarked: item.is_bookmarked || false})}
        provider={item.provider}
        weekDays={item.week_day}
        rating={item.avg_rating}
      />
    </View>
  );

  type Event = {
    id: string;
    title: string;
    description: string;
    images: string[] | null;
    start_at: string;
    dist_meters?: number;
    price?: number;
    avg_rating?: number;
    provider?: {
      name: string;
      image?: string;
    };
  };

  const renderEventItem = ({item}: {item: any}) => (
    <View className="px-4">
      <EventCard
        id={item.id}
        title={item.title}
        description={item.description}
        price={item.price}
        images={item.images || []}
        startAt={item.start_at}
        distance={item.dist_meters}
        provider={item.provider}
        rating={item.avg_rating}
        isBookmarked={item.is_bookmarked || false}
        onBookmarkToggle={() => toggleBookmarkMutation.mutate({itemId: item.id, itemType: 'event', isBookmarked: item.is_bookmarked || false})}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <HomeHeader onMoodPress={() => setShowMoodModal(true)} />

      <View>
        {/* Tab Selector (Pill Switch) */}
        <View className="mb-4 flex-row justify-center px-4">
          <View className="flex-row rounded-full bg-gray-100 p-1">
            <TouchableOpacity
              onPress={() => setActiveTab('services')}
              className={`rounded-full px-6 py-2 ${activeTab === 'services' ? 'bg-white shadow-sm' : 'shadow-none'}`}>
              <Body className={`font-nunito-bold text-sm ${activeTab === 'services' ? 'text-primary' : 'text-gray-500'}`}>
                {t('common.services', 'Services')}
              </Body>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('events')}
              className={`rounded-full px-6 py-2 ${activeTab === 'events' ? 'bg-white shadow-sm' : 'shadow-none'}`}>
              <Body className={`font-nunito-bold text-sm ${activeTab === 'events' ? 'text-primary' : 'text-gray-500'}`}>
                {t('common.events', 'Events')}
              </Body>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search & Filter Bar */}
        <View className="mb-3 flex-row gap-3 px-4">
          <View className="h-12 flex-1 flex-row items-center rounded-xl border border-gray-100 bg-gray-50 px-4">
            <Feather name="search" size={20} color="#9CA3AF" />
            <TextInput
              className="ml-3 flex-1 font-nunito text-base text-gray-900"
              placeholder={activeTab === 'services' ? t('services.searchPlaceholder') : t('events.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            className={`h-12 w-12 items-center justify-center rounded-xl ${
              activeFilterCount > 0 ? 'border-primary bg-primary' : 'border-gray-100 bg-gray-50'
            } border`}>
            <Feather name="sliders" size={20} color={activeFilterCount > 0 ? 'white' : '#4B5563'} />
            {activeFilterCount > 0 && <View className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
          </TouchableOpacity>
        </View>

        {/* Categories Grid (Single Select for Home) */}
        {/* Note: In future we might want different categories for Events vs Services. 
            Currently categories table is shared. */}
        <CategoryGrid
          selectedCategory={selectedCategories.length > 0 ? selectedCategories[0] : null}
          onSelectCategory={(id) => setSelectedCategories(id ? [id] : [])}
        />

        {/* Results Title */}
        <View className="mb-4 mt-6 flex-row items-center justify-between px-4">
          <H3 className="text-lg text-black">
            {searchQuery || selectedCategories.length > 0 || activeFilterCount > 0
              ? t('services.results', 'Results')
              : t('services.recommended', 'Recommended for you')}
          </H3>
        </View>
      </View>

      {/* List Content */}
      <FlatList
        data={dataList}
        renderItem={activeTab === 'services' ? renderServiceItem : renderEventItem}
        keyExtractor={(item: any) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 100}}
        onEndReached={() => {
          if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
            activeQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#00594f" />}
        ListFooterComponent={activeQuery.isFetchingNextPage ? <ActivityIndicator size="small" color="#00594f" className="my-4" /> : null}
        ListEmptyComponent={
          !activeQuery.isLoading ? (
            <View className="items-center justify-center py-20">
              <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-gray-50">
                <Feather name={activeTab === 'services' ? 'search' : 'calendar'} size={32} color="#D1D5DB" />
              </View>
              <H3 className="text-lg text-gray-900">{activeTab === 'services' ? t('services.noServices') : t('events.noEvents')}</H3>
              <Body className="mt-1 text-sm text-gray-500">Try adjusting your filters</Body>
            </View>
          ) : (
            <ActivityIndicator size="large" color="#00594f" className="mt-20" />
          )
        }
      />

      <MoodCheckInModal visible={showMoodModal} onClose={() => setShowMoodModal(false)} onMoodSelect={handleMoodSelect} />

      <FilterModal
        visible={isFilterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApply={handleApplyFilters}
        // Dynamically pass filters based on active tab
        initialFilters={{
          categories: selectedCategories,
          days: selectedDays,
          dateFrom,
          dateTo,
          sortBy,
          isNearMeEnabled,
          radius,
        }}
        userLocation={userLocation}
        mode={activeTab === 'services' ? 'service' : 'event'}
      />
    </SafeAreaView>
  );
}
