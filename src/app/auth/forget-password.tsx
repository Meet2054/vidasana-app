import React from 'react';
import {IMAGES} from '@/assets';
import {supabase} from '@/utils';
import {expo} from '@/../app.json';
import {useRouter} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import Toast from 'react-native-toast-message';
import {useForm, Controller} from 'react-hook-form';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button, Display, Body, Caption} from '@/components';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image} from 'react-native';

const Page = () => {
  const {t} = useTranslation();
  const {back} = useRouter();
  const {control, handleSubmit, formState} = useForm({defaultValues: {email: ''}});

  const onSubmit = async (data: {email: string}) => {
    try {
      const {error} = await supabase.auth.resetPasswordForEmail(data.email, {redirectTo: `${expo.scheme}://auth/reset-password`});

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: t('auth.forgotPassword.successTitle', 'Check your email'),
        text2: t('auth.forgotPassword.successMessage', 'We have sent a password reset link to your email.'),
      });

      // Optional: Navigate back or to a specific confirmation screen
      // back();
    } catch (e: any) {
      console.log('🚀 ~ onSubmit ~ error:', e?.response?.data || e?.message || e);
      Toast.show({
        type: 'error',
        text1: t('common.error', 'Error'),
        text2: e.message || t('auth.forgotPassword.errorGeneric', 'Failed to send reset email'),
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{flexGrow: 1}}>
          {/* Header */}
          <View className="px-4 pt-2">
            <TouchableOpacity onPress={() => back()} className="h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <Animated.View entering={FadeInDown.delay(100)} className="items-center pt-6">
            <Image source={IMAGES.logo} resizeMode="contain" className="h-24 w-40" />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} className="mb-8 mt-9 items-center">
            <Display align="center" className="mb-2 text-black">
              {t('auth.forgotPassword.title')}
            </Display>
            <Body align="center" color="gray" className="px-10">
              {t('auth.forgotPassword.subtitle')}
            </Body>
          </Animated.View>

          {/* Form Section */}
          <Animated.View entering={FadeInUp.delay(400)} className="px-6">
            <Controller
              name="email"
              control={control}
              rules={{required: t('validation.emailRequired'), pattern: {value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('validation.emailInvalid')}}}
              render={({field, fieldState}) => (
                <>
                  <View
                    className={`mb-4 rounded-lg border bg-gray-50 ${fieldState.error ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-primary'}`}>
                    <TextInput
                      {...field}
                      autoCapitalize="none"
                      placeholderTextColor="#999"
                      keyboardType="email-address"
                      onChangeText={field.onChange}
                      placeholder={t('auth.forgotPassword.emailPlaceholder', 'Enter your email')}
                      style={{fontFamily: 'Nunito_400Regular'}}
                      className="m-0 h-14 px-4 text-base leading-5 text-black"
                    />
                  </View>
                  {fieldState.error && <Caption className="mb-2 ml-2 text-red-500">{fieldState.error.message}</Caption>}
                </>
              )}
            />

            {/* Reset Button */}
            <Button
              onPress={handleSubmit(onSubmit)}
              loading={formState.isSubmitting}
              label={t('auth.forgotPassword.sendLink')}
              className="mt-4"
              fullWidth
            />

            {/* Back to Login Link */}
            <View className="mt-5 flex-row items-center justify-center">
              <Body className="text-sm text-gray-600">{t('auth.forgotPassword.rememberPassword')} </Body>
              <TouchableOpacity onPress={() => back()}>
                <Body className="font-nunito-bold text-sm text-secondary">{t('auth.forgotPassword.loginLink')}</Body>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Page;
