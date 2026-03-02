import React, {useState, useEffect} from 'react';
import {Modal, View, TouchableOpacity, ScrollView, Image} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/utils';
import {Subtitle, Body, Caption, H2} from '../Typography';
import Slider from '@react-native-community/slider';

// Types
type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

export interface FilterState {
  categories: number[];
  days: string[];
  dateFrom: Date | null;
  dateTo: Date | null;
  sortBy: SortOption;
  isNearMeEnabled: boolean;
  radius: number; // radius in km
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters: FilterState;
  userLocation: {latitude: number; longitude: number} | null;
  mode?: 'service' | 'event';
}

export function FilterModal({visible, onClose, onApply, initialFilters, userLocation, mode = 'service'}: FilterModalProps) {
  const {t} = useTranslation();

  // Local State
  const [localFilters, setLocalFilters] = useState<FilterState>(initialFilters);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [activeDateField, setActiveDateField] = useState<'from' | 'to' | null>(null);

  // Sync with props when modal opens
  useEffect(() => {
    if (visible) {
      setLocalFilters(initialFilters);
    }
  }, [visible, initialFilters]);

  // -- Data Fetching (Categories) --
  // We can fetch here or accept as props. Fetching here keeps it self-contained.
  const {data: categories} = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const {data, error} = await supabase.from('categories').select('*').eq('status', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  // -- Handlers --
  const toggleCategory = (id: number) => {
    setLocalFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(id) ? prev.categories.filter((c) => c !== id) : [...prev.categories, id],
    }));
  };

  const toggleDay = (day: string) => {
    setLocalFilters((prev) => ({...prev, days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day]}));
  };

  const handleDateConfirm = (date: Date) => {
    if (activeDateField === 'from') {
      setLocalFilters((prev) => ({...prev, dateFrom: date}));
    } else if (activeDateField === 'to') {
      setLocalFilters((prev) => ({...prev, dateTo: date}));
    }
    setDatePickerVisible(false);
    setActiveDateField(null);
  };

  const clearFilters = () =>
    setLocalFilters({
      days: [],
      categories: [],
      sortBy: 'relevance',
      isNearMeEnabled: true, // Reset should ideally keep it enabled based on screen logic, or true by default
      radius: 50,
      dateFrom: null,
      dateTo: null,
    });

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="h-[85%] rounded-t-3xl bg-white">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-gray-100 p-6">
            <H2 className="text-xl text-gray-900">{t('services.filters', 'Filters & Sort')}</H2>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6">
            {/* Radius Slider (Always Visible) */}
            <View className="mt-4 rounded-2xl bg-gray-50 p-4">
              <View className="mb-1 flex-row items-center justify-between">
                <Subtitle className="text-lg font-medium text-gray-900">Distance</Subtitle>
                <Body className="text-sm font-bold text-primary">{localFilters.radius} km</Body>
              </View>

              <View className="flex-row items-center">
                <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-white">
                  <Feather name="map-pin" size={16} color="#00594f" />
                </View>
                <Slider
                  step={5}
                  minimumValue={5}
                  maximumValue={100}
                  thumbTintColor="#00594f"
                  value={localFilters.radius}
                  minimumTrackTintColor="#00594f"
                  maximumTrackTintColor="#d1d5db"
                  style={{flex: 1, height: 30}}
                  onValueChange={(val) => setLocalFilters((prev) => ({...prev, radius: val, isNearMeEnabled: true}))}
                />
              </View>

              <View className="ml-11 flex-row justify-between">
                <Caption className="text-xs text-gray-400">5km</Caption>
                <Caption className="text-xs text-gray-400">100km</Caption>
              </View>
            </View>

            {/* Sort By */}
            <View className="mt-6">
              <Subtitle className="mb-3 text-base font-bold text-gray-900">{t('services.sortBy', 'Sort By')}</Subtitle>
              <View className="flex-row flex-wrap gap-2">
                {[
                  {id: 'relevance', label: t('services.relevance', 'Relevance'), icon: 'list'},
                  {id: 'price_asc', label: t('services.priceLow', 'Price: Low to High'), icon: 'trending-up'},
                  {id: 'price_desc', label: t('services.priceHigh', 'Price: High to Low'), icon: 'trending-down'},
                  {id: 'newest', label: t('services.newest', 'Newest'), icon: 'clock'},
                ].map((option) => {
                  const isSelected = localFilters.sortBy === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => setLocalFilters((prev) => ({...prev, sortBy: option.id as SortOption}))}
                      className={`flex-row items-center rounded-full border px-4 py-2.5 ${
                        isSelected ? 'border-primary bg-primary' : 'border-gray-200 bg-white'
                      }`}>
                      <Feather name={option.icon as any} size={16} color={isSelected ? 'white' : '#4B5563'} className="mr-2" />
                      <Body className={`font-nunito-bold text-sm ${isSelected ? 'text-white' : 'text-gray-700'}`}>{option.label}</Body>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Day Filter (Service Only) */}
            {mode === 'service' && (
              <View className="mt-6">
                <Subtitle className="mb-3 text-base font-bold text-gray-900">{t('services.filterByDay', 'Day of Week')}</Subtitle>
                <View className="flex-row flex-wrap gap-2">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                    const isSelected = localFilters.days.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        onPress={() => toggleDay(day)}
                        className={`flex-row items-center rounded-full border px-4 py-2.5 ${
                          isSelected ? 'border-primary bg-primary' : 'border-gray-200 bg-white'
                        }`}>
                        <Feather name="calendar" size={16} color={isSelected ? 'white' : '#4B5563'} className="mr-2" />
                        <Body className={`font-nunito-bold text-sm  capitalize ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                          {day.substring(0, 3)}
                        </Body>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Date Range Filter (Event Only) */}
            {mode === 'event' && (
              <View className="mt-6">
                <Subtitle className="mb-3 text-base font-bold text-gray-900">{t('events.dateRange', 'Date Range')}</Subtitle>
                <View className="flex-row gap-4">
                  <TouchableOpacity
                    className="flex-1 rounded-2xl border border-gray-200 bg-white p-3"
                    onPress={() => {
                      setActiveDateField('from');
                      setDatePickerVisible(true);
                    }}>
                    <Caption className="text-xs text-gray-500">From</Caption>
                    <Body className="font-nunito-bold text-gray-900">
                      {localFilters.dateFrom ? localFilters.dateFrom.toLocaleDateString() : 'Select Date'}
                    </Body>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 rounded-2xl border border-gray-200 bg-white p-3"
                    onPress={() => {
                      setActiveDateField('to');
                      setDatePickerVisible(true);
                    }}>
                    <Caption className="text-xs text-gray-500">To</Caption>
                    <Body className="font-nunito-bold text-gray-900">
                      {localFilters.dateTo ? localFilters.dateTo.toLocaleDateString() : 'Select Date'}
                    </Body>
                  </TouchableOpacity>
                </View>
                {(localFilters.dateFrom || localFilters.dateTo) && (
                  <TouchableOpacity onPress={() => setLocalFilters((prev) => ({...prev, dateFrom: null, dateTo: null}))} className="mt-2 self-end">
                    <Caption className="font-nunito-bold text-xs text-secondary">Clear Dates</Caption>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Categories */}
            <View className="mb-10 mt-6">
              <Subtitle className="mb-3 text-base font-bold text-gray-900">{t('services.categories', 'Categories')}</Subtitle>
              <View className="flex-row flex-wrap gap-2">
                <TouchableOpacity
                  onPress={() => setLocalFilters((prev) => ({...prev, categories: []}))}
                  className={`flex-row items-center rounded-full border px-4 py-2.5 ${
                    localFilters.categories.length === 0 ? 'border-primary bg-primary' : 'border-gray-200 bg-white'
                  }`}>
                  <View className="mr-2 h-5 w-5 items-center justify-center">
                    <Feather name="grid" size={16} color={localFilters.categories.length === 0 ? 'white' : '#4B5563'} />
                  </View>
                  <Body className={`font-nunito-bold text-sm ${localFilters.categories.length === 0 ? 'text-white' : 'text-gray-700'}`}>
                    {t('common.all', 'All')}
                  </Body>
                </TouchableOpacity>
                {categories?.map((cat: any) => {
                  const isSelected = localFilters.categories.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => toggleCategory(cat.id)}
                      className={`flex-row items-center rounded-full border px-4 py-2.5 ${
                        isSelected ? 'border-primary bg-primary' : 'border-gray-200 bg-white'
                      }`}>
                      <View className="mr-2 h-5 w-5 items-center justify-center">
                        {cat.icon ? (
                          <Image
                            source={{uri: cat.icon}}
                            className="h-full w-full"
                            resizeMode="contain"
                            tintColor={isSelected ? 'white' : undefined}
                          />
                        ) : (
                          <Feather name="circle" size={16} color={isSelected ? 'white' : '#4B5563'} />
                        )}
                      </View>
                      <Body className={`font-nunito-bold text-sm ${isSelected ? 'text-white' : 'text-gray-700'}`}>{cat.name}</Body>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View className="flex-row gap-3 border-t border-gray-100 bg-white p-6 pb-10">
            <TouchableOpacity onPress={clearFilters} className="flex-1 items-center justify-center rounded-2xl bg-gray-100 py-4">
              <Body className="font-nunito font-bold text-gray-700">{t('common.reset', 'Reset')}</Body>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApply}
              className="flex-1 items-center justify-center rounded-2xl bg-primary py-4 shadow-lg shadow-green-200">
              <Body className="font-nunito text-lg font-bold text-white">{t('common.showResults', 'Show Results')}</Body>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleDateConfirm}
        onCancel={() => {
          setDatePickerVisible(false);
          setActiveDateField(null);
        }}
        textColor="black"
      />
    </Modal>
  );
}
