import React, {useState, useEffect} from 'react';
import {Modal, KeyboardAvoidingView, Platform, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image} from 'react-native';
import Animated, {SlideInDown, SlideOutDown} from 'react-native-reanimated';
import {H2, H3, Body} from '../Typography';
import {PhoneInputField} from '../PhoneInputField';
import {LocationPickerModal} from './LocationPickerModal';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {supabase} from '@/utils';
import {Ionicons, Feather} from '@expo/vector-icons';
import {launchImageLibraryAsync, MediaTypeOptions} from 'expo-image-picker';

interface ProviderProfileData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  providerType: string;
  description: string;
  service_type: string;
  pricing: string;
  session_duration: string;
  language: string;
  location: any; // update to any or specific PostGIS format
  image?: string | null;
}

interface ProviderEditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData: ProviderProfileData;
}

const TERMS_AGREEMENTS = [
  {id: 'terms', label: 'I agree to the Provider Terms & Conditions'},
  {id: 'contractor', label: 'I agree to the Independent Contractor Agreement'},
  {id: 'privacy', label: 'I acknowledge the Global Data Privacy Policy'},
  {id: 'dispute', label: 'I acknowledge the Provider Dispute Guarantee'},
  {id: 'ethics', label: 'I acknowledge the Provider Standards, Ethics & Scope of Practice'},
  {id: 'cancel', label: 'I acknowledge the Cancellation & Rescheduling Policy'},
];

const SERVICE_TYPES = ['Online', 'In Person', 'Hybrid'];

