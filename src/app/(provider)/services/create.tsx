import {Feather, Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {supabase, uploadFile} from '@/utils';
import {useAppStore} from '@/store';
import {useForm, Controller, type FieldErrors} from 'react-hook-form';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {useRouter} from 'expo-router';
import {View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import React, {useState} from 'react';
import Toast from 'react-native-toast-message';
import {ServiceFormValues, WeekDay} from '@/types/service';
import {getDays} from '@/constants';
import {useTranslation} from 'react-i18next';
import {H2, Body, Caption, ImageInput, LocationInput} from '@/components';
import {useStripeStatus} from '@/hooks';

export default function CreateServiceScreen() {
  const router = useRouter();
  const {t} = useTranslation();
  const queryClient = useQueryClient();
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState<'start_at' | 'end_at' | null>(null);

  const {data: stripeStatus, isLoading: isCheckingStripe} = useStripeStatus();

  const {
    watch,
    control,
    setValue,
    handleSubmit,
    formState: {errors, isSubmitting},
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
      lng: null,
      address: '',
    },
  });

  // Fetch Categories
  const {data: categories, isLoading: isLoadingCategories} = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const {data, error} = await supabase.from('categories').select('*').eq('status', true);
      if (error) throw error;
      return data;
    },
  });

  // Create Service Mutation
  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceFormValues) => {
      // 1. Get Current User
      const {user} = useAppStore.getState().session!;
      if (!user) throw new Error('User not authenticated');

      // 2. Upload Images
      const uploadedImagePaths: string[] = [];
      for (const image of data.images) {
        if (image.type === 'new' && image.file) {
          const fileExt = image.uri.split('.').pop();
          const fileName = `${user.id}/${Date.now()}_${String(Math.random()).slice(2, 7)}.${fileExt}`;
          const {data: uploadData, error: uploadError} = await uploadFile(image.file, 'images', fileName);

          if (uploadError) throw uploadError;
          if (uploadData?.path) uploadedImagePaths.push(uploadData.path);
        }
      }

      // 3. Insert Service (Base Data)
      const createPayload: any = {
        title: data.title,
        description: data.description,
        capacity: parseInt(data.capacity),
        category: data.category!,
        end_at: data.end_at!.toLocaleTimeString('en-US', {hour12: false}),
        price: parseFloat(data.price),
        start_at: data.start_at!.toLocaleTimeString('en-US', {hour12: false}),
        week_day: data.week_day,
        location: data.lat && data.lng ? `POINT(${data.lng} ${data.lat})` : null,
        address: data.address,
      };

      if (uploadedImagePaths.length > 0) createPayload.images = uploadedImagePaths;

      const {data: serviceData, error: insertError} = await supabase.from('services').insert(createPayload).select().single();

      if (insertError) throw insertError;
      if (!serviceData) throw new Error('Failed to create service');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['services']});
      Toast.show({type: 'success', text1: 'Success', text2: 'Service created successfully!'});
      router.back();
    },
    onError: (error: any) => {
      console.error(error);
      Toast.show({type: 'error', text1: 'Error', text2: error.message || 'Failed to create service'});
    },
  });

  const onInvalid = (errors: FieldErrors<ServiceFormValues>) => {
    Toast.show({type: 'error', text1: 'Validation Error', text2: 'Please check the form for errors.'});
  };

  const onSubmit = (data: ServiceFormValues) => {
    const isPaidService = (parseFloat(data.price) || 0) > 0;

    if (isPaidService && !isCheckingStripe && !stripeStatus?.isConnected) {
      Alert.alert(
        t('stripe.notConnectedTitle', 'Stripe Not Connected'),
        t(
          'stripe.notConnectedMessage',
          'You must connect your bank account via Stripe before you can create paid services so you can receive payouts.'
        ),
        [
          {text: t('common.cancel', 'Cancel'), style: 'cancel'},
          {text: t('stripe.connectNow', 'Connect Stripe'), onPress: () => router.push('/(provider)/payment-setup')},
        ]
      );
      return;
    }

    createServiceMutation.mutate(data);
  };

  // Time Picker Logic
  const handleConfirmTime = (date: Date) => {
    if (activeTimeField) setValue(activeTimeField, date, {shouldValidate: true});
    setTimePickerVisible(false);
    setActiveTimeField(null);
  };

  // Weekday Logic
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
      <DateTimePickerModal mode="time" onConfirm={handleConfirmTime} isVisible={!!isTimePickerVisible} onCancel={() => setTimePickerVisible(false)} />

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        <View className="mb-6 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4 rounded-full bg-gray-100 p-2">
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <H2 className="text-gray-900">{t('services.createTitle')}</H2>
        </View>

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
          {isLoadingCategories ? (
            <ActivityIndicator size="small" />
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {categories?.map((cat) => {
                const isSelected = watch('category') === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setValue('category', cat.id, {shouldValidate: true})}
                    className={`rounded-full border px-4 py-2 ${isSelected ? 'border-primary bg-primary' : 'border-gray-300 bg-white'}`}>
                    <Body className={`font-nunito-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>{cat.name}</Body>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <Controller control={control} name="category" rules={{required: 'Category is required'}} render={() => <></>} />
          {errors.category && <Caption className="mt-1 text-red-500">{errors.category.message}</Caption>}
        </View>

        {/* Location Selection */}
        <LocationInput control={control} setValue={setValue} watch={watch} label="Location" error={errors.lat ? 'Location is required' : undefined} />

        {/* Price & Capacity Row */}
        <View className="mb-4 flex-row justify-between gap-4">
          <View className="flex-1">
            <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.price')}</Body>
            <Controller
              control={control}
              rules={{required: t('validation.required')}}
              name="price"
              render={({field: {onChange, value}}) => (
                <View className="flex-row items-center rounded-lg border border-gray-300 bg-white px-3">
                  <Body className="mr-1 text-gray-500">$</Body>
                  <TextInput className="flex-1 py-3 font-nunito" placeholder="0.00" keyboardType="numeric" value={value} onChangeText={onChange} />
                </View>
              )}
            />
            {errors.price && <Caption className="mt-1 text-red-500">{errors.price.message}</Caption>}
          </View>

          <View className="flex-1">
            <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.capacity')}</Body>
            <Controller
              control={control}
              rules={{required: t('validation.required')}}
              name="capacity"
              render={({field: {onChange, value}}) => (
                <TextInput
                  value={value}
                  placeholder="e.g. 10"
                  keyboardType="numeric"
                  onChangeText={onChange}
                  className="rounded-lg border border-gray-300 bg-white p-3 font-nunito"
                />
              )}
            />
            {errors.capacity && <Caption className="mt-1 text-red-500">{errors.capacity.message}</Caption>}
          </View>
        </View>

        {/* Time Row */}
        <View className="mb-4 flex-row justify-between gap-4">
          <View className="flex-1">
            <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.startTime')}</Body>
            <Controller
              name="start_at"
              control={control}
              rules={{required: 'Start time required'}}
              render={({field: {value}, fieldState: {error}}) => (
                <View className="flex-1">
                  <TouchableOpacity
                    onPress={() => {
                      setActiveTimeField('start_at');
                      setTimePickerVisible(true);
                    }}
                    className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white p-3">
                    <Body className={`font-nunito ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                      {value?.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) || t('events.selectStart')}
                    </Body>
                    <Feather name="clock" size={18} color="gray" />
                  </TouchableOpacity>
                  {error?.message && <Caption className="mt-1 text-red-500">{error?.message}</Caption>}
                </View>
              )}
            />
          </View>

          <View className="flex-1">
            <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.endTime')}</Body>
            <Controller
              control={control}
              name="end_at"
              rules={{required: 'End time required'}}
              render={({field: {value}, fieldState: {error}}) => (
                <View className="flex-1">
                  <TouchableOpacity
                    onPress={() => {
                      setActiveTimeField('end_at');
                      setTimePickerVisible(true);
                    }}
                    className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white p-3">
                    <Body className={`font-nunito ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                      {value?.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) || t('events.selectEnd')}
                    </Body>
                    <Feather name="clock" size={18} color="gray" />
                  </TouchableOpacity>
                  {error?.message && <Caption className="mt-1 text-red-500">{error?.message}</Caption>}
                </View>
              )}
            />
          </View>
        </View>

        {/* Week Days */}
        <View className="mb-6">
          <Body className="mb-2 font-nunito-bold text-sm text-gray-700">{t('services.availableDays')}</Body>

          <Controller
            name="week_day"
            control={control}
            rules={{validate: (val) => val.length > 0 || 'Select at least one day'}}
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
                        <Body className={`font-nunito-bold ${isSelected ? 'text-white' : 'text-gray-600'}`}>{day.label}</Body>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {error?.message && <Caption className="mt-1 text-red-500">{error?.message}</Caption>}
              </>
            )}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit(onSubmit, onInvalid)}
          disabled={createServiceMutation.isPending || isSubmitting}
          className={`mb-10 items-center rounded-lg p-4 ${createServiceMutation.isPending ? 'bg-gray-400' : 'bg-primary'}`}>
          {createServiceMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Body className="font-nunito-bold text-lg text-white">{t('services.createButton')}</Body>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
