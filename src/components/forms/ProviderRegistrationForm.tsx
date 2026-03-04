import {supabase} from '@/utils';
import {useAppStore} from '@/store';
import {Link, useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import Toast from 'react-native-toast-message';
import React, {useEffect, useState} from 'react';
import {useForm, Controller} from 'react-hook-form';
import {Feather, Ionicons} from '@expo/vector-icons';
import Animated, {FadeInUp} from 'react-native-reanimated';
import {View, TextInput, TouchableOpacity, Alert} from 'react-native';
import {PROVIDER_LEGAL_CONTENT, PROVIDER_TERMS_AGREEMENTS} from '@/constants';
import {H3, Button, PasswordStrengthBar, PhoneInputField, Body, Caption, GoogleSignInButton, LegalModal} from '@/components';

type FormData = {email: string; phone: string; fullName: string; password: string};

type Props = {googleAuth: string; googleEmail?: string; googleName?: string};

export const ProviderRegistrationForm: React.FC<Props> = ({googleAuth, googleEmail, googleName}) => {
  const router = useRouter();
  const {t} = useTranslation();
  const setSession = useAppStore((s) => s.setSession);

  const [providerTermsAgreed, setProviderTermsAgreed] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);

  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalModalTitle, setLegalModalTitle] = useState('');
  const [legalModalContent, setLegalModalContent] = useState('');

  const {control, formState, handleSubmit, setValue} = useForm<FormData>({
    defaultValues: {email: '', phone: '', password: '', fullName: ''},
  });

  useEffect(() => {
    if (googleAuth === 'true') {
      if (googleEmail) setValue('email', googleEmail);
      if (googleName) setValue('fullName', googleName);
    }
  }, [googleAuth, googleEmail, googleName, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      if (!selectedCountry) return Toast.show({type: 'error', text2: 'Please select a country code for your phone number'});

      const allTermsAgreed = PROVIDER_TERMS_AGREEMENTS.every((t) => providerTermsAgreed[t.id]);
      if (!allTermsAgreed) return Toast.show({type: 'error', text1: 'Terms Required', text2: 'Please agree to all provider terms and conditions.'});

      const {email, phone, password, fullName} = data;
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

      const {error: profileError} = await supabase
        .from('profile')
        .upsert({id: userId, name: fullName, role: 'provider', status: 'onboarding', phone: phone, country_code: selectedCountry?.cca2 || ''});

      if (profileError) throw profileError;

      Toast.show({type: 'success', text2: t('auth.register.success')});

      if (googleAuth === 'true') {
        const session = await supabase.auth.getSession();
        if (session.data.session) {
          setSession(session.data.session);
          router.replace('/(provider)/(tabs)/(topTab)');
        }
      } else {
        router.replace('/(provider)/(tabs)/(topTab)');
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

      {/* PASSWORD */}
      {googleAuth !== 'true' && (
        <Controller
          name="password"
          control={control}
          rules={{
            required: t('validation.passwordRequired'),
            minLength: {value: 8, message: t('validation.passwordMin')},
            validate: {
              hasUpper: (v) => /[A-Z]/.test(v) || t('validation.passwordUpper'),
              hasLower: (v) => /[a-z]/.test(v) || t('validation.passwordLower'),
              hasSpecial: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) || t('validation.passwordSpecial'),
            },
          }}
          render={({field, fieldState}) => (
            <View className="mb-2">
              <View
                className={`flex-row items-center justify-between rounded-xl border bg-gray-50 pr-4 ${
                  fieldState.error ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-primary'
                }`}>
                <TextInput
                  {...field}
                  placeholderTextColor="#999"
                  onChangeText={field.onChange}
                  secureTextEntry={!showPassword}
                  style={{fontFamily: 'Nunito_400Regular'}}
                  placeholder={t('auth.register.passwordPlaceholder')}
                  className="m-0 h-14 flex-1 px-4 text-base leading-5 text-black"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Feather name={showPassword ? 'eye' : 'eye-off'} size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <PasswordStrengthBar visible={!!field.value} password={field.value} />
              {fieldState.error && <Caption className="ml-2 mt-1 text-red-500">{fieldState.error.message}</Caption>}
            </View>
          )}
        />
      )}

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

      <LegalModal visible={showLegalModal} content={legalModalContent} onClose={() => setShowLegalModal(false)} title={legalModalTitle} />
    </Animated.View>
  );
};
