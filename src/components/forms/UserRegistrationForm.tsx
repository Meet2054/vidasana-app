import React, {useState} from 'react';
import {View, TextInput, TouchableOpacity, Alert} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useForm, Controller} from 'react-hook-form';
import Toast from 'react-native-toast-message';
import {Link, useRouter} from 'expo-router';
import Animated, {FadeInUp} from 'react-native-reanimated';
import {supabase} from '@/utils';
import {useAppStore} from '@/store';
import {TERMS_AND_CONDITIONS} from '@/constants';
import {Button, PasswordStrengthBar, PhoneInputField, Body, Caption, GoogleSignInButton, LegalModal} from '@/components';

type FormData = {email: string; phone: string; fullName: string; password: string};

type Props = {
  googleAuth: string;
  googleEmail?: string;
  googleName?: string;
};

export const UserRegistrationForm: React.FC<Props> = ({googleAuth, googleEmail, googleName}) => {
  const {t} = useTranslation();
  const router = useRouter();
  const setSession = useAppStore((s) => s.setSession);

  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const {control, formState, handleSubmit, setValue} = useForm<FormData>({
    defaultValues: {fullName: '', email: '', phone: '', password: ''},
  });

  React.useEffect(() => {
    if (googleAuth === 'true') {
      if (googleEmail) setValue('email', googleEmail);
      if (googleName) setValue('fullName', googleName);
    }
  }, [googleAuth, googleEmail, googleName, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      if (!agreeToTerms) {
        return Toast.show({type: 'error', text1: t('auth.register.termsRequiredTitle'), text2: t('auth.register.termsRequiredMessage')});
      }

      const {email, phone, password, fullName} = data;
      let userId = '';

      if (googleAuth === 'true') {
        const {data: userData, error: userError} = await supabase.auth.updateUser({data: {role: 'user', full_name: fullName}});
        if (userError) throw userError;
        if (!userData.user) throw new Error('User data missing');
        userId = userData.user.id;
      } else {
        const {data: authData, error: signUpError} = await supabase.auth.signUp({
          email,
          password,
          options: {data: {role: 'user', full_name: fullName}},
        });
        if (signUpError) throw signUpError;
        if (!authData.user?.id) throw new Error('User ID missing after signup');
        userId = authData.user.id;
      }

      const callingCode = selectedCountry?.callingCode || '';
      const fullPhoneNumber = callingCode ? `${callingCode} ${phone}` : phone;
      const countryCode = selectedCountry?.cca2 || '';

      const {error: profileError} = await supabase.from('profile').upsert({
        id: userId,
        role: 'user',
        name: fullName,
        phone: fullPhoneNumber,
        country_code: countryCode,
        status: 'active',
      });

      if (profileError) throw profileError;

      Toast.show({type: 'success', text2: t('auth.register.success')});

      if (googleAuth === 'true') {
        const session = await supabase.auth.getSession();
        if (session.data.session) {
          setSession(session.data.session);
          router.replace('/(user)/(tabs)/home');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || JSON.stringify(e));
      Toast.show({type: 'error', text1: e?.message});
    }
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

      {/* TERMS */}
      <View className="mb-5 ml-2 mt-2 flex-row items-center">
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

      <LegalModal
        visible={showTermsModal}
        content={TERMS_AND_CONDITIONS}
        onClose={() => setShowTermsModal(false)}
        title={t('auth.register.terms&conditions')}
      />
    </Animated.View>
  );
};
