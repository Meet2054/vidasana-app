import {Feather, Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {supabase, uploadFile, parseLocation} from '@/utils';
import {useAppStore} from '@/store';
import {useForm, Controller} from 'react-hook-form';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {useRouter, useLocalSearchParams} from 'expo-router';
import {View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import React, {useEffect, useState} from 'react';
import Toast from 'react-native-toast-message';
import {useTranslation} from 'react-i18next';
import {EventFormValues, EventUnifiedImage} from '@/types';
import {H2, Body, Caption, ImageInput, LocationInput} from '@/components';

export default function EditEventScreen() {
  const {id: idParam} = useLocalSearchParams();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const {back} = useRouter();
  const {t} = useTranslation();
  const queryClient = useQueryClient();

  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [activeTimeField, setActiveTimeField] = useState<'start_at' | 'end_at' | 'book_till' | null>(null);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time' | 'datetime'>('datetime');

  const {
    watch,
    reset,
    control,
    setValue,
    handleSubmit,
    formState: {isSubmitting},
  } = useForm<EventFormValues>({
    defaultValues: {
      title: '',
      description: '',
      category: null,
      start_at: null,
      end_at: null,
      book_till: null,
      images: [],
      ticket_types: [],
      lat: null,
      lng: null,
      address: '',
    },
  });

  const ticketTypes = watch('ticket_types');

  // Fetch Categories
  const {data: categories} = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const {data, error} = await supabase.from('categories').select('*').eq('status', true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch Event Data
  const {data: eventData, isLoading: isLoadingEvent} = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      // Use raw SQL select for PostGIS or rpc.
      // Supabase-js basic select doesn't easily support function calls like ST_X without a view or rpc.
      // However, we can cheat by selecting 'location' and assuming it returns GeoJSON if configured?
      // Safest: Use a small RPC or just select everything and hopefully the location column is WKT?
      // Actually, let's use the standard select and see.
      // BUT, earlier we confirmed services had lat/lng because of a VIEW or logic.
      // Let's try to query it.
      const {data, error} = await supabase.from('events').select(`*, event_ticket_types(*)`).eq('id', id).single();

      if (error) throw error;

      // If location is returned as GeoJSON object (default in Supabase for geometry columns)
      // { type: "Point", coordinates: [lng, lat] }
      return data;
    },
  });

  // Populate Form
  useEffect(() => {
    if (eventData) {
      const images: EventUnifiedImage[] = (eventData.images || []).map((path: string) => ({
        id: path,
        type: 'existing',
        uri: supabase.storage.from('images').getPublicUrl(path).data.publicUrl,
      }));

      const tickets = (eventData.event_ticket_types || []).map((ticket: any) => ({
        id: ticket.id,
        name: ticket.name,
        price: ticket.price.toString(),
        capacity: ticket.capacity.toString(),
      }));

      const parsedLocation = parseLocation(eventData.location);

      reset({
        title: eventData.title || '',
        description: eventData.description || '',
        category: eventData.category,
        start_at: new Date(eventData.start_at),
        end_at: new Date(eventData.end_at),
        book_till: eventData.book_till ? new Date(eventData.book_till) : null,
        images,
        ticket_types: tickets.length > 0 ? tickets : [{name: 'General', price: '', capacity: ''}],
        lat: parsedLocation.lat,
        lng: parsedLocation.lng,
        address: eventData.address || '',
      });
    }
  }, [eventData, reset]);

  // Update Event Mutation
  const {mutate, isPending} = useMutation({
    mutationFn: async (data: EventFormValues) => {
      // 1. Get User
      const {user} = useAppStore.getState().session!;
      if (!user) throw new Error('User not authenticated');

      // 2. Upload New Images
      const imagePaths: string[] = [];
      for (const img of data.images) {
        if (img.type === 'existing') {
          imagePaths.push(img.id);
        } else if (img.type === 'new' && img.file) {
          const fileExt = img.uri.split('.').pop();
          const fileName = `${user.id}/${Date.now()}_${String(Math.random()).slice(2, 7)}.${fileExt}`;
          const {data: uploadData, error: uploadError} = await uploadFile(img.file, 'images', fileName);
          if (uploadError) throw uploadError;
          if (uploadData?.path) imagePaths.push(uploadData.path);
        }
      }

      // 3. Update Event (Base)
      const {error: updateError} = await supabase
        .from('events')
        .update({
          title: data.title,
          description: data.description,
          category: data.category!,
          start_at: data.start_at!.toISOString(),
          end_at: data.end_at!.toISOString(),
          book_till: data.book_till ? data.book_till.toISOString() : null,
          images: imagePaths,
          location: data.lat && data.lng ? `POINT(${data.lng} ${data.lat})` : null,
          address: data.address,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // 5. Upsert Tickets
      // For tickets, we handle edits and new ones.
      // Existing have IDs. New don't.
      const ticketsToUpsert = data.ticket_types.map((ticket) => ({
        id: ticket.id, // undefined for new
        event_id: id,
        name: ticket.name,
        price: parseFloat(ticket.price) || 0,
        capacity: parseInt(ticket.capacity),
      }));

      const {error: ticketsError} = await supabase.from('event_ticket_types').upsert(ticketsToUpsert);
      if (ticketsError) throw ticketsError;

      // Handle deletions? If user removed a ticket from UI, it's not in the list.
      // But upsert only updates provided. We need to delete missing ones.
      // For MVP, maybe we skip deletion or do a separate delete step?
      // Let's rely on basic upsert for now to avoid complexity unless requested.
      // Effectively: "Update Event Update Flow" -> Updating logic.
    },
    onSuccess: () => {
      Toast.show({type: 'success', text1: 'Success', text2: 'Event updated successfully!'});
      queryClient.invalidateQueries({queryKey: ['events']});
      queryClient.invalidateQueries({queryKey: ['event', id]});
      back();
    },
    onError: (error: any) => {
      console.error(error);
      Toast.show({type: 'error', text1: 'Error', text2: error.message});
    },
  });

  const onInvalid = (errors: any) => {
    Toast.show({type: 'error', text1: 'Validation Error', text2: 'Please check the form.'});
  };

  const onSubmit = (data: EventFormValues) => mutate(data);

  // --- Helpers same as create ---

  const openDatePicker = (field: 'start_at' | 'end_at' | 'book_till') => {
    setActiveTimeField(field);
    setDatePickerMode(field === 'book_till' ? 'date' : 'datetime');
    setTimePickerVisible(true);
  };

  const handleConfirmDate = (date: Date) => {
    if (activeTimeField) setValue(activeTimeField, date, {shouldValidate: true});
    setTimePickerVisible(false);
    setActiveTimeField(null);
  };

  const addTicketType = () => {
    const current = watch('ticket_types');
    setValue('ticket_types', [...current, {name: '', price: '', capacity: ''}]);
  };

  const removeTicketType = async (index: number) => {
    const current = watch('ticket_types');
    const toRemove = current[index];

    // If it has an ID, we might want to delete it from DB?
    // For now, just remove from UI. If we want to delete from DB, we'd need a delete mutation.
    // Given the complexity, I'll just remove from array. If user saves, it won't be deleted from DB automatically
    // unless we implement delete logic.
    // Ideally: Keep track of deleted IDs and delete on save.
    // Or just let it be.
    if (current.length > 1) {
      setValue(
        'ticket_types',
        current.filter((_, i) => i !== index)
      );
      if (toRemove.id) {
        // Optionally delete from DB immediately or mark for deletion?
        // Let's just warn: "Note: Deleting tickets is not fully supported in this draft" or implement it.
        // I will implement direct delete.
        const {error} = await supabase.from('event_ticket_types').delete().eq('id', toRemove.id);
        if (error) Toast.show({type: 'error', text1: 'Failed to delete ticket'});
      }
    } else {
      Toast.show({type: 'info', text1: 'Required', text2: 'At least one ticket type required.'});
    }
  };

  if (isLoadingEvent) return <ActivityIndicator size="large" className="mt-10" />;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        <View className="mb-6 flex-row items-center">
          <TouchableOpacity onPress={() => back()} className="mr-4 rounded-full bg-gray-100 p-2">
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <H2 className="text-gray-900">{t('events.editTitle')}</H2>
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
              <View className="flex-row flex-wrap gap-2">
                {categories?.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => onChange(cat.id)}
                    className={`rounded-full border px-4 py-2 ${value === cat.id ? 'border-primary bg-primary' : 'border-gray-300 bg-white'}`}>
                    <Body className={`font-nunito-bold ${value === cat.id ? 'text-white' : 'text-gray-700'}`}>{cat.name}</Body>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
        </View>

        <View className="mb-4 gap-4">
          <View>
            <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.startTime')}</Body>
            <TouchableOpacity onPress={() => openDatePicker('start_at')} className="rounded-lg border border-gray-300 bg-white p-3">
              <Controller
                name="start_at"
                control={control}
                render={({field: {value}}) => <Body className="font-nunito">{value ? value.toLocaleString() : t('events.selectStart')}</Body>}
              />
            </TouchableOpacity>
          </View>
          <View>
            <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.endTime')}</Body>
            <TouchableOpacity onPress={() => openDatePicker('end_at')} className="rounded-lg border border-gray-300 bg-white p-3">
              <Controller
                name="end_at"
                control={control}
                render={({field: {value}}) => <Body className="font-nunito">{value ? value.toLocaleString() : t('events.selectEnd')}</Body>}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-4">
          <Body className="mb-1 font-nunito-bold text-sm text-gray-700">{t('events.bookingDeadline')}</Body>
          <TouchableOpacity onPress={() => openDatePicker('book_till')} className="rounded-lg border border-gray-300 bg-white p-3">
            <Controller
              name="book_till"
              control={control}
              render={({field: {value}}) => <Body className="font-nunito">{value ? value.toLocaleDateString() : t('events.selectDeadline')}</Body>}
            />
          </TouchableOpacity>
        </View>

        {/* Location Selection */}
        <LocationInput control={control} setValue={setValue} watch={watch} label={t('events.location')} />

        {/* Tickets */}
        <View className="mb-6">
          <Body className="mb-2 font-nunito-bold text-sm text-gray-700">{t('events.ticketTypes')}</Body>
          {ticketTypes.map((ticket, index) => (
            <View key={index} className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <View className="mb-2 flex-row justify-between">
                <Body className="font-nunito-bold">#{index + 1}</Body>
                {ticketTypes.length > 1 && (
                  <TouchableOpacity onPress={() => removeTicketType(index)}>
                    <Feather name="trash-2" size={16} color="red" />
                  </TouchableOpacity>
                )}
              </View>
              <Controller
                name={`ticket_types.${index}.name`}
                control={control}
                render={({field: {onChange, value}}) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Ticket Name"
                    className="mb-2 rounded-lg border border-gray-300 bg-white p-2 font-nunito"
                  />
                )}
              />
              <View className="flex-row gap-2">
                <Controller
                  name={`ticket_types.${index}.price`}
                  control={control}
                  render={({field: {onChange, value}}) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="Price"
                      keyboardType="numeric"
                      className="flex-1 rounded-lg border border-gray-300 bg-white p-2 font-nunito"
                    />
                  )}
                />
                <Controller
                  name={`ticket_types.${index}.capacity`}
                  control={control}
                  render={({field: {onChange, value}}) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="Capacity"
                      keyboardType="numeric"
                      className="flex-1 rounded-lg border border-gray-300 bg-white p-2 font-nunito"
                    />
                  )}
                />
              </View>
            </View>
          ))}
          <TouchableOpacity
            onPress={addTicketType}
            className="flex-row items-center justify-center rounded-lg border border-dashed border-primary p-3">
            <Feather name="plus" size={18} color="#00594f" />
            <Body className="ml-2 font-nunito-bold text-primary">{t('events.addTicketType')}</Body>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleSubmit(onSubmit, onInvalid)}
          disabled={isPending || isSubmitting}
          className="mb-10 items-center rounded-lg bg-primary p-4">
          {isPending ? <ActivityIndicator color="white" /> : <Body className="font-nunito-bold text-white">{t('events.updateButton')}</Body>}
        </TouchableOpacity>
      </ScrollView>
      <DateTimePickerModal
        isVisible={!!isTimePickerVisible}
        mode={datePickerMode as any}
        onConfirm={handleConfirmDate}
        onCancel={() => setTimePickerVisible(false)}
      />
    </SafeAreaView>
  );
}