export const ProviderEditProfileModal: React.FC<ProviderEditProfileModalProps> = ({visible, onClose, onSuccess, initialData}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();

  const [editedInfo, setEditedInfo] = useState<ProviderProfileData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isLocationPickerVisible, setLocationPickerVisible] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setEditedInfo(initialData);
      setSelectedCountry(null);
      setProfileImage(initialData.image || null);

      // Parse PostGIS point
      const loc = initialData.location as any;
      if (loc && typeof loc === 'object' && loc.coordinates) {
        setLng(loc.coordinates[0]);
        setLat(loc.coordinates[1]);
      } else {
        setLng(null);
        setLat(null);
      }
    }
  }, [visible, initialData]);

  const setServiceType = (type: string) => {
    setEditedInfo((prev) => ({...prev, service_type: type}));
  };

  const handleImagePick = async () => {
    const result = await launchImageLibraryAsync({
      mediaTypes: MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const trimmedPhone = editedInfo.phone.trim();

    setIsSaving(true);
    try {
      const fullPhoneNumber = selectedCountry ? `${selectedCountry?.callingCode} ${trimmedPhone}` : trimmedPhone;

      let uploadedImagePath: string | null | undefined = undefined;

      // 0. Upload Image if changed
      if (profileImage && profileImage !== initialData.image) {
        const fileExt = profileImage.split('.').pop()?.split('?')[0] || 'jpeg';
        const fileName = `${initialData.id}.${fileExt}`;

        // Create form data for upload
        const formData = new FormData();
        formData.append('file', {
          uri: Platform.OS === 'ios' ? profileImage.replace('file://', '') : profileImage,
          name: fileName,
          type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
        } as any);

        const {error: uploadError} = await supabase.storage.from('profile').upload(fileName, formData as any, {
          upsert: true,
        });

        if (uploadError) {
          throw uploadError;
        }
        uploadedImagePath = fileName;
      }

      // 1. Update Profile (Phone & Image)
      const profileUpdates: any = {phone: fullPhoneNumber || null};
      if (uploadedImagePath !== undefined) {
        profileUpdates.image = uploadedImagePath;
      }

      const {error: profileError} = await supabase.from('profile').update(profileUpdates).eq('id', initialData.id);

      if (profileError) throw profileError;

      // 2. Update Provider table (Optional Info & Terms)
      const {error: providerError} = await supabase.from('provider').upsert({
        id: initialData.id,
        country: initialData.country, // Required field in DB
        description: editedInfo.description,
        service_type: editedInfo.service_type,
        pricing: editedInfo.pricing,
        session_duration: editedInfo.session_duration,
        language: editedInfo.language,
        location: lat && lng ? `POINT(${lng} ${lat})` : null,
      });

      if (providerError) throw providerError;

      onSuccess();
      onClose();
    } catch (saveError: any) {
      console.error('Error updating provider profile:', saveError);
      Alert.alert('Error', saveError?.message || "We couldn't save your profile changes right now.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-white">
        {/* Header */}
        <View
          className="flex-row items-center justify-between border-b border-gray-100 bg-white px-6 pb-4 pt-4"
          style={{paddingTop: insets.top + 16}}>
          <H2 className="text-xl font-bold text-gray-900">Edit Provider Profile</H2>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color="black" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-6 pb-12 pt-6" showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 100}}>
          {/* Avatar Section */}
          <View className="mb-6 items-center">
            <TouchableOpacity onPress={handleImagePick}>
              <View className="relative">
                {profileImage ? (
                  <Image source={{uri: profileImage}} className="h-[100px] w-[100px] rounded-full" />
                ) : (
                  <View className="h-[100px] w-[100px] items-center justify-center rounded-full bg-gray-200">
                    <Ionicons name="person" size={40} color="#666" />
                  </View>
                )}
                <View className="absolute bottom-0 right-0 h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-primary">
                  <Ionicons name="camera" size={14} color="#FFF" />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* SECTION 1: Basic Info */}
          <View className="mb-8 rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <H3 className="mb-4 text-lg font-bold text-[#1F1F1F]">Basic Info</H3>

            {/* Legal Name (Read Only) */}
            <Body className="mb-1 text-sm font-medium text-gray-500">Legal Name</Body>
            <View className="mb-4 h-14 justify-center rounded-xl border border-gray-200 bg-gray-100 px-4">
              <Body className="text-base text-gray-500">{initialData.fullName}</Body>
            </View>

            {/* Email (Read Only) */}
            <Body className="mb-1 text-sm font-medium text-gray-500">Email</Body>
            <View className="mb-4 h-14 justify-center rounded-xl border border-gray-200 bg-gray-100 px-4">
              <Body className="text-base !lowercase text-gray-500">{initialData.email}</Body>
            </View>

            {/* Country (Read Only) */}
            <Body className="mb-1 text-sm font-medium text-gray-500">Country</Body>
            <View className="mb-4 h-14 justify-center rounded-xl border border-gray-200 bg-gray-100 px-4">
              <Body className="text-base text-gray-500">{initialData.country || 'N/A'}</Body>
            </View>

            {/* Provider Type (Read Only) */}
            <Body className="mb-1 text-sm font-medium text-gray-500">Provider Type</Body>
            <View className="mb-4 h-14 justify-center rounded-xl border border-gray-200 bg-gray-100 px-4">
              <Body className="text-base capitalize text-gray-500">{initialData.providerType || 'N/A'}</Body>
            </View>

            {/* Phone (Editable) */}
            <Body className="mb-1 font-nunito text-sm font-medium text-gray-700">Phone</Body>
            <PhoneInputField
              value={editedInfo.phone}
              placeholder={t('profile.placeholderPhone')}
              selectedCountry={selectedCountry}
              onChangeSelectedCountry={setSelectedCountry}
              onChangePhoneNumber={(text) => setEditedInfo((p) => ({...p, phone: text}))}
            />
          </View>

          {/* SECTION 2: Agree below Terms */}
          <View className="mb-8 rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <H3 className="mb-4 text-lg font-bold text-[#1F1F1F]">Agree below Terms</H3>
            {TERMS_AGREEMENTS.map((term) => (
              <View key={term.id} className="mb-4 flex-row items-center gap-3">
                <View className="h-6 w-6 items-center justify-center rounded border border-primary bg-primary">
                  <Ionicons name="checkmark" size={16} color="white" />
                </View>
                <Body className="flex-1 text-sm text-gray-700">{term.label}</Body>
              </View>
            ))}
          </View>

          {/* SECTION 3: Additional Provider Info */}
          <View className="mb-8 rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <H3 className="mb-4 text-lg font-bold text-[#1F1F1F]">Provider Details (Optional)</H3>

            {/* Description */}
            <Body className="mb-1 text-sm font-medium text-gray-700">Describe your service/event</Body>
            <TextInput
              editable={!isSaving}
              value={editedInfo.description || ''}
              onChangeText={(text) => setEditedInfo((p) => ({...p, description: text}))}
              placeholder="Tell clients about what you offer..."
              multiline
              numberOfLines={4}
              className="mb-4 min-h-[100px] rounded-xl border border-gray-200 bg-white p-4 text-base text-gray-900"
              style={{textAlignVertical: 'top'}}
            />

            {/* Service Type */}
            <Body className="mb-1 text-sm font-medium text-gray-700">Type of Service/Event</Body>
            <View className="mb-4 flex-row gap-2">
              {SERVICE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setServiceType(type)}
                  className={`flex-1 items-center justify-center rounded-xl border py-3 ${
                    editedInfo.service_type === type ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'
                  }`}>
                  <Body className={`font-nunito-bold text-sm ${editedInfo.service_type === type ? 'text-primary' : 'text-gray-500'}`}>{type}</Body>
                </TouchableOpacity>
              ))}
            </View>

            {/* Pricing */}
            <Body className="mb-1 text-sm font-medium text-gray-700">Pricing</Body>
            <TextInput
              editable={!isSaving}
              value={editedInfo.pricing || ''}
              onChangeText={(text) => setEditedInfo((p) => ({...p, pricing: text}))}
              placeholder="e.g. $50/hr, Varies"
              className="mb-4 h-14 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900"
            />

            {/* Session Duration */}
            <Body className="mb-1 text-sm font-medium text-gray-700">Session Duration</Body>
            <TextInput
              editable={!isSaving}
              value={editedInfo.session_duration || ''}
              onChangeText={(text) => setEditedInfo((p) => ({...p, session_duration: text}))}
              placeholder="e.g. 60 minutes, 2 hours"
              className="mb-4 h-14 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900"
            />

            {/* Language */}
            <Body className="mb-1 text-sm font-medium text-gray-700">Language</Body>
            <TextInput
              editable={!isSaving}
              value={editedInfo.language || ''}
              onChangeText={(text) => setEditedInfo((p) => ({...p, language: text}))}
              placeholder="e.g. English, Spanish"
              className="mb-4 h-14 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900"
            />

            {/* Location (Map UI) */}
            <Body className="mb-2 text-sm font-medium text-gray-700">Location</Body>
            <View className="mb-4">
              {lat && lng ? (
                <View className="mb-3 h-40 overflow-hidden rounded-xl bg-gray-100">
                  <MapView
                    style={{flex: 1}}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    scrollEnabled={false}
                    rotateEnabled={false}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={{latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01}}>
                    <Marker coordinate={{latitude: lat, longitude: lng}} />
                  </MapView>
                  <TouchableOpacity
                    className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center bg-black/10"
                    onPress={() => setLocationPickerVisible(true)}>
                    <View className="items-center justify-center rounded-full bg-white/90 p-2 shadow-sm">
                      <Feather name="edit-2" size={20} color="#00594f" />
                    </View>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={() => setLocationPickerVisible(true)}
                className={`flex-row items-center justify-center rounded-xl border border-dashed p-4 ${
                  lat ? 'border-primary/30 bg-primary/5' : 'border-gray-300 bg-gray-50'
                }`}>
                <Feather name="map-pin" size={20} color={lat ? '#00594f' : '#9CA3AF'} />
                <Body className={`ml-2 font-nunito-bold ${lat ? 'text-primary' : 'text-gray-500'}`}>
                  {lat ? t('map.changeLocation') : t('map.selectLocation')}
                </Body>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <LocationPickerModal
          visible={isLocationPickerVisible}
          onClose={() => setLocationPickerVisible(false)}
          initialLocation={lat && lng ? {lat, lng} : null}
          onConfirm={(loc) => {
            setLat(loc.lat);
            setLng(loc.lng);
          }}
        />

        {/* Floating Save Button */}
        <Animated.View
          entering={SlideInDown}
          exiting={SlideOutDown}
          className="border-t border-gray-100 bg-white px-6 py-4 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
          <View className="flex-row items-center justify-between gap-4">
            <TouchableOpacity
              disabled={isSaving}
              onPress={onClose}
              className={`flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white py-4 ${isSaving ? 'opacity-60' : ''}`}>
              <Body className="font-nunito-bold text-base text-gray-700">Cancel</Body>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              className={`flex-1 items-center justify-center rounded-xl bg-primary py-4 ${isSaving ? 'opacity-60' : ''}`}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Body className="font-nunito-bold text-base text-white">Save Changes</Body>
              )}
            </TouchableOpacity>
          </View>
          <View style={{height: insets.bottom}} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
