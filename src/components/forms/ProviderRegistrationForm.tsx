import {useAppStore} from '@/store';
import {Feather, Ionicons} from '@expo/vector-icons';
import {Link, useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {supabase, uploadFile} from '@/utils';
import Toast from 'react-native-toast-message';
import React, {useEffect, useState} from 'react';
import {PROVIDER_LEGAL_CONTENT, PROVIDER_TERMS_AGREEMENTS} from '@/constants';
import {useForm, Controller} from 'react-hook-form';
import CountrySelect, {ICountry} from 'react-native-country-select';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {getDocumentAsync, DocumentPickerAsset} from 'expo-document-picker';
import {Image, View, TextInput, TouchableOpacity, Pressable, Linking, Alert, Modal} from 'react-native';
import {Display, H3, Button, PasswordStrengthBar, PhoneInputField, Body, Caption, GoogleSignInButton, LegalModal} from '@/components';
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {LocationPickerModal} from '../modals/LocationPickerModal';

const SERVICE_TYPES = ['Online', 'In Person', 'Hybrid'];

const ID_TYPES = [
  {label: 'Passport', value: 'passport'},
  {label: 'Driver License', value: 'driver_license'},
  {label: 'State ID', value: 'state_id'},
  {label: 'SSN Proof', value: 'ssn'},
];

type FormData = {
  email: string;
  phone: string;
  fullName: string;
  password: string;
  providerCountry: string;
  idType: string;
  description?: string;
  service_type?: string;
  pricing?: string;
  session_duration?: string;
  language?: string;
};

type Props = {googleAuth: string; googleEmail?: string; googleName?: string};

export const ProviderRegistrationForm: React.FC<Props> = ({googleAuth, googleEmail, googleName}) => {
  const {t} = useTranslation();
  const router = useRouter();
  const setSession = useAppStore((s) => s.setSession);

  const [providerTermsAgreed, setProviderTermsAgreed] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);

  const [document, setDocument] = useState<DocumentPickerAsset | null>(null);
  const [providerCountry, setProviderCountry] = useState<ICountry | null>(null);
  const [providerType, setProviderType] = useState<'individual' | 'company'>('individual');

  const [idPhotoFront, setIdPhotoFront] = useState<DocumentPickerAsset | null>(null);
  const [idPhotoBack, setIdPhotoBack] = useState<DocumentPickerAsset | null>(null);
  const [showIdTypePicker, setShowIdTypePicker] = useState(false);
  const [idPhotoFrontError, setIdPhotoFrontError] = useState<string>('');
  const [idPhotoBackError, setIdPhotoBackError] = useState<string>('');

  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [docError, setDocError] = useState<string>('');

  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTitle, setLegalModalTitle] = useState('');
  const [legalModalContent, setLegalModalContent] = useState('');

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isLocationPickerVisible, setLocationPickerVisible] = useState(false);

  const {control, formState, handleSubmit, setValue, trigger, watch} = useForm<FormData>({
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      providerCountry: '',
      idType: '',
      description: '',
      service_type: 'Online',
      pricing: '',
      session_duration: '',
      language: '',
    },
  });

  const serviceType = watch('service_type');

  useEffect(() => {
    if (googleAuth === 'true') {
      if (googleEmail) setValue('email', googleEmail);
      if (googleName) setValue('fullName', googleName);
    }
  }, [googleAuth, googleEmail, googleName, setValue]);

  const handleFilePick = async (
    setFile: React.Dispatch<React.SetStateAction<DocumentPickerAsset | null>>,
    setError: React.Dispatch<React.SetStateAction<string>>,
    errorMessage?: string
  ) => {
    try {
      const result = await getDocumentAsync({multiple: false});
      if (result.canceled) return;
      const file = result.assets[0];
      if (file.size && file.size > 9 * 1024 * 1024) return Toast.show({type: 'error', text2: 'File size must be less than 9MB'});

      setFile(file);
      setError('');
    } catch (error: any) {
      Toast.show({type: 'error', text2: error?.message || errorMessage || 'Error occurred'});
    }
  };

  const pickPdf = () => handleFilePick(setDocument, setDocError, t('role.errorDoc'));
  const pickIdPhotoFront = () => handleFilePick(setIdPhotoFront, setIdPhotoFrontError);
  const pickIdPhotoBack = () => handleFilePick(setIdPhotoBack, setIdPhotoBackError);

  const onSubmit = async (data: FormData) => {
    try {
      if (!selectedCountry) return Toast.show({type: 'error', text2: 'Please select a country code for your phone number'});
      if (!document) return setDocError(t('validation.docRequired'));

      let isValid = true;
      if (!idPhotoFront) {
        setIdPhotoFrontError(t('role.requiredIDFront'));
        isValid = false;
      }

      if (!isValid) return;

      const allTermsAgreed = PROVIDER_TERMS_AGREEMENTS.every((t) => providerTermsAgreed[t.id]);
      if (!allTermsAgreed) return Toast.show({type: 'error', text1: 'Terms Required', text2: 'Please agree to all provider terms and conditions.'});

      const {
        email,
        phone,
        password,
        fullName,
        providerCountry: formCountry,
        idType: formIdType,
        description,
        service_type,
        pricing,
        session_duration,
        language,
      } = data;
      let userId = '';

      if (googleAuth === 'true') {
        const {data: userData, error: userError} = await supabase.auth.updateUser({data: {role: 'provider', full_name: fullName}});
        if (userError) throw userError;
        if (!userData.user) throw new Error('User data missing');
        userId = userData.user.id;
      } else {
        const {data: authData, error: signUpError} = await supabase.auth.signUp({
          email,
          password,
          options: {data: {role: 'provider', full_name: fullName}},
        });
        if (signUpError) throw signUpError;
        if (!authData.user?.id) throw new Error('User ID missing after signup');
        userId = authData.user.id;
      }

      // Upload Document
      const file = await uploadFile(document!, 'provider_docs', `${userId}/${document?.name}`);
      if (file.error) throw file.error;

      // Upload ID Photo (Front)
      const idPhotoFrontFile = await uploadFile(idPhotoFront!, 'provider_docs', `${userId}/id_photo_front_${idPhotoFront?.name}`);
      if (idPhotoFrontFile.error) throw idPhotoFrontFile.error;

      // Upload ID Photo (Back) - Optional
      let idPhotoBackFile: any = null;
      if (idPhotoBack) {
        idPhotoBackFile = await uploadFile(idPhotoBack, 'provider_docs', `${userId}/id_photo_back_${idPhotoBack.name}`);
        if (idPhotoBackFile.error) throw idPhotoBackFile.error;
      }

      const {error: providerError} = await supabase.from('provider').insert({
        id: userId,
        id_type: formIdType,
        type: providerType,
        document: file.data?.path,
        id_photo: [idPhotoFrontFile.data?.path, idPhotoBackFile?.data?.path].filter(Boolean) as string[],
        country: formCountry,
        description,
        service_type,
        pricing,
        session_duration,
        language,
        location: lat && lng ? `POINT(${lng} ${lat})` : null,
      });
      if (providerError) throw providerError;

      const callingCode = selectedCountry?.callingCode || '';
      const fullPhoneNumber = callingCode ? `${callingCode} ${phone}` : phone;
      const countryCode = selectedCountry?.cca2 || '';

      const {error: profileError} = await supabase.from('profile').upsert({
        id: userId,
        name: fullName,
        role: 'provider',
        status: 'pending',
        phone: fullPhoneNumber,
        country_code: countryCode,
      });

      if (profileError) throw profileError;

      Toast.show({type: 'success', text2: t('auth.register.success')});

      if (googleAuth === 'true') {
        const session = await supabase.auth.getSession();
        if (session.data.session) {
          setSession(session.data.session);
          router.replace('/(provider)/under-review');
        }
      } else {
        router.replace('/(provider)/under-review');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || JSON.stringify(e));
      Toast.show({type: 'error', text1: e?.message});
    }
  };

  const handleOpenLegalModal = (termId: string, label: string) => {
    const content = (PROVIDER_LEGAL_CONTENT as any)[termId] || '(Content coming soon)';
    setLegalModalTitle(label);
    setLegalModalContent(content);
    setShowLegalModal(true);
  };

  return (
    <Animated.View entering={FadeInUp.delay(400)} className="px-6">
      {/* FULL NAME */}
      <Controller
        name="fullName"
        control={control}
        rules={{
          required: t('validation.fullNameRequired'),
          validate: (val) => {
            if (!/^[A-Za-z\s]+$/.test(val)) return t('validation.fullNameAlphabets');
            const parts = val.trim().split(' ');
            if (parts.length < 2) return t('validation.fullNameTwoWords');
            return true;
          },
        }}
        render={({field, fieldState}) => (
          <View className="mb-4">
            <View
              className={`rounded-xl border bg-gray-50 ${fieldState.error ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-primary'}`}>
              <TextInput
                {...field}
                autoCapitalize="words"
                placeholderTextColor="#999"
                onChangeText={field.onChange}
                placeholder={t('auth.register.fullNamePlaceholder')}
                style={{fontFamily: 'Nunito_400Regular'}}
                className="m-0 h-14 px-4 text-base leading-5 text-black"
              />
            </View>
            {fieldState.error && <Caption className="ml-2 mt-1 text-red-500">{fieldState.error.message}</Caption>}
          </View>
        )}
      />

      {/* EMAIL */}
      <Controller
        name="email"
        control={control}
        rules={{required: t('validation.emailRequired'), pattern: {value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('validation.emailInvalid')}}}
        render={({field, fieldState}) => (
          <View className="mb-4">
            <View
              className={`rounded-xl border bg-gray-50 ${fieldState.error ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-primary'}`}>
              <TextInput
                {...field}
                editable={googleAuth !== 'true'}
                autoCapitalize="none"
                placeholderTextColor="#999"
                keyboardType="email-address"
                onChangeText={field.onChange}
                placeholder={t('auth.register.emailPlaceholder')}
                style={{fontFamily: 'Nunito_400Regular'}}
                className={`m-0 h-14 px-4 text-base leading-5 text-black ${googleAuth === 'true' ? 'text-gray-500' : ''}`}
              />
            </View>
            {fieldState.error && <Caption className="ml-2 mt-1 text-red-500">{fieldState.error.message}</Caption>}
          </View>
        )}
      />

      {/* PHONE */}
      <Controller
        name="phone"
        control={control}
        rules={{required: t('validation.phoneRequired')}}
        render={({field, fieldState}) => (
          <PhoneInputField
            value={field.value}
            onChangePhoneNumber={field.onChange}
            selectedCountry={selectedCountry}
            onChangeSelectedCountry={setSelectedCountry}
            error={fieldState.error}
            placeholder={t('auth.register.phonePlaceholder')}
          />
        )}
      />

      {/* PROVIDER SPECIFIC FIELDS */}
      <Animated.View entering={FadeInDown.delay(100)} className="mb-4">
        {/* Provider Type Selection */}
        <View className="mb-4">
          <Body className="mb-2 ml-1 text-sm text-gray-700">Provider Type</Body>
          <View className="flex-row rounded-xl bg-gray-100 p-1">
            <TouchableOpacity
              onPress={() => setProviderType('individual')}
              className={`flex-1 items-center justify-center rounded-lg py-3 ${providerType === 'individual' ? 'bg-white shadow-sm' : 'shadow-none'}`}>
              <Body className={`font-nunito-bold text-sm ${providerType === 'individual' ? 'text-primary' : 'text-gray-500'}`}>Individual</Body>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setProviderType('company')}
              className={`flex-1 items-center justify-center rounded-lg py-3 ${providerType === 'company' ? 'bg-white shadow-sm' : 'shadow-none'}`}>
              <Body className={`font-nunito-bold text-sm ${providerType === 'company' ? 'text-primary' : 'text-gray-500'}`}>Company</Body>
            </TouchableOpacity>
          </View>
        </View>

        {/* Country Selection */}
        <Controller
          name="providerCountry"
          control={control}
          rules={{required: 'Please select a country'}}
          render={({field, fieldState}) => (
            <View className="mb-4">
              <Body className="mb-2 ml-1 text-sm text-gray-700">Country Location</Body>
              <TouchableOpacity
                onPress={() => setShowCountryPicker(true)}
                className={`h-14 flex-row items-center justify-between rounded-xl border bg-gray-50 px-4 ${fieldState.error ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                <View className="flex-row items-center">
                  {field.value ? (
                    <>
                      <Body className="mr-2 text-xl">{providerCountry?.flag}</Body>
                      <Body className="text-base text-black">{field.value}</Body>
                    </>
                  ) : (
                    <Body className="text-base text-[#999]">Select Country</Body>
                  )}
                </View>
                <Ionicons name="chevron-down" size={20} color="#999" />
              </TouchableOpacity>
              {fieldState.error && <Caption className="ml-2 mt-1 text-red-500">{fieldState.error.message}</Caption>}
            </View>
          )}
        />

        {/* ID Type Selection */}
        <Controller
          name="idType"
          control={control}
          rules={{required: 'Please select an ID type'}}
          render={({field, fieldState}) => (
            <View className="mb-4">
              <Body className="mb-2 ml-1 text-sm text-gray-700">ID Type</Body>
              <TouchableOpacity
                onPress={() => setShowIdTypePicker(true)}
                className={`h-14 flex-row items-center justify-between rounded-xl border bg-gray-50 px-4 ${fieldState.error ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                <View className="flex-row items-center">
                  {field.value ? (
                    <Body className="text-base text-black">{ID_TYPES.find((t) => t.value === field.value)?.label}</Body>
                  ) : (
                    <Body className="text-base text-[#999]">Select ID Type</Body>
                  )}
                </View>
                <Ionicons name="chevron-down" size={20} color="#999" />
              </TouchableOpacity>
              {fieldState.error && <Caption className="ml-2 mt-1 text-red-500">{fieldState.error.message}</Caption>}
            </View>
          )}
        />

        {/* ID Photo Upload (Front & Back) */}
        <View className="mb-4">
          <Body className="mb-2 ml-1 text-sm text-gray-700">Upload ID Document / Photo</Body>
          <View className="w-full flex-row justify-between space-x-2">
            {/* Front Side */}
            <View className="mr-2 flex-1">
              {idPhotoFront ? (
                <View className="relative h-32 w-full overflow-hidden rounded-lg border border-gray-300">
                  {idPhotoFront.mimeType?.startsWith('image/') ? (
                    <Image source={{uri: idPhotoFront.uri}} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-gray-50">
                      <Ionicons name="document-text" size={40} color="#00594f" />
                      <Body className="mt-2 px-4 text-center text-xs font-bold text-primary" numberOfLines={1} ellipsizeMode="middle">
                        {idPhotoFront.name}
                      </Body>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => setIdPhotoFront(null)}
                    className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-white/80"
                    style={{shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2}}>
                    <Ionicons name="close" size={16} color="#333" />
                  </TouchableOpacity>
                  <View className="absolute bottom-0 left-0 right-0 bg-black/50 py-1">
                    <Body className="text-center text-xs text-white">Front Side</Body>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={pickIdPhotoFront}
                  className={`h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-gray-50 ${idPhotoFrontError ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}>
                  <Ionicons size={24} color="#9CA3AF" name="cloud-upload-outline" />
                  <Body className="mt-2 px-2 text-center text-xs text-gray-500">Tap to upload Front Side</Body>
                </Pressable>
              )}
              {idPhotoFrontError ? <Caption className="mt-1 text-xs text-red-500">{idPhotoFrontError}</Caption> : null}
            </View>

            {/* Back Side */}
            <View className="flex-1">
              {idPhotoBack ? (
                <View className="relative h-32 w-full overflow-hidden rounded-lg border border-gray-300">
                  {idPhotoBack.mimeType?.startsWith('image/') ? (
                    <Image source={{uri: idPhotoBack.uri}} className="h-full w-full" resizeMode="cover" />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-gray-50">
                      <Ionicons name="document-text" size={40} color="#00594f" />
                      <Body className="mt-2 px-4 text-center text-xs font-bold text-primary" numberOfLines={1} ellipsizeMode="middle">
                        {idPhotoBack.name}
                      </Body>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => setIdPhotoBack(null)}
                    className="absolute right-2 top-2 h-6 w-6 items-center justify-center rounded-full bg-white/80"
                    style={{shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2}}>
                    <Ionicons name="close" size={16} color="#333" />
                  </TouchableOpacity>
                  <View className="absolute bottom-0 left-0 right-0 bg-black/50 py-1">
                    <Body className="text-center text-xs text-white">Back Side</Body>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={pickIdPhotoBack}
                  className={`h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-gray-50 ${idPhotoBackError ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}>
                  <Ionicons size={24} color="#9CA3AF" name="cloud-upload-outline" />
                  <Body className="mt-2 px-2 text-center text-xs text-gray-500">Tap to upload Back Side</Body>
                </Pressable>
              )}
              {idPhotoBackError ? <Caption className="mt-1 text-xs text-red-500">{idPhotoBackError}</Caption> : null}
            </View>
          </View>
        </View>

        {/* Document Upload */}
        <View className="mb-4">
          <Body className="mb-2 ml-1 text-sm text-gray-700">Tax Form / Business Registration</Body>
          {document ? (
            <View className="relative h-32 w-full overflow-hidden rounded-lg border border-gray-300">
              {document.mimeType?.startsWith('image/') ? (
                <Image source={{uri: document.uri}} className="h-full w-full" resizeMode="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center bg-gray-50">
                  <Ionicons name="document-text" size={40} color="#00594f" />
                  <Body className="mt-2 px-4 text-center text-sm font-bold text-primary" numberOfLines={1} ellipsizeMode="middle">
                    {document.name}
                  </Body>
                </View>
              )}
              <TouchableOpacity
                onPress={() => setDocument(null)}
                className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/80"
                style={{shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2}}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>
          ) : (
            <Pressable
              onPress={pickPdf}
              className={`h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-gray-50 ${docError ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}>
              <Ionicons size={32} color="#9CA3AF" name="cloud-upload-outline" />
              <Body className="mt-2 px-4 text-center text-sm text-gray-500">
                {providerCountry?.name?.common === 'United States'
                  ? t('role.uploadW9')
                  : providerCountry
                    ? t('role.uploadW8')
                    : t('role.uploadFileNote')}
              </Body>
            </Pressable>
          )}
          {docError ? <Caption className="ml-2 mt-1 text-red-500">{docError}</Caption> : null}
        </View>

        {/* Tax Forms Download */}
        {providerCountry && (
          <View className="mb-4 mt-2">
            {providerCountry.name.common === 'United States' ? (
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    'https://rkklysphyvikclqgivgq.supabase.co/storage/v1/object/sign/provider_docs/Certificates/fw9.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jZTNjZDU5NC00M2Y1LTQ5YjAtOGM5OC1kYTE2ZTYyMTFiZmUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwcm92aWRlcl9kb2NzL0NlcnRpZmljYXRlcy9mdzkucGRmIiwiaWF0IjoxNzcxMTY0ODYyLCJleHAiOjQ5MjQ3NjQ4NjJ9.fiTvuZ8fKFAHkfKmQctGyxIoKoOie10Rr42cZMkliD0'
                  )
                }>
                <Body className="text-sm text-secondary underline">Download W-9 Form</Body>
              </TouchableOpacity>
            ) : (
              <View className="flex-row gap-4">
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(
                      'https://rkklysphyvikclqgivgq.supabase.co/storage/v1/object/sign/provider_docs/Certificates/fw8ben.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jZTNjZDU5NC00M2Y1LTQ5YjAtOGM5OC1kYTE2ZTYyMTFiZmUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwcm92aWRlcl9kb2NzL0NlcnRpZmljYXRlcy9mdzhiZW4ucGRmIiwiaWF0IjoxNzcxMTY0ODQzLCJleHAiOjQ5MjQ3NjQ4NDN9.bls1cQ93adnLTDr2BGUuJ3fQk6Tbypzcb-aMnrOgzog'
                    )
                  }>
                  <Body className="text-sm text-secondary underline">Download W-8BEN Form</Body>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(
                      'https://rkklysphyvikclqgivgq.supabase.co/storage/v1/object/sign/provider_docs/Certificates/fw8ben-e.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jZTNjZDU5NC00M2Y1LTQ5YjAtOGM5OC1kYTE2ZTYyMTFiZmUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwcm92aWRlcl9kb2NzL0NlcnRpZmljYXRlcy9mdzhiZW4tZS5wZGYiLCJpYXQiOjE3NzExNjQ3MTMsImV4cCI6NDkyNDc2NDcxM30.nOFy8GVHnosGHdmx865PbkxvGkjkEOIyEd8fCR7Pznk'
                    )
                  }>
                  <Body className="text-sm text-secondary underline">Download W-8BEN-E Form</Body>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </Animated.View>

      {/* PASSWORD */}
      {googleAuth !== 'true' && (
        <Controller
          name="password"
          control={control}
          rules={{
            required: t('validation.passwordRequired'),
            minLength: {value: 8, message: t('validation.passwordMinLength', {count: 8})},
            validate: (val) => {
              if (!/[A-Z]/.test(val)) return t('validation.passwordUppercase');
              if (!/[a-z]/.test(val)) return t('validation.passwordLowercase');
              if (!/[0-9]/.test(val)) return t('validation.passwordNumber');
              if (!/[!@#$%^&*(),.?":{}|<>]/.test(val)) return t('validation.passwordSpecial');
              return true;
            },
          }}
          render={({field, fieldState}) => (
            <View className="mb-4">
              <View
                className={`rounded-xl border bg-gray-50 ${fieldState.error ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-primary'}`}>
                <View className="flex-row items-center">
                  <TextInput
                    {...field}
                    placeholderTextColor="#999"
                    onChangeText={field.onChange}
                    secureTextEntry={!showPassword}
                    placeholder={t('auth.register.passwordPlaceholder')}
                    style={{fontFamily: 'Nunito_400Regular'}}
                    className="m-0 h-14 flex-1 px-4 text-base leading-5 text-black"
                  />
                  <TouchableOpacity className="mr-2 p-2" onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                <PasswordStrengthBar password={field?.value || ''} visible={!!field?.value} />
              </View>
              {fieldState.error && <Caption className="ml-2 mt-1 text-red-500">{fieldState.error.message}</Caption>}
            </View>
          )}
        />
      )}

      <View className="mb-8 rounded-2xl border border-gray-100 bg-gray-50 p-5">
        <H3 className="mb-4 text-lg font-bold text-[#1F1F1F]">General Details</H3>

        {/* Description */}
        <Body className="mb-1 text-sm font-medium text-gray-700">Describe your service/event</Body>
        <Controller
          name="description"
          control={control}
          render={({field}) => (
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              placeholder="Tell clients about what you offer..."
              multiline
              numberOfLines={4}
              className="mb-4 min-h-[100px] rounded-xl border border-gray-200 bg-white p-4 text-base text-gray-900"
              style={{textAlignVertical: 'top', fontFamily: 'Nunito_400Regular'}}
            />
          )}
        />

        {/* Service Type */}
        <Body className="mb-1 text-sm font-medium text-gray-700">Type of Service/Event</Body>
        <View className="mb-4 flex-row gap-2">
          {SERVICE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setValue('service_type', type)}
              className={`flex-1 items-center justify-center rounded-xl border py-3 ${
                serviceType === type ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'
              }`}>
              <Body className={`font-nunito-bold text-sm ${serviceType === type ? 'text-primary' : 'text-gray-500'}`}>{type}</Body>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pricing */}
        <Body className="mb-1 text-sm font-medium text-gray-700">Pricing</Body>
        <Controller
          name="pricing"
          control={control}
          render={({field}) => (
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              placeholder="e.g. $50/hr, Varies"
              style={{fontFamily: 'Nunito_400Regular'}}
              className="mb-4 h-14 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900"
            />
          )}
        />

        {/* Session Duration */}
        <Body className="mb-1 text-sm font-medium text-gray-700">Session Duration</Body>
        <Controller
          name="session_duration"
          control={control}
          render={({field}) => (
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              placeholder="e.g. 60 minutes, 2 hours"
              style={{fontFamily: 'Nunito_400Regular'}}
              className="mb-4 h-14 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900"
            />
          )}
        />

        {/* Language */}
        <Body className="mb-1 text-sm font-medium text-gray-700">Language</Body>
        <Controller
          name="language"
          control={control}
          render={({field}) => (
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              placeholder="e.g. English, Spanish"
              style={{fontFamily: 'Nunito_400Regular'}}
              className="mb-4 h-14 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900"
            />
          )}
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

      {/* PROVIDER TERMS */}
      <View className="mb-8 mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-5">
        <H3 className="mb-4 text-lg font-bold text-[#1F1F1F]">Agree below Terms</H3>
        {PROVIDER_TERMS_AGREEMENTS.map((term) => (
          <View key={term.id} className="mb-4 flex-row items-center gap-3">
            <TouchableOpacity
              className={`h-6 w-6 items-center justify-center rounded border ${
                providerTermsAgreed[term.id] ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
              }`}
              onPress={() => setProviderTermsAgreed((prev) => ({...prev, [term.id]: !prev[term.id]}))}>
              {providerTermsAgreed[term.id] && <Ionicons name="checkmark" size={16} color="white" />}
            </TouchableOpacity>
            <Body className="flex-1 text-sm text-gray-700">
              {term.prefix}{' '}
              <Body onPress={() => handleOpenLegalModal(term.id, term.link)} className="font-nunito-bold text-secondary">
                {term.link}
              </Body>
            </Body>
          </View>
        ))}
      </View>

      {/* SUBMIT */}
      <Button onPress={handleSubmit(onSubmit)} loading={formState.isSubmitting} label={t('auth.register.signUpButton')} fullWidth className="mt-4" />

      {googleAuth !== 'true' && <GoogleSignInButton />}

      {/* LOGIN LINK */}
      {googleAuth !== 'true' && (
        <View className="my-5 flex-row items-center justify-center">
          <Body className="text-sm text-gray-600">{t('auth.register.alreadyMember')} </Body>
          <Link replace href="/auth">
            <Body className="font-nunito-bold text-sm font-semibold text-secondary">{t('auth.register.loginLink')}</Body>
          </Link>
        </View>
      )}

      <CountrySelect
        visible={showCountryPicker}
        onClose={() => setShowCountryPicker(false)}
        onSelect={(country) => {
          setProviderCountry(country);
          setValue('providerCountry', country.name.common);
          trigger('providerCountry');
          setShowCountryPicker(false);
        }}
        countryItemComponent={(item) => (
          <View className="flex-row items-center border-b border-gray-100 py-3">
            <Body className="mr-3 text-2xl">{item.flag}</Body>
            <Body className="text-base text-black">{item.name.common}</Body>
          </View>
        )}
      />

      {/* ID Type Selection Modal */}
      <Modal visible={showIdTypePicker} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-3xl bg-white p-6 pb-10">
            <View className="mb-4 flex-row items-center justify-between">
              <Display className="text-xl">Select ID Type</Display>
              <TouchableOpacity onPress={() => setShowIdTypePicker(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>
            {ID_TYPES.map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  setValue('idType', item.value);
                  trigger('idType');
                  setShowIdTypePicker(false);
                }}
                className="border-b border-gray-100 py-4">
                <Body className="text-base text-black">{item.label}</Body>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <LegalModal visible={showLegalModal} content={legalModalContent} onClose={() => setShowLegalModal(false)} title={legalModalTitle} />
      <LocationPickerModal
        visible={isLocationPickerVisible}
        onClose={() => setLocationPickerVisible(false)}
        onConfirm={(location) => {
          setLat(location.lat);
          setLng(location.lng);
          setLocationPickerVisible(false);
        }}
        initialLocation={lat && lng ? {lat, lng} : undefined}
      />
    </Animated.View>
  );
};
