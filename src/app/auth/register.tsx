import {IMAGES} from '@/assets';
import {useAppStore} from '@/store';
import React, {useState} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {supabase, uploadFile} from '@/utils';
import Toast from 'react-native-toast-message';
import {TERMS_AND_CONDITIONS} from '@/constants';
import {useForm, Controller} from 'react-hook-form';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Link, useRouter, useLocalSearchParams} from 'expo-router';
import CountrySelect, {ICountry} from 'react-native-country-select';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {getDocumentAsync, DocumentPickerAsset} from 'expo-document-picker';
import {View, Image, Platform, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Pressable, Linking, Alert} from 'react-native';
import {Display, Subtitle, Button, PasswordStrengthBar, PhoneInputField, Body, Caption, GoogleSignInButton, LegalModal} from '@/components';

type FormData = {email: string; phone: string; fullName: string; password: string};
type Role = 'user' | 'provider';

const Register = () => {
  const {t} = useTranslation();
  const router = useRouter();
  const {email: googleEmail, fullName: googleName, googleAuth} = useLocalSearchParams<{email: string; fullName: string; googleAuth: string}>();
  const setSession = useAppStore((s) => s.setSession);

  const [role, setRole] = useState<Role>('user');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const [document, setDocument] = useState<DocumentPickerAsset | null>(null);
  const [providerCountry, setProviderCountry] = useState<ICountry | null>(null);
  const [countryError, setCountryError] = useState<string>('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [docError, setDocError] = useState<string>('');

  const {control, formState, handleSubmit, setValue} = useForm<FormData>({
    defaultValues: {fullName: '', email: '', phone: '', password: ''},
  });

  React.useEffect(() => {
    if (googleAuth === 'true') {
      if (googleEmail) setValue('email', googleEmail);
      if (googleName) setValue('fullName', googleName);
    }
  }, [googleAuth, googleEmail, googleName, setValue]);

  const pickPdf = async () => {
    try {
      const result = await getDocumentAsync({copyToCacheDirectory: false, type: 'application/pdf', multiple: false});
      if (result.canceled) return;
      setDocument(result.assets[0]);
      setDocError('');
    } catch (error: any) {
      Toast.show({type: 'error', text2: error?.message || t('role.errorDoc')});
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (role === 'provider') {
        if (!document) return setDocError(t('validation.docRequired'));
        if (!providerCountry) return setCountryError('Please select a country');
      }
      if (!agreeToTerms)
        return Toast.show({type: 'error', text1: t('auth.register.termsRequiredTitle'), text2: t('auth.register.termsRequiredMessage')});

      const {email, phone, password, fullName} = data;
      let userId = '';

      if (googleAuth === 'true') {
        const {data: userData, error: userError} = await supabase.auth.updateUser({data: {role: role, full_name: fullName}});
        if (userError) throw userError;
        if (!userData.user) throw new Error('User data missing');
        userId = userData.user.id;
      } else {
        const {data: authData, error: signUpError} = await supabase.auth.signUp({
          email,
          password,
          options: {data: {role: role, full_name: fullName}},
        });
        if (signUpError) throw signUpError;
        if (!authData.user?.id) throw new Error('User ID missing after signup');
        userId = authData.user.id;
      }

      // 2. Provider Specifics
      if (role === 'provider') {
        const file = await uploadFile(document!, 'provider_docs', `${userId}/${document?.name}`);
        if (file.error) throw file.error;
        const {error: providerError} = await supabase
          .from('provider')
          .insert({id: userId, document: file.data?.path, country: providerCountry!.name.common});
        if (providerError) throw providerError;
      }

      // 3. Create Profile
      const callingCode = selectedCountry?.callingCode || '';
      const fullPhoneNumber = callingCode ? `${callingCode} ${phone}` : phone;
      const countryCode = selectedCountry?.cca2 || '';

      const {error: profileError} = await supabase.from('profile').upsert({
        id: userId,
        role: role,
        name: fullName,
        phone: fullPhoneNumber,
        country_code: countryCode,
        status: role === 'provider' ? 'onboarding' : 'active',
      });

      if (profileError) throw profileError;

      Toast.show({type: 'success', text2: t('auth.register.success')});

      if (googleAuth === 'true') {
        const session = await supabase.auth.getSession();
        if (session.data.session) {
          setSession(session.data.session);
          if (role === 'provider') {
            router.replace('/(provider)/(tabs)/(topTab)');
          } else {
            router.replace('/(user)/(tabs)/home');
          }
        }
      } else {
        if (role === 'provider') router.replace('/(provider)/payment-setup');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || JSON.stringify(e));
      Toast.show({type: 'error', text1: e?.message});
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 40}}>
          {/* HEADER */}
          <View className="m-5 items-center">
            <Image source={IMAGES.logo} className="mt-2 aspect-square h-28" resizeMode="contain" />
          </View>

          <Animated.View entering={FadeInDown.delay(200)} className="mb-4 items-center px-6">
            <Display align="center" className="mb-2 text-black">
              {t('auth.register.title')}
            </Display>
            <Subtitle align="center">{t('auth.register.subtitle')}</Subtitle>
          </Animated.View>

          {/* ROLE TABS */}
          <View className="mx-6 mb-6 flex-row rounded-xl bg-gray-100 p-1">
            <TouchableOpacity
              onPress={() => setRole('user')}
              className={`flex-1 items-center justify-center rounded-lg py-2 ${role === 'user' ? 'bg-white shadow-sm' : 'shadow-none'}`}>
              <View className="flex-row items-center">
                <Ionicons name="search-outline" size={16} color={role === 'user' ? '#00594f' : '#9CA3AF'} style={{marginRight: 6}} />
                <Body className={`font-nunito-bold text-sm ${role === 'user' ? 'text-primary' : 'text-gray-500'}`}>{t('role.joinEventsTitle')}</Body>
              </View>
              <Caption className={`text-[10px] ${role === 'user' ? 'text-primary' : 'text-gray-400'}`}>{t('role.eventsAndServices')}</Caption>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRole('provider')}
              className={`flex-1 items-center justify-center rounded-lg py-2 ${role === 'provider' ? 'bg-white shadow-sm' : 'shadow-none'}`}>
              <View className="flex-row items-center">
                <Ionicons name="briefcase-outline" size={16} color={role === 'provider' ? '#00594f' : '#9CA3AF'} style={{marginRight: 6}} />
                <Body className={`font-nunito-bold text-sm ${role === 'provider' ? 'text-primary' : 'text-gray-500'}`}>
                  {t('role.hostEventsTitle')}
                </Body>
              </View>
              <Caption className={`text-[10px] ${role === 'provider' ? 'text-primary' : 'text-gray-400'}`}>{t('role.eventsAndServices')}</Caption>
            </TouchableOpacity>
          </View>

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

            {/* PROVIDER FIELDS */}
            {role === 'provider' && (
              <Animated.View entering={FadeInDown.delay(100)} className="mb-4">
                {/* Country Selection */}
                <View className="mb-4">
                  <TouchableOpacity
                    onPress={() => setShowCountryPicker(true)}
                    className={`h-14 flex-row items-center justify-between rounded-xl border bg-gray-50 px-4 ${countryError ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <View className="flex-row items-center">
                      {providerCountry ? (
                        <>
                          <Body className="mr-2 text-xl">{providerCountry.flag}</Body>
                          <Body className="text-base text-black">{providerCountry.name.common}</Body>
                        </>
                      ) : (
                        <Body className="text-base text-[#999]">Select Country</Body>
                      )}
                    </View>
                    <Ionicons name="chevron-down" size={20} color="#999" />
                  </TouchableOpacity>
                  {countryError ? <Caption className="ml-2 mt-1 text-red-500">{countryError}</Caption> : null}
                </View>

                {/* Document Upload */}
                <Pressable
                  onPress={pickPdf}
                  className={`h-32 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed bg-gray-50 ${docError ? 'border-red-300 bg-red-50' : !document ? 'border-gray-300' : 'border-primary bg-primary/5'}`}>
                  <Ionicons size={32} color={document ? '#00594f' : '#9CA3AF'} name={document ? 'document-text-outline' : 'cloud-upload-outline'} />
                  <Body className={`mt-2 px-4 text-center text-sm ${document ? 'font-bold text-primary' : 'text-gray-500'}`}>
                    {document
                      ? document.name
                      : providerCountry?.name?.common === 'United States'
                        ? t('role.uploadW9')
                        : providerCountry
                          ? t('role.uploadW8')
                          : t('role.uploadFileNote')}
                  </Body>
                </Pressable>
                {docError ? <Caption className="ml-2 mt-1 text-red-500">{docError}</Caption> : null}

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
            )}

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
                      <PasswordStrengthBar password={field?.value} visible={!fieldState.error?.message} />
                    </View>
                    {fieldState.error && <Caption className="ml-2 mt-1 text-red-500">{fieldState.error.message}</Caption>}
                  </View>
                )}
              />
            )}

            {/* TERMS */}
            <View className="mb-5 ml-2 flex-row items-center">
              <TouchableOpacity
                className="mr-2 h-5 w-5 items-center justify-center rounded border-2 border-black"
                onPress={() => setAgreeToTerms(!agreeToTerms)}>
                <View className={`h-2.5 w-2.5 rounded-sm ${agreeToTerms ? 'bg-secondary' : ''}`} />
              </TouchableOpacity>

              <Body className="flex-1 text-sm text-gray-600">
                {t('auth.register.agreeTo')}{' '}
                <Body onPress={() => setShowTermsModal(true)} className="font-nunito-bold text-secondary">
                  {t('auth.register.terms&conditions')}
                </Body>
              </Body>
            </View>

            {/* SUBMIT */}
            <Button
              onPress={handleSubmit(onSubmit)}
              loading={formState.isSubmitting}
              label={t('auth.register.signUpButton')}
              fullWidth
              className="mt-4"
            />

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
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LegalModal
        visible={showTermsModal}
        content={TERMS_AND_CONDITIONS}
        onClose={() => setShowTermsModal(false)}
        title={t('auth.register.terms&conditions')}
      />

      <CountrySelect
        visible={showCountryPicker}
        onClose={() => setShowCountryPicker(false)}
        onSelect={(country) => {
          setCountryError('');
          setProviderCountry(country);
          setShowCountryPicker(false);
        }}
        countryItemComponent={(item) => (
          <View className="flex-row items-center border-b border-gray-100 py-3">
            <Body className="mr-3 text-2xl">{item.flag}</Body>
            <Body className="text-base text-black">{item.name.common}</Body>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default Register;
