import React, {useState, useEffect} from 'react';
import {Modal, KeyboardAvoidingView, Platform, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image} from 'react-native';
import Animated, {SlideInDown, SlideOutDown} from 'react-native-reanimated';
import {H2, H3, Body, LegalModal} from '../index';
import {ID_TYPES, PROVIDER_TYPES, PROVIDER_LEGAL_CONTENT, PROVIDER_TERMS_AGREEMENTS} from '@/constants';
import {PhoneInputField} from '../PhoneInputField';
import {LocationPickerModal} from './LocationPickerModal';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {supabase, uploadFile} from '@/utils';
import {useAppStore} from '@/store';
import {useUserLocation} from '@/hooks';
import {Ionicons, Feather} from '@expo/vector-icons';
import {ImagePickerAsset, launchImageLibraryAsync, MediaTypeOptions} from 'expo-image-picker';
import {getDocumentAsync, DocumentPickerAsset} from 'expo-document-picker';
import CountrySelect, {ICountry} from 'react-native-country-select';
import Toast from 'react-native-toast-message';

interface ProviderProfileData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  countryCode?: string;
  providerType: string;
  description: string;
  service_type: string;
  pricing: string;
  session_duration: string;
  language: string;
  location: any; // update to any or specific PostGIS format
  image?: string | null;
  status?: string;
  idType?: string;
  document?: string | null;
  idPhoto?: string[] | null;
}

interface ProviderEditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SERVICE_TYPES = ['Online', 'In Person', 'Hybrid'];

