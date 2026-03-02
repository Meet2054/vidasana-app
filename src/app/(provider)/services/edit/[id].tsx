import React, {useState} from 'react';
import {View, ScrollView, TouchableOpacity, TextInput} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useForm, Controller, type FieldErrors} from 'react-hook-form';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Feather} from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import Toast from 'react-native-toast-message';
import {supabase, uploadFile, parseLocation} from '@/utils';
import {useAppStore} from '@/store';
import {Enums} from '@/types';
import {useTranslation} from 'react-i18next';
import {ServiceFormValues, UnifiedImage} from '@/types/service';
import {getDays} from '@/constants';
import {H2, Body, Caption, Loader, ImageInput, LocationInput} from '@/components';

// Types

type WeekDay = Enums<'week_day'>;

export default function EditServiceScreen() {
  const router = useRouter();
  const {t} = useTranslation();
  const {id} = useLocalSearchParams<{id: string}>();
  const queryClient = useQueryClient();

  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState<'start_at' | 'end_at' | null>(null);

  // Track initial images to calculate deletions
  const [initialImages, setInitialImages] = useState<UnifiedImage[]>([]);

  const {
    watch,
    reset,
    control,
    setValue,
    handleSubmit,
    formState: {errors},
  } = useForm<ServiceFormValues>({
    defaultValues: {
      title: '',
      description: '',
      category: null,
      price: '',
      capacity: '',
      start_at: null,
      end_at: null,
      week_day: [],
      images: [],
      lat: null,
      lng: null,
      address: '',
    },
  });

  const selectedImages = watch('images');

  // 1. Fetch Categories
  const {data: categories} = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const {data, error} = await supabase.from('categories').select('*').eq('status', true);
      if (error) throw error;
      return data;
    },
  });

  // 2. Fetch Service Details & Pre-fill
  const {isLoading: isLoadingService} = useQuery({
    queryKey: ['service', id],
    queryFn: async () => {
      if (!id) throw new Error('No ID provided');
      const {data, error} = await supabase.from('services').select(`*, categories(*)`).eq('id', id).single();

      if (error) throw error;

      // Transform Data for Form
      const loadedImages: UnifiedImage[] = (data.images || []).map((path: string) => ({
        id: path,
        path: path,
        type: 'existing',
        uri: supabase.storage.from('images').getPublicUrl(path).data.publicUrl,
      }));

      setInitialImages(loadedImages);

      // Helper to parse "HH:MM:SS" to Date
      const parseTime = (timeStr: string | null) => {
        if (!timeStr) return null;
        const d = new Date();
        const [h, m, s] = timeStr.split(':');
        d.setHours(parseInt(h), parseInt(m), parseInt(s || '0'));
        return d;
      };

      console.log('🚀 ~ EditServiceScreen ~ data:', data);

      // Parse location safely
      const parsedLocation = parseLocation(data.location);

      reset({
        title: data.title || '',
        description: data.description || '',
        category: data.category,
        price: data.price?.toString() ?? '',
        capacity: data.capacity?.toString() ?? '',
        start_at: parseTime(data.start_at),
        end_at: parseTime(data.end_at),
        week_day: (data.week_day || []) as WeekDay[],
        images: loadedImages,
        lat: parsedLocation.lat,
        lng: parsedLocation.lng,
        address: data.address || '',
      });

      return data;
    },
    enabled: !!id,
  });

  // 3. Update Service Mutation
  const {mutate, isPending} = useMutation({
    mutationFn: async (data: ServiceFormValues) => {
      const {user} = useAppStore.getState().session!;
      if (!user) throw new Error('Authenticated user required');

      // A. Upload New Images
      const finalImagePaths: string[] = [];

      // First, keep existing images that are still in the form
      for (const img of data.images) {
        if (img.type === 'existing' && img.path) {
          finalImagePaths.push(img.path);
        } else if (img.type === 'new' && img.file) {
          // Upload new
          const fileExt = img.file.uri.split('.').pop();
          const fileName = `${user.id}/${Date.now()}_${String(Math.random()).slice(2, 7)}.${fileExt}`;
          const {data: uploadData, error: uploadError} = await uploadFile(img.file, 'images', fileName);
          if (uploadError) throw uploadError;
          if (uploadData?.path) finalImagePaths.push(uploadData.path);
        }
      }

      // B. Update Database Record
      const {error: updateError} = await supabase
        .from('services')
        .update({
          title: data.title,
          description: data.description,
          category: data.category!,
          price: parseFloat(data.price),
          capacity: parseInt(data.capacity),
          start_at: data.start_at!.toLocaleTimeString('en-US', {hour12: false}),
          end_at: data.end_at!.toLocaleTimeString('en-US', {hour12: false}),
          week_day: data.week_day,
          images: finalImagePaths,
          location: data.lat && data.lng ? `POINT(${data.lng} ${data.lat})` : null,
          address: data.address,
        })
        .eq('id', id as string);

      if (updateError) throw updateError;

      // D. Delete Removed Images from Bucket (Cleanup)
      // Find paths present in initialImages but NOT in finalImagePaths
      const pathsToDelete = initialImages.filter((initImg) => initImg.path && !finalImagePaths.includes(initImg.path)).map((img) => img.path!);

      if (pathsToDelete.length > 0) {
        const {error: deleteError} = await supabase.storage.from('images').remove(pathsToDelete);
        if (deleteError) console.error('Failed to cleanup images:', deleteError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['service', id]});
      queryClient.invalidateQueries({queryKey: ['services']});
      Toast.show({type: 'success', text1: 'Service Updated'});
      router.back();
    },
    onError: (err: any) => Toast.show({type: 'error', text1: 'Update Failed', text2: err.message}),
  });

  const onInvalid = (errors: FieldErrors<ServiceFormValues>) => {};

  const handleConfirmTime = (date: Date) => {
    if (activeTimeField) setValue(activeTimeField, date, {shouldValidate: true});
    setTimePickerVisible(false);
    setActiveTimeField(null);
  };

  const toggleWeekDay = (day: WeekDay) => {
    const current = watch('week_day');
    if (current.includes(day)) {
      setValue(
        'week_day',
        current.filter((d) => d !== day),
        {shouldValidate: true}
      );
    } else {
      setValue('week_day', [...current, day], {shouldValidate: true});
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="mb-6 flex-row items-center border-b border-gray-100 p-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 rounded-full bg-gray-100 p-2">
          <Feather name="arrow-left" size={24} color="black" />
        </TouchableOpacity>
        <H2 className="text-gray-900">{t('services.updateTitle')}</H2>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Title */}
        <View className="mb-4">
          <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('services.serviceTitlePlaceholder', 'Service Title')}</Body>
          <Controller
            control={control}
            name="title"
            rules={{required: 'Title is required'}}
            render={({field: {onChange, value}, fieldState: {error}}) => (
              <>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder={t('services.serviceTitlePlaceholder', 'Service Title')}
                  className="rounded-lg border border-gray-300 bg-white p-3 font-nunito"
                />
                {error?.message && <Caption className="mt-1 text-red-500">{error.message}</Caption>}
              </>
            )}
          />
        </View>

        {/* Description */}
        <View className="mb-4">
          <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.descriptionPlaceholder', 'Description')}</Body>
          <Controller
            control={control}
            name="description"
            render={({field: {onChange, value}}) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder={t('events.descriptionPlaceholder', 'Description')}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="rounded-lg border border-gray-300 bg-white p-3 font-nunito"
              />
            )}
          />
        </View>

        {/* Images */}
        <ImageInput control={control} name="images" label={t('events.images')} />

        {/* Category */}
        <View className="mb-4">
          <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.category')}</Body>
          <Controller
            control={control}
            name="category"
            rules={{required: 'Category is required'}}
            render={({field: {onChange, value}, fieldState: {error}}) => (
              <>
                <View className="flex-row flex-wrap gap-2">
                  {categories?.map((cat) => {
                    const isSelected = value === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => onChange(cat.id)}
                        className={`rounded-full border px-4 py-2 ${isSelected ? 'border-primary bg-primary' : 'border-gray-300 bg-white'}`}>
                        <Body className={`font-nunito-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>{cat.name}</Body>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {error?.message && <Caption className="mt-1 text-red-500">{error.message}</Caption>}
              </>
            )}
          />
        </View>

        {/* Location Selection */}
        <LocationInput control={control} setValue={setValue} watch={watch} label={t('events.location')} />

        {/* Price & Capacity */}
        <View className="mb-4 flex-row justify-between gap-4">
          <View className="flex-1">
            <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.price')}</Body>
            <Controller
              control={control}
              rules={{required: t('validation.required')}}
              name="price"
              render={({field: {onChange, value}, fieldState: {error}}) => (
                <>
                  <View className="flex-row items-center rounded-lg border border-gray-300 bg-white px-3">
                    <Body className="mr-1 text-gray-500">$</Body>
                    <TextInput className="flex-1 py-3 font-nunito" keyboardType="numeric" value={value} onChangeText={onChange} />
                  </View>
                  {error?.message && <Caption className="mt-1 text-red-500">{error.message}</Caption>}
                </>
              )}
            />
          </View>
          <View className="flex-1">
            <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.capacity')}</Body>
            <Controller
              control={control}
              rules={{required: t('validation.required')}}
              name="capacity"
              render={({field: {onChange, value}, fieldState: {error}}) => (
                <>
                  <TextInput
                    value={value}
                    keyboardType="numeric"
                    onChangeText={onChange}
                    className="rounded-lg border border-gray-300 bg-white p-3 font-nunito"
                  />
                  {error?.message && <Caption className="mt-1 text-red-500">{error.message}</Caption>}
                </>
              )}
            />
          </View>
        </View>

        {/* Time */}
        <View className="mb-4 flex-row justify-between gap-4">
          {['start_at', 'end_at'].map((key) => (
            <View key={key} className="flex-1">
              <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{key === 'start_at' ? t('events.startTime') : t('events.endTime')}</Body>
              <Controller
                control={control}
                name={key as any}
                rules={{required: 'Required'}}
                render={({field: {value}, fieldState: {error}}) => (
                  <TouchableOpacity
                    onPress={() => {
                      setActiveTimeField(key as any);
                      setTimePickerVisible(true);
                    }}
                    className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white p-3">
                    <Body className={`${value ? 'text-gray-900' : 'text-gray-400'}`}>
                      {value instanceof Date
                        ? value.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
                        : key === 'start_at'
                          ? t('events.selectStart')
                          : t('events.selectEnd')}
                    </Body>
                    <Feather name="clock" size={18} color="gray" />
                  </TouchableOpacity>
                )}
              />
            </View>
          ))}
        </View>

        {/* Days */}
        <View className="mb-6">
          <Body className="mb-2 font-nunito-bold text-sm text-gray-700">{t('services.availableDays')}</Body>
          <Controller
            name="week_day"
            control={control}
            rules={{validate: (val) => val.length > 0 || 'Required'}}
            render={({field: {value}, fieldState: {error}}) => (
              <>
                <View className="flex-row flex-wrap justify-between">
                  {getDays(t).map((day) => {
                    const isSelected = value?.includes(day.value);
                    return (
                      <TouchableOpacity
                        key={day.value}
                        onPress={() => toggleWeekDay(day.value)}
                        className={`mb-2 h-10 w-10 items-center justify-center rounded-full ${isSelected ? 'bg-primary' : 'bg-gray-100'}`}>
                        <Body className={`font-nunito-bold text-xs ${isSelected ? 'text-white' : 'text-gray-600'}`}>{day.label}</Body>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {error?.message && <Caption className="mt-1 text-red-500">{error?.message}</Caption>}
              </>
            )}
          />
        </View>

        <TouchableOpacity
          disabled={isPending}
          onPress={handleSubmit((data) => mutate(data), onInvalid)}
          className="mb-10 items-center rounded-lg bg-primary p-4">
          <Body className="font-nunito-bold text-lg text-white">{t('services.updateButton')}</Body>
        </TouchableOpacity>
      </ScrollView>
      <DateTimePickerModal mode="time" isVisible={isTimePickerVisible} onConfirm={handleConfirmTime} onCancel={() => setTimePickerVisible(false)} />
      <Loader visible={isLoadingService || isPending} />
    </SafeAreaView>
  );
}
