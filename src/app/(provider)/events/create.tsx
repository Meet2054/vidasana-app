import {Feather, Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {supabase, uploadFile} from '@/utils';
import {useAppStore} from '@/store';
import {useForm, Controller} from 'react-hook-form';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {useRouter} from 'expo-router';
import {View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import React, {useState} from 'react';
import Toast from 'react-native-toast-message';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {useTranslation} from 'react-i18next';
import {H2, Body, Caption, ImageInput, LocationInput} from '@/components';
import {EventFormValues} from '@/types';
import {useStripeStatus} from '@/hooks';

export default function CreateEventScreen() {
  const {back, navigate} = useRouter();
  const {t} = useTranslation();
  const queryClient = useQueryClient();
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState<'start_at' | 'end_at' | 'book_till' | null>(null);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time' | 'datetime'>('datetime');

  const {data: stripeStatus, isLoading: isCheckingStripe} = useStripeStatus();

  const {
    watch,
    control,
    setValue,
    handleSubmit,
    formState: {errors, isSubmitting},
  } = useForm<EventFormValues>({
    defaultValues: {
      title: '',
      description: '',
      category: null,
      start_at: null,
      end_at: null,
      book_till: null,
      images: [],
      ticket_types: [{name: 'General', price: '', capacity: ''}], // Start with one default
      lat: null,
      lng: null,
      address: '',
    },
  });

  const ticketTypes = watch('ticket_types');

  // Fetch Categories
  const {data: categories, isLoading: isLoadingCategories} = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const {data, error} = await supabase.from('categories').select('*').eq('status', true);
      if (error) throw error;
      return data;
    },
  });

  // Create Event Mutation
  const {mutate, isPending} = useMutation({
    mutationFn: async (data: EventFormValues) => {
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
          if (uploadData?.path) {
            uploadedImagePaths.push(uploadData.path);
          }
        }
      }

      // 3. Insert Event (Base Data)
      const {data: eventData, error: insertError} = await supabase
        .from('events')
        .insert({
          title: data.title,
          description: data.description,
          category: data.category!,
          start_at: data.start_at!.toISOString(),
          end_at: data.end_at!.toISOString(),
          book_till: data.book_till ? data.book_till.toISOString() : null,
          images: uploadedImagePaths,
          provider: user.id,
          location: data.lat && data.lng ? `POINT(${data.lng} ${data.lat})` : null,
          address: data.address,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      if (!eventData) throw new Error('Failed to create event record');

      // 5. Insert Ticket Types
      if (data.ticket_types.length > 0) {
        const ticketsToInsert = data.ticket_types.map((ticket) => ({
          event_id: eventData.id,
          name: ticket.name,
          price: parseFloat(ticket.price) || 0,
          capacity: parseInt(ticket.capacity),
        }));

        const {error: ticketsError} = await supabase.from('event_ticket_types').insert(ticketsToInsert);
        if (ticketsError) {
          // Ideally we would rollback event here, but for MVP we'll just throw
          throw new Error(`Event created but tickets failed: ${ticketsError.message}`);
        }
      }
    },
    onSuccess: () => {
      Toast.show({type: 'success', text1: 'Success', text2: 'Event created successfully!'});
      queryClient.invalidateQueries({queryKey: ['events']});
      back();
    },
    onError: (error: any) => {
      console.error(error);
      Toast.show({type: 'error', text1: 'Error', text2: error.message || 'Failed to create event'});
    },
  });

  const onInvalid = (errors: any) => {
    Toast.show({type: 'error', text1: 'Validation Error', text2: 'Please check the form for errors.'});
  };

  const onSubmit = (data: EventFormValues) => {
    const hasPaidTicket = data.ticket_types.some((ticket) => (parseFloat(ticket.price) || 0) > 0);

    if (hasPaidTicket && !isCheckingStripe && !stripeStatus?.isConnected) {
      Alert.alert(
        t('stripe.notConnectedTitle', 'Stripe Not Connected'),
        t(
          'stripe.notConnectedMessage',
          'You must connect your bank account via Stripe before you can create paid events so you can receive payouts.'
        ),
        [
          {text: t('common.cancel', 'Cancel'), style: 'cancel'},
          {text: t('stripe.connectNow', 'Connect Stripe'), onPress: () => navigate('/(provider)/payment-setup')},
        ]
      );
      return;
    }

    mutate(data);
  };

  // --- Helpers ---

  const openDatePicker = (field: 'start_at' | 'end_at' | 'book_till') => {
    setActiveTimeField(field);
    setDatePickerMode(field === 'book_till' ? 'date' : 'datetime');
    setTimePickerVisible(true);
  };

  const handleConfirmDate = (date: Date) => {
    if (activeTimeField) {
      setValue(activeTimeField, date, {shouldValidate: true});
    }
    setTimePickerVisible(false);
    setActiveTimeField(null);
  };

  // Ticket Management
  const addTicketType = () => {
    const current = watch('ticket_types');
    setValue('ticket_types', [...current, {name: '', price: '', capacity: ''}]);
  };

  const removeTicketType = (index: number) => {
    const current = watch('ticket_types');
    if (current.length > 1) {
      setValue(
        'ticket_types',
        current.filter((_, i) => i !== index)
      );
    } else {
      Toast.show({type: 'info', text1: 'Required', text2: 'You must have at least one ticket type.'});
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAwareScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={62}>
        <View className="mb-6 flex-row items-center">
          <TouchableOpacity onPress={() => back()} className="mr-4 rounded-full bg-gray-100 p-2">
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <H2 className="text-gray-900">{t('events.createTitle')}</H2>
        </View>

        {/* Title */}
        <View className="mb-4">
          <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.eventTitlePlaceholder', 'Event Title')}</Body>
          <Controller
            control={control}
            name="title"
            rules={{required: 'Title is required'}}
            render={({field: {onChange, value}, fieldState: {error}}) => (
              <>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder={t('events.eventTitlePlaceholder', 'Event Title')}
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

        <View className="mb-4">
          <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.category')}</Body>
          <Controller
            name="category"
            control={control}
            rules={{required: 'Category is required'}}
            render={({field: {onChange, value}, fieldState: {error}}) => (
              <>
                {isLoadingCategories ? (
                  <ActivityIndicator size="small" />
                ) : (
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
                )}
                {error?.message && <Caption className="mt-1 text-red-500">{error.message}</Caption>}
              </>
            )}
          />
        </View>

        <View className="mb-4 gap-4">
          <View>
            <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.startTime')}</Body>
            <Controller
              name="start_at"
              control={control}
              rules={{required: 'Start time is required'}}
              render={({field: {onChange, value}, fieldState: {error}}) => (
                <>
                  <TouchableOpacity
                    onPress={() => openDatePicker('start_at')}
                    className="min-h-[50px] justify-center rounded-lg border border-gray-300 bg-white p-3">
                    <Body className={`${value ? 'text-gray-900' : 'text-gray-400'}`}>
                      {value
                        ? `${value.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: true})} - ${value.getDate().toString().padStart(2, '0')}/${(value.getMonth() + 1).toString().padStart(2, '0')}/${value.getFullYear().toString().slice(-2)}`
                        : t('events.selectStart')}
                    </Body>
                  </TouchableOpacity>
                  {error?.message && <Caption className="mt-1 text-red-500">{error.message}</Caption>}
                </>
              )}
            />
          </View>
          <View>
            <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.endTime')}</Body>
            <Controller
              name="end_at"
              control={control}
              rules={{required: 'End time is required'}}
              render={({field: {onChange, value}, fieldState: {error}}) => (
                <>
                  <TouchableOpacity
                    onPress={() => openDatePicker('end_at')}
                    className="min-h-[50px] justify-center rounded-lg border border-gray-300 bg-white p-3">
                    <Body className={`${value ? 'text-gray-900' : 'text-gray-400'}`}>
                      {value
                        ? `${value.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: true})} - ${value.getDate().toString().padStart(2, '0')}/${(value.getMonth() + 1).toString().padStart(2, '0')}/${value.getFullYear().toString().slice(-2)}`
                        : t('events.selectEnd')}
                    </Body>
                  </TouchableOpacity>
                  {error?.message && <Caption className="mt-1 text-red-500">{error.message}</Caption>}
                </>
              )}
            />
          </View>
        </View>

        <View className="mb-4">
          <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.bookingDeadline')}</Body>
          <Controller
            name="book_till"
            control={control}
            rules={{required: 'Booking deadline is required'}}
            render={({field: {onChange, value}, fieldState: {error}}) => (
              <>
                <TouchableOpacity
                  onPress={() => openDatePicker('book_till')}
                  className="min-h-[50px] justify-center rounded-lg border border-gray-300 bg-white p-3">
                  <Body className={`${value ? 'text-gray-900' : 'text-gray-400'}`}>
                    {value ? value?.toLocaleDateString() : t('events.selectDeadline')}
                  </Body>
                </TouchableOpacity>
                {error?.message && <Caption className="mt-1 text-red-500">{error.message}</Caption>}
              </>
            )}
          />
        </View>

        {/* Location Selection */}
        <LocationInput control={control} setValue={setValue} watch={watch} label={t('events.location')} />

        {/* Ticket Types */}
        <View className="mb-6">
          <View className="mb-2 flex-row items-center justify-between">
            <Body className="font-nunito-bold text-sm text-gray-700">{t('events.ticketTypes')}</Body>
          </View>

          {ticketTypes.map((ticket, index) => (
            <View key={index} className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <View className="mb-2 flex-row items-center justify-between">
                <Caption className="font-nunito-bold uppercase text-gray-500">
                  {t('events.ticketTypes')} #{index + 1}
                </Caption>
                {ticketTypes.length > 1 && (
                  <TouchableOpacity onPress={() => removeTicketType(index)}>
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>

              <View className="mb-2">
                <Controller
                  control={control}
                  name={`ticket_types.${index}.name`}
                  rules={{required: 'Ticket name is required'}}
                  render={({field: {onChange, value}, fieldState: {error}}) => (
                    <>
                      <TextInput
                        value={value}
                        onChangeText={onChange}
                        placeholder={t('events.ticketNamePlaceholder')}
                        className="rounded-lg border border-gray-300 bg-white p-3 font-nunito"
                      />
                      {error?.message && <Caption className="mt-1 text-red-500">{error.message}</Caption>}
                    </>
                  )}
                />
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Controller
                    control={control}
                    name={`ticket_types.${index}.price`}
                    render={({field: {onChange, value}, fieldState: {error}}) => (
                      <>
                        <View className="flex-row items-center rounded-lg border border-gray-300 bg-white px-3">
                          <Body className="mr-1 text-gray-500">$</Body>
                          <TextInput
                            className="flex-1 py-3 font-nunito"
                            placeholder={t('events.price')}
                            keyboardType="numeric"
                            value={value}
                            onChangeText={onChange}
                          />
                        </View>
                        {error?.message && <Caption className="mt-1 text-red-500">{error.message}</Caption>}
                      </>
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Controller
                    control={control}
                    rules={{required: 'Required', min: 1}}
                    name={`ticket_types.${index}.capacity`}
                    render={({field: {onChange, value}, fieldState: {error}}) => (
                      <>
                        <TextInput
                          value={value}
                          placeholder={t('events.capacity')}
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
            </View>
          ))}

          <TouchableOpacity
            onPress={addTicketType}
            className="mt-2 flex-row items-center justify-center rounded-lg border border-dashed border-primary bg-primary/5 p-3">
            <Feather name="plus" size={18} color="#00594f" />
            <Body className="ml-2 font-nunito-bold text-primary">{t('events.addTicketType')}</Body>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleSubmit(onSubmit, onInvalid)}
          disabled={isPending || isSubmitting}
          className={`mb-10 items-center rounded-lg p-4 ${isPending ? 'bg-gray-400' : 'bg-primary'}`}>
          {isPending ? <ActivityIndicator color="white" /> : <Body className="font-nunito-bold text-lg text-white">{t('events.createButton')}</Body>}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
      <DateTimePickerModal
        mode={datePickerMode}
        onConfirm={handleConfirmDate}
        isVisible={!!isTimePickerVisible}
        onCancel={() => setTimePickerVisible(false)}
        textColor="black"
        buttonTextColorIOS="black"
      />
    </SafeAreaView>
  );
}
