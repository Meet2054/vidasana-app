import React, {useState, useEffect} from 'react';
import {Modal, KeyboardAvoidingView, Platform, Pressable, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image} from 'react-native';
import Animated, {SlideInDown, SlideOutDown} from 'react-native-reanimated';
import {H3, Body} from '../Typography';
import {PhoneInputField} from '../PhoneInputField';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {supabase} from '@/utils';
import {useAppStore} from '@/store';
import {Ionicons} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (updatedData: {fullName: string; phone: string}) => void;
  initialData: {fullName: string; phone: string; email: string; image?: string | null; country_code?: string};
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({visible, onClose, onSuccess, initialData}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const currentUser = useAppStore((state) => state.session?.user);
  const setSession = useAppStore((state) => state.setSession);

  const [editedInfo, setEditedInfo] = useState({fullName: '', phone: ''});
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setEditedInfo({phone: initialData.phone, fullName: initialData.fullName});
      // Try to use saved country_code first
      setSelectedCountry(null);
      setProfileImage(initialData.image || null);
    }
  }, [visible, initialData]);

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!currentUser?.id) return Alert.alert('Error', "We couldn't verify your account. Please sign in again.");

    const trimmedName = editedInfo.fullName.trim();
    const trimmedPhone = editedInfo.phone.trim();

    if (!trimmedName) return Alert.alert('Name required', 'Please enter your full name before saving.');

    setIsSaving(true);
    try {
      const fullPhoneNumber = selectedCountry ? `${selectedCountry?.callingCode} ${trimmedPhone}` : trimmedPhone;
      const countryCode = selectedCountry?.cca2 || '';

      let uploadedImagePath: string | null | undefined = undefined;

      // 0. Upload Image if changed
      if (profileImage && profileImage !== initialData.image) {
        // Delete the old image first (handles extension changes like .jpeg → .png)
        if (initialData.image) {
          const oldPath = initialData.image.startsWith('http') ? (initialData.image.match(/\/profile\/(.+?)(?:\?|$)/)?.[1] ?? '') : initialData.image;
          if (oldPath) await supabase.storage.from('profile').remove([oldPath]);
        }

        const fileExt = profileImage.split('.').pop()?.split('?')[0] || 'jpeg';
        const fileName = `${currentUser.id}.${fileExt}`;

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

      // Resolve the cache-busted public URL to propagate to auth metadata & store
      const resolvedImageUrl = uploadedImagePath
        ? `${supabase.storage.from('profile').getPublicUrl(uploadedImagePath).data.publicUrl}?t=${Date.now()}`
        : undefined;

      const profileUpdates: any = {name: trimmedName, phone: fullPhoneNumber || null, country_code: countryCode};
      if (uploadedImagePath !== undefined) {
        profileUpdates.image = uploadedImagePath; // store the relative path in DB
      }

      const {data, error} = await supabase.from('profile').update(profileUpdates).eq('id', currentUser.id).select('name, phone, image').single();

      if (error) throw error;

      await supabase.auth.updateUser({data: {full_name: trimmedName, ...(resolvedImageUrl ? {image: resolvedImageUrl} : {})}});

      // Refresh session in store so all subscribers (HomeHeader, etc.) update instantly
      const {data: refreshed} = await supabase.auth.refreshSession();
      if (refreshed?.session) setSession(refreshed.session);

      onSuccess({fullName: data?.name ?? trimmedName, phone: data?.phone ?? fullPhoneNumber});
      onClose();
    } catch (saveError) {
      console.error('Error updating profile:', saveError);
      Alert.alert('Error', "We couldn't save your profile changes right now. Please try again shortly.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/40">
        <Pressable className="absolute inset-0" onPress={onClose} />

        <Animated.View entering={SlideInDown} exiting={SlideOutDown} className="w-full rounded-t-3xl bg-white px-6 pb-12 pt-6 shadow-xl">
          <View className="w-full">
            <H3 className="mb-2 text-xl font-bold text-[#1F1F1F]">{t('profile.editTitle')}</H3>
            <Body className="mb-6 text-sm text-[#6B6B6B]">{t('profile.description')}</Body>

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

            {/* Full Name */}
            <Body className="mb-1 font-nunito text-sm font-medium text-gray-700">{t('profile.fullName')}</Body>
            <TextInput
              editable={!isSaving}
              returnKeyType="done"
              value={editedInfo.fullName}
              placeholder={t('profile.placeholderFullName')}
              style={{textAlignVertical: 'center'}}
              onChangeText={(text) => setEditedInfo((p) => ({...p, fullName: text}))}
              className="h-14 rounded-xl border border-gray-200 bg-white px-4 font-nunito text-base text-gray-900"
            />

            {/* Phone */}
            <Body className="mb-1 mt-4 font-nunito text-sm font-medium text-gray-700">{t('profile.phoneNumber')}</Body>
            <PhoneInputField
              value={editedInfo.phone}
              placeholder={t('profile.placeholderPhone')}
              selectedCountry={selectedCountry}
              onChangeSelectedCountry={setSelectedCountry}
              onChangePhoneNumber={(text) => setEditedInfo((p) => ({...p, phone: text}))}
              defaultCountry={initialData.country_code || 'US'}
            />

            {/* Email */}
            <Body className="mb-1 font-nunito text-sm font-medium text-gray-500">{t('profile.email')}</Body>
            <View className="h-14 justify-center rounded-xl border border-gray-100 bg-gray-50 px-4">
              <Body className="text-base !lowercase text-gray-400">{initialData.email}</Body>
            </View>

            {/* Buttons */}
            <View className="mt-8 flex-row items-center justify-between gap-4">
              <TouchableOpacity
                disabled={isSaving}
                onPress={onClose}
                className={`flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white py-4 ${isSaving ? 'opacity-60' : ''}`}>
                <Body className="font-nunito-bold text-base text-gray-700">{t('common.cancel')}</Body>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                className={`flex-1 items-center justify-center rounded-xl bg-primary py-4 ${isSaving ? 'opacity-60' : ''}`}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Body className="font-nunito-bold text-base text-white">{t('common.saveChanges')}</Body>
                )}
              </TouchableOpacity>
            </View>

            <View style={{height: insets.bottom + 20}} />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