export const ProviderEditProfileModal: React.FC<ProviderEditProfileModalProps> = ({visible, onClose, onSuccess}) => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const {location: deviceLocation} = useUserLocation();

  const setSession = useAppStore((state) => state.setSession);
  const session = useAppStore((state) => state.session);
  const currentUser = session?.user;

  const [initialData, setInitialData] = useState<ProviderProfileData | null>(null);
  const isEditable = initialData?.status !== 'active';

  const [isFetching, setIsFetching] = useState(false);
  const [editedInfo, setEditedInfo] = useState<ProviderProfileData>({} as ProviderProfileData);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isLocationPickerVisible, setLocationPickerVisible] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Onboarding specific state
  const [providerCountry, setProviderCountry] = useState<ICountry | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [idType, setIdType] = useState('');
  const [showIdTypePicker, setShowIdTypePicker] = useState(false);
  const [showProviderTypePicker, setShowProviderTypePicker] = useState(false);
  const [document, setDocument] = useState<DocumentPickerAsset | ImagePickerAsset | null>(null);
  const [idPhotoFront, setIdPhotoFront] = useState<DocumentPickerAsset | ImagePickerAsset | null>(null);
  const [idPhotoBack, setIdPhotoBack] = useState<DocumentPickerAsset | ImagePickerAsset | null>(null);

  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [idPhotoFrontUrl, setIdPhotoFrontUrl] = useState<string | null>(null);
  const [idPhotoBackUrl, setIdPhotoBackUrl] = useState<string | null>(null);

  // Legal Modal states
  const [legalVisible, setLegalVisible] = useState(false);
  const [legalTitle, setLegalTitle] = useState('');
  const [legalContent, setLegalContent] = useState('');

  const openLegalModal = (id: string, title: string) => {
    setLegalTitle(title);
    setLegalContent((PROVIDER_LEGAL_CONTENT as any)[id] || 'Content coming soon...');
    setLegalVisible(true);
  };

  useEffect(() => {
    if (visible && currentUser) {
      fetchData();
    } else {
      setInitialData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentUser]);

  const fetchData = async () => {
    if (!currentUser?.id) return;
    setIsFetching(true);
    try {
      const [{data: profileData}, {data: providerData}] = await Promise.all([
        supabase.from('profile').select('*').eq('id', currentUser.id).single(),
        supabase.from('provider').select('*').eq('id', currentUser.id).maybeSingle(),
      ]);

      const phoneValue = profileData?.phone || '';
      const savedCountryCode = profileData?.country_code || '';

      const data: ProviderProfileData = {
        id: currentUser.id,
        fullName: profileData?.name || currentUser.user_metadata?.full_name || '',
        email: currentUser.email || '',
        phone: phoneValue,
        countryCode: savedCountryCode,
        status: profileData?.status || '',
        image: profileData?.image || null,
        role: profileData?.role || currentUser.user_metadata?.role || 'provider',
        country: providerData?.country || '',
        providerType: providerData?.type || '',
        description: providerData?.description || '',
        service_type: providerData?.service_type || '',
        pricing: providerData?.pricing || '',
        session_duration: providerData?.session_duration || '',
        language: providerData?.language || '',
        location: typeof providerData?.location === 'string' ? providerData.location : '',
        idType: providerData?.id_type || '',
        document: providerData?.document || null,
        idPhoto: providerData?.id_photo || null,
      };

      setInitialData(data);
      setEditedInfo(data);
      // Don't reset selectedCountry to null if we have a saved countryCode,
      // let the PhoneInputField handle it via defaultCountry or its own internal state
      // unless we want to manually sync it here.

      // Extract image
      if (data.image) {
        if (data.image.startsWith('http')) {
          setProfileImage(data.image);
        } else {
          const {data: imageData} = supabase.storage.from('profile').getPublicUrl(data.image);
          setProfileImage(imageData.publicUrl);
        }
      } else {
        setProfileImage(null);
      }

      // Extract Location PostGIS point
      const loc = data.location as any;
      if (loc && typeof loc === 'object' && loc.coordinates) {
        setLng(loc.coordinates[0]);
        setLat(loc.coordinates[1]);
      } else if (deviceLocation) {
        setLat(deviceLocation.latitude);
        setLng(deviceLocation.longitude);
      } else {
        setLng(null);
        setLat(null);
      }

      setIdType(data.idType || '');
      setDocumentUrl(data.document || null);
      setIdPhotoFrontUrl(data.idPhoto?.[0] || null);
      setIdPhotoBackUrl(data.idPhoto?.[1] || null);

      setDocument(null);
      setIdPhotoFront(null);
      setIdPhotoBack(null);
    } catch (e) {
      console.error('Error fetching provider internal data:', e);
    } finally {
      setIsFetching(false);
    }
  };

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

  const handleFilePick = async (setFile: React.Dispatch<React.SetStateAction<DocumentPickerAsset | ImagePickerAsset | null>>) => {
    Alert.alert('Upload File', 'Would you like to upload a photo or a document?', [
      {
        text: 'Photo',
        onPress: async () => {
          try {
            const result = await launchImageLibraryAsync({quality: 0.8, mediaTypes: MediaTypeOptions.Images});
            if (result.canceled) return;
            const asset = result.assets[0];
            if (asset.fileSize && asset.fileSize > 9 * 1024 * 1024) return Toast.show({type: 'error', text2: 'File size must be less than 9MB'});

            setFile({
              uri: asset.uri,
              size: asset.fileSize,
              mimeType: asset.mimeType || 'image/jpeg',
              name: asset.fileName || `photo_${Date.now()}.jpg`,
            });
          } catch (error: any) {
            Toast.show({type: 'error', text2: error?.message || 'Error occurred during photo selection'});
          }
        },
      },
      {
        text: 'Document',
        onPress: async () => {
          try {
            const result = await getDocumentAsync({multiple: false});
            if (result.canceled) return;
            const file = result.assets[0];
            if (file.size && file.size > 9 * 1024 * 1024) return Toast.show({type: 'error', text2: 'File size must be less than 9MB'});
            setFile(file);
          } catch (error: any) {
            Toast.show({type: 'error', text2: error?.message || 'Error occurred during file selection'});
          }
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const handleSave = async () => {
    if (!initialData) return;

    const trimmedPhone = editedInfo.phone?.trim() || '';
    const isSubmittingForApproval = ['onboarding', 'reject'].includes(initialData.status || '');

    setIsSaving(true);
    try {
      if (isSubmittingForApproval) {
        if (!initialData.country && !providerCountry) {
          Toast.show({type: 'error', text2: 'Please select your country location'});
          return setIsSaving(false);
        }
        if (!idType) {
          Toast.show({type: 'error', text2: 'Please select an ID type'});
          return setIsSaving(false);
        }
        if (!idPhotoFrontUrl && !idPhotoFront) {
          Toast.show({type: 'error', text2: 'Please upload the front of your ID'});
          return setIsSaving(false);
        }
        if (!documentUrl && !document) {
          Toast.show({type: 'error', text2: 'Please upload your tax form/business registration'});
          return setIsSaving(false);
        }
      }
      // We store phone and country_code separately in the DB.

      let uploadedImagePath: string | null | undefined = undefined;

      // 0. Upload Image if changed
      if (profileImage && profileImage !== initialData.image) {
        // Delete the old image first (handles extension changes like .jpeg → .png)
        if (initialData.image) {
          const oldPath = initialData.image.startsWith('http') ? (initialData.image.match(/\/profile\/(.+?)(?:\?|$)/)?.[1] ?? '') : initialData.image;
          if (oldPath) await supabase.storage.from('profile').remove([oldPath]);
        }

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

      // Resolve cache-busted public URL for auth metadata (bypasses React Native image cache)
      const resolvedImageUrl = uploadedImagePath
        ? `${supabase.storage.from('profile').getPublicUrl(uploadedImagePath).data.publicUrl}?t=${Date.now()}`
        : undefined;

      // 1. Update Profile (Phone & Image & Country Code)
      const countryCode = selectedCountry?.cca2 || initialData.countryCode || '';
      const profileUpdates: any = {phone: trimmedPhone || null, country_code: countryCode};
      if (uploadedImagePath !== undefined) {
        profileUpdates.image = uploadedImagePath; // relative path in DB
      }

      if (isSubmittingForApproval) {
        profileUpdates.status = 'pending';
      }

      const {error: profileError} = await supabase.from('profile').update(profileUpdates).eq('id', initialData.id);

      if (profileError) throw profileError;

      // 1.5 Handle Onboarding Document Uploads if needed
      let finalDocumentPath = documentUrl;
      let finalIdPhotoFrontPath = idPhotoFrontUrl;
      let finalIdPhotoBackPath = idPhotoBackUrl;

      if (document) {
        const file = await uploadFile(document, 'provider_docs', `${initialData.id}/${document.name || (document as any).fileName || 'doc.pdf'}`);
        if (file.error) throw file.error;
        finalDocumentPath = file.data?.path || null;
      }
      if (idPhotoFront) {
        const fileName = idPhotoFront.name || (idPhotoFront as any).fileName || 'front.jpg';
        const file = await uploadFile(idPhotoFront, 'provider_docs', `${initialData.id}/id_photo_front_${fileName}`);
        if (file.error) throw file.error;
        finalIdPhotoFrontPath = file.data?.path || null;
      }
      if (idPhotoBack) {
        const fileName = idPhotoBack.name || (idPhotoBack as any).fileName || 'back.jpg';
        const file = await uploadFile(idPhotoBack, 'provider_docs', `${initialData.id}/id_photo_back_${fileName}`);
        if (file.error) throw file.error;
        finalIdPhotoBackPath = file.data?.path || null;
      }

      // 2. Update Provider table (Optional Info & Terms & Onboarding Info)
      const providerDataToUpsert: any = {
        id: initialData.id,
        country: providerCountry?.name?.common || initialData.country,
        description: editedInfo.description,
        service_type: editedInfo.service_type,
        pricing: editedInfo.pricing,
        session_duration: editedInfo.session_duration,
        language: editedInfo.language,
        location: lat && lng ? `POINT(${lng} ${lat})` : null,
        type: editedInfo.providerType,
      };

      if (isSubmittingForApproval) {
        providerDataToUpsert.id_type = idType;
        if (finalDocumentPath) providerDataToUpsert.document = finalDocumentPath;
        if (finalIdPhotoFrontPath || finalIdPhotoBackPath) {
          providerDataToUpsert.id_photo = [finalIdPhotoFrontPath, finalIdPhotoBackPath].filter(Boolean) as string[];
        }
      }

      const {error: providerError} = await supabase.from('provider').upsert(providerDataToUpsert);

      if (providerError) throw providerError;

      // Also update auth user metadata (use full URL so Avatar sees changed URL)
      await supabase.auth.updateUser({data: {full_name: editedInfo.fullName, ...(resolvedImageUrl ? {image: resolvedImageUrl} : {})}});

      // Refresh session so all store subscribers (HomeHeader, etc.) update instantly
      const {data: refreshed} = await supabase.auth.refreshSession();
      if (refreshed?.session) setSession(refreshed.session);

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

        {isFetching || !initialData ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#00594f" />
            <Body className="mt-4 text-gray-500">Loading your profile data...</Body>
          </View>
        ) : (
          <>
            <ScrollView className="flex-1 px-6 pb-12 pt-6" showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 100}}>
              <View className="mb-6 items-center">
                <TouchableOpacity onPress={isEditable ? handleImagePick : undefined} activeOpacity={isEditable ? 0.2 : 1}>
                  <View className="relative">
                    {profileImage ? (
                      <Image source={{uri: profileImage}} className="h-[100px] w-[100px] rounded-full" />
                    ) : (
                      <View className="h-[100px] w-[100px] items-center justify-center rounded-full bg-gray-200">
                        <Ionicons name="person" size={40} color="#666" />
                      </View>
                    )}
                    {isEditable && (
                      <View className="absolute bottom-0 right-0 h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-primary">
                        <Ionicons name="camera" size={14} color="#FFF" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* SECTION 1: Basic Info */}
              <View className="mb-8 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <H3 className="mb-4 text-lg font-bold text-[#1F1F1F]">Basic Info</H3>

                {/* Legal Name */}
                <Body className="mb-1 text-sm font-medium text-gray-500">Legal Name</Body>
                <TextInput
                  editable={isEditable}
                  value={isEditable ? editedInfo.fullName : initialData?.fullName || ''}
                  onChangeText={(text) => setEditedInfo((prev) => ({...prev, fullName: text}))}
                  className={`mb-4 h-14 justify-center rounded-xl border border-gray-200 px-4 ${isEditable ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-500'}`}
                  placeholder="Legal Name"
                  placeholderTextColor="#9ca3af"
                />

                {/* Email (Read Only) */}
                <Body className="mb-1 text-sm font-medium text-gray-500">Email</Body>
                <View className="mb-4 h-14 justify-center rounded-xl border border-gray-200 bg-gray-100 px-4">
                  <Body className=" !lowercase text-gray-500">{initialData?.email}</Body>
                </View>

                {/* Country */}
                <Body className="mb-1 text-sm font-medium text-gray-500">Country Location</Body>
                <TouchableOpacity
                  disabled={!isEditable}
                  onPress={() => setShowCountryPicker(true)}
                  className={`mb-4 h-14 flex-row items-center justify-between rounded-xl border border-gray-200 px-4 ${isEditable ? 'bg-white' : 'bg-gray-100'}`}>
                  <View className="flex-row items-center">
                    {providerCountry ? (
                      <>
                        <Body className={`mr-2 text-xl ${!isEditable ? 'opacity-70' : ''}`}>{providerCountry?.flag}</Body>
                        <Body className={` ${isEditable ? 'text-black' : 'text-gray-500'}`}>{providerCountry.name.common}</Body>
                      </>
                    ) : initialData?.country ? (
                      <Body className={` ${isEditable ? 'text-black' : 'text-gray-500'}`}>{initialData.country}</Body>
                    ) : (
                      <Body className=" text-[#999]">Select Country</Body>
                    )}
                  </View>
                  {isEditable && <Ionicons name="chevron-down" size={20} color="#999" />}
                </TouchableOpacity>

                {/* Provider Type */}
                <Body className="mb-1 text-sm font-medium text-gray-500">Provider Type</Body>
                <TouchableOpacity
                  disabled={!isEditable}
                  onPress={() => setShowProviderTypePicker(true)}
                  className={`mb-4 h-14 flex-row items-center justify-between rounded-xl border border-gray-200 px-4 ${isEditable ? 'bg-white' : 'bg-gray-100'}`}>
                  <View className="flex-row items-center">
                    {editedInfo.providerType ? (
                      <Body className={` capitalize ${isEditable ? 'text-black' : 'text-gray-500'}`}>{editedInfo.providerType}</Body>
                    ) : initialData?.providerType && !isEditable ? (
                      <Body className=" capitalize text-gray-500">{initialData.providerType}</Body>
                    ) : (
                      <Body className=" text-[#999]">Select Provider Type</Body>
                    )}
                  </View>
                  {isEditable && <Ionicons name="chevron-down" size={20} color="#999" />}
                </TouchableOpacity>

                {/* Phone */}
                <Body className="mb-1 font-nunito text-sm font-medium text-gray-700">Phone</Body>
                <View pointerEvents={isEditable ? 'auto' : 'none'}>
                  <PhoneInputField
                    value={editedInfo.phone}
                    placeholder={t('profile.placeholderPhone')}
                    selectedCountry={selectedCountry}
                    onChangeSelectedCountry={setSelectedCountry}
                    onChangePhoneNumber={(text) => isEditable && setEditedInfo((p) => ({...p, phone: text}))}
                    defaultCountry={(initialData?.countryCode as any) || 'US'}
                  />
                </View>
              </View>

              {/* SECTION 2: Verification Documents */}
              <View className="mb-8 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <H3 className="mb-4 text-lg font-bold text-[#1F1F1F]">Verification Documents</H3>

                {/* ID Type Selection */}
                <Body className="mb-1 text-sm font-medium text-gray-700">ID Type</Body>
                <TouchableOpacity
                  disabled={!isEditable}
                  onPress={() => setShowIdTypePicker(true)}
                  className={`mb-4 h-14 flex-row items-center justify-between rounded-xl border border-gray-200 px-4 ${isEditable ? 'bg-white' : 'bg-gray-100'}`}>
                  <View className="flex-row items-center">
                    {idType ? (
                      <Body className={` ${isEditable ? 'text-black' : 'text-gray-500'}`}>
                        {ID_TYPES.find((t) => t.value === idType)?.label || idType}
                      </Body>
                    ) : !isEditable ? (
                      <Body className=" text-gray-500">Not Provided</Body>
                    ) : (
                      <Body className=" text-[#999]">Select ID Type</Body>
                    )}
                  </View>
                  {isEditable && <Ionicons name="chevron-down" size={20} color="#999" />}
                </TouchableOpacity>

                {/* ID Photo Upload (Front & Back) */}
                <Body className="mb-2 text-sm font-medium text-gray-700">Upload ID Document / Photo</Body>
                <View className="mb-4 w-full flex-row justify-between space-x-2">
                  {/* Front Side */}
                  <View className="mr-2 flex-1">
                    {idPhotoFront || idPhotoFrontUrl ? (
                      <View className="relative h-32 w-full overflow-hidden rounded-lg border border-gray-300">
                        {idPhotoFront?.mimeType?.startsWith('image/') || idPhotoFrontUrl ? (
                          <Image
                            source={{
                              uri: idPhotoFront?.uri || supabase.storage.from('provider_docs').getPublicUrl(idPhotoFrontUrl!).data.publicUrl,
                            }}
                            className="h-full w-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="h-full w-full items-center justify-center bg-gray-50">
                            <Ionicons name="document-text" size={40} color="#00594f" />
                            <Body className="mt-2 px-4 text-center text-xs font-bold text-primary" numberOfLines={1}>
                              {idPhotoFront?.name || 'Document'}
                            </Body>
                          </View>
                        )}
                        {isEditable && (
                          <TouchableOpacity
                            onPress={() => {
                              setIdPhotoFront(null);
                              setIdPhotoFrontUrl(null);
                            }}
                            className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-white/80 shadow-sm">
                            <Ionicons name="close" size={16} color="#333" />
                          </TouchableOpacity>
                        )}
                        <View className="absolute bottom-0 left-0 right-0 bg-black/50 py-1">
                          <Body className="text-center text-xs text-white">Front Side</Body>
                        </View>
                      </View>
                    ) : isEditable ? (
                      <TouchableOpacity
                        onPress={() => handleFilePick(setIdPhotoFront)}
                        className="h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
                        <Ionicons size={24} color="#9CA3AF" name="cloud-upload-outline" />
                        <Body className="mt-2 px-2 text-center text-xs text-gray-500">Tap to upload Front Side</Body>
                      </TouchableOpacity>
                    ) : (
                      <View className="h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                        <Body className="text-gray-400">Not Provided</Body>
                      </View>
                    )}
                  </View>

                  {/* Back Side */}
                  <View className="flex-1">
                    {idPhotoBack || idPhotoBackUrl ? (
                      <View className="relative h-32 w-full overflow-hidden rounded-lg border border-gray-300">
                        {idPhotoBack?.mimeType?.startsWith('image/') || idPhotoBackUrl ? (
                          <Image
                            source={{
                              uri: idPhotoBack?.uri || supabase.storage.from('provider_docs').getPublicUrl(idPhotoBackUrl!).data.publicUrl,
                            }}
                            className="h-full w-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="h-full w-full items-center justify-center bg-gray-50">
                            <Ionicons name="document-text" size={40} color="#00594f" />
                            <Body className="mt-2 px-4 text-center text-xs font-bold text-primary" numberOfLines={1}>
                              {idPhotoBack?.name || 'Document'}
                            </Body>
                          </View>
                        )}
                        {isEditable && (
                          <TouchableOpacity
                            onPress={() => {
                              setIdPhotoBack(null);
                              setIdPhotoBackUrl(null);
                            }}
                            className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-white/80 shadow-sm">
                            <Ionicons name="close" size={16} color="#333" />
                          </TouchableOpacity>
                        )}
                        <View className="absolute bottom-0 left-0 right-0 bg-black/50 py-1">
                          <Body className="text-center text-xs text-white">Back Side</Body>
                        </View>
                      </View>
                    ) : isEditable ? (
                      <TouchableOpacity
                        onPress={() => handleFilePick(setIdPhotoBack)}
                        className="h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
                        <Ionicons size={24} color="#9CA3AF" name="cloud-upload-outline" />
                        <Body className="mt-2 px-2 text-center text-xs text-gray-500">Tap to upload Back Side</Body>
                      </TouchableOpacity>
                    ) : (
                      <View className="h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                        <Body className="text-gray-400">Not Provided</Body>
                      </View>
                    )}
                  </View>
                </View>

                {/* Document Upload */}
                <Body className="mb-2 text-sm font-medium text-gray-700">Tax Form / Business Registration</Body>
                {document || documentUrl ? (
                  <View className="relative mb-4 h-32 w-full overflow-hidden rounded-lg border border-gray-300">
                    {document?.mimeType?.startsWith('image/') ? (
                      <Image source={{uri: document.uri}} className="h-full w-full" resizeMode="cover" />
                    ) : (
                      <View className="h-full w-full items-center justify-center bg-gray-50">
                        <Ionicons name="document-text" size={40} color="#00594f" />
                        <Body className="mt-2 px-4 text-center text-sm font-bold text-primary" numberOfLines={1}>
                          {document?.name || 'Document uploaded'}
                        </Body>
                      </View>
                    )}
                    {isEditable && (
                      <TouchableOpacity
                        onPress={() => {
                          setDocument(null);
                          setDocumentUrl(null);
                        }}
                        className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-sm">
                        <Ionicons name="close" size={20} color="#333" />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : isEditable ? (
                  <TouchableOpacity
                    onPress={() => handleFilePick(setDocument)}
                    className="mb-4 h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
                    <Ionicons size={32} color="#9CA3AF" name="cloud-upload-outline" />
                    <Body className="mt-2 px-4 text-center text-sm text-gray-500">Tap to upload document</Body>
                  </TouchableOpacity>
                ) : (
                  <View className="mb-4 h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    <Body className="text-gray-400">Not Provided</Body>
                  </View>
                )}
              </View>

              {/* SECTION 3: Provider Details (Optional) */}
              <View className="mb-8 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <H3 className="mb-4 text-lg font-bold text-[#1F1F1F]">Provider Details (Optional)</H3>

                {/* Description */}
                <Body className="mb-1 text-sm font-medium text-gray-700">Describe your service/event</Body>
                <TextInput
                  editable={isEditable && !isSaving}
                  value={editedInfo.description || ''}
                  onChangeText={(text) => setEditedInfo((p) => ({...p, description: text}))}
                  placeholder="Tell clients about what you offer..."
                  multiline
                  numberOfLines={4}
                  className={`mb-4 min-h-[100px] rounded-xl border border-gray-200 p-4  ${isEditable && !isSaving ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-500'}`}
                  style={{textAlignVertical: 'top'}}
                />

                {/* Service Type */}
                <Body className="mb-1 text-sm font-medium text-gray-700">Type of Service/Event</Body>
                <View className="mb-4 flex-row gap-2">
                  {SERVICE_TYPES.map((type) => (
                    <TouchableOpacity
                      disabled={!isEditable}
                      key={type}
                      onPress={() => setServiceType(type)}
                      className={`flex-1 items-center justify-center rounded-xl border py-3 ${
                        editedInfo.service_type === type
                          ? isEditable
                            ? 'border-primary bg-primary/10'
                            : 'border-primary/50 bg-primary/5'
                          : isEditable
                            ? 'border-gray-200 bg-white'
                            : 'border-gray-200 bg-gray-100'
                      }`}>
                      <Body
                        className={`font-nunito-bold text-sm ${
                          editedInfo.service_type === type ? (isEditable ? 'text-primary' : 'text-primary/70') : 'text-gray-500'
                        }`}>
                        {type}
                      </Body>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Pricing */}
                <Body className="mb-1 text-sm font-medium text-gray-700">Pricing</Body>
                <TextInput
                  editable={isEditable && !isSaving}
                  value={editedInfo.pricing || ''}
                  onChangeText={(text) => setEditedInfo((p) => ({...p, pricing: text}))}
                  placeholder="e.g. $50/hr, Varies"
                  className={`mb-4 h-14 rounded-xl border border-gray-200 px-4  ${isEditable && !isSaving ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-500'}`}
                />

                {/* Session Duration */}
                <Body className="mb-1 text-sm font-medium text-gray-700">Session Duration</Body>
                <TextInput
                  editable={isEditable && !isSaving}
                  value={editedInfo.session_duration || ''}
                  onChangeText={(text) => setEditedInfo((p) => ({...p, session_duration: text}))}
                  placeholder="e.g. 60 minutes, 2 hours"
                  className={`mb-4 h-14 rounded-xl border border-gray-200 px-4 ${isEditable && !isSaving ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-500'}`}
                />

                {/* Language */}
                <Body className="mb-1 text-sm font-medium text-gray-700">Language</Body>
                <TextInput
                  editable={isEditable && !isSaving}
                  value={editedInfo.language || ''}
                  onChangeText={(text) => setEditedInfo((p) => ({...p, language: text}))}
                  placeholder="e.g. English, Spanish"
                  className={`mb-4 h-14 rounded-xl border border-gray-200 px-4 ${isEditable && !isSaving ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-500'}`}
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
                      {isEditable && (
                        <TouchableOpacity
                          className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center bg-black/10"
                          onPress={() => setLocationPickerVisible(true)}>
                          <View className="items-center justify-center rounded-full bg-white/90 p-2 shadow-sm">
                            <Feather name="edit-2" size={20} color="#00594f" />
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null}

                  {isEditable ? (
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
                  ) : (
                    !lat && (
                      <View className="flex-row items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <Feather name="map-pin" size={20} color="#9CA3AF" />
                        <Body className="ml-2 font-nunito-bold text-gray-500">Not Provided</Body>
                      </View>
                    )
                  )}
                </View>
              </View>

              {/* SECTION 4: Agree below Terms */}
              <View className="mb-8 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <H3 className="mb-4 text-lg font-bold text-[#1F1F1F]">Agree below Terms</H3>
                {PROVIDER_TERMS_AGREEMENTS.map((term) => (
                  <View key={term.id} className="mb-4 flex-row items-center gap-3">
                    <View className="h-6 w-6 items-center justify-center rounded border border-primary bg-primary">
                      <Ionicons name="checkmark" size={16} color="white" />
                    </View>
                    <Body className="flex-1 text-sm text-gray-700">
                      {term.prefix}{' '}
                      <Body className="font-nunito-bold text-primary" onPress={() => openLegalModal(term.id, term.link)}>
                        {term.link}
                      </Body>
                    </Body>
                  </View>
                ))}
              </View>
            </ScrollView>

            <LocationPickerModal
              visible={isLocationPickerVisible}
              onClose={() => setLocationPickerVisible(false)}
              initialLocation={lat && lng ? {lat, lng} : deviceLocation ? {lat: deviceLocation.latitude, lng: deviceLocation.longitude} : null}
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
                  <Body className="font-nunito-bold  text-gray-700">{isEditable ? 'Cancel' : 'Close'}</Body>
                </TouchableOpacity>

                {isEditable && (
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving}
                    className={`flex-1 items-center justify-center rounded-xl bg-primary py-4 ${isSaving ? 'opacity-60' : ''}`}>
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Body className="font-nunito-bold  text-white">
                        {['onboarding', 'reject'].includes(initialData?.status || '') ? 'Submit for Approval' : 'Save Changes'}
                      </Body>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <View style={{height: insets.bottom}} />
            </Animated.View>
          </>
        )}

        {/* Modals */}
        <CountrySelect
          visible={showCountryPicker}
          onClose={() => setShowCountryPicker(false)}
          onSelect={(country) => {
            setProviderCountry(country);
            setShowCountryPicker(false);
          }}
          countryItemComponent={(item) => (
            <View className="flex-row items-center border-b border-gray-100 bg-white px-4 py-3">
              <Body className="mr-3 text-2xl">{item.flag}</Body>
              <Body className=" text-black">{item.name.common}</Body>
            </View>
          )}
        />

        <Modal visible={showIdTypePicker} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/50">
            <View className="rounded-t-3xl bg-white p-6 pb-10">
              <View className="mb-4 flex-row items-center justify-between">
                <H3 className="text-xl">Select ID Type</H3>
                <TouchableOpacity onPress={() => setShowIdTypePicker(false)}>
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>
              </View>
              {ID_TYPES.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => {
                    setIdType(item.value);
                    setShowIdTypePicker(false);
                  }}
                  className="border-b border-gray-100 py-4">
                  <Body className=" text-black">{item.label}</Body>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        <Modal visible={showProviderTypePicker} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/50">
            <View className="rounded-t-3xl bg-white p-6 pb-10">
              <View className="mb-4 flex-row items-center justify-between">
                <H3 className="text-xl">Select Provider Type</H3>
                <TouchableOpacity onPress={() => setShowProviderTypePicker(false)}>
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>
              </View>
              {PROVIDER_TYPES.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => {
                    setEditedInfo((prev) => ({...prev, providerType: item.value}));
                    setShowProviderTypePicker(false);
                  }}
                  className="border-b border-gray-100 py-4">
                  <Body className=" text-black">{item.label}</Body>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        <LegalModal visible={legalVisible} title={legalTitle} content={legalContent} onClose={() => setLegalVisible(false)} />
      </KeyboardAvoidingView>
    </Modal>
  );
};
