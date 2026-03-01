import {IMAGES} from '@/assets';
import React, {useState} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useLocalSearchParams} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {View, Image, Platform, ScrollView, TouchableOpacity, KeyboardAvoidingView} from 'react-native';
import {Display, Subtitle, Body, Caption, UserRegistrationForm, ProviderRegistrationForm} from '@/components';

type Role = 'user' | 'provider';

const Register = () => {
  const {t} = useTranslation();
  const {email: googleEmail, fullName: googleName, googleAuth} = useLocalSearchParams<{email: string; fullName: string; googleAuth: string}>();

  const [role, setRole] = useState<Role>('user');

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

          {role === 'user' ? (
            <UserRegistrationForm googleAuth={googleAuth || ''} googleEmail={googleEmail} googleName={googleName} />
          ) : (
            <ProviderRegistrationForm googleAuth={googleAuth || ''} googleEmail={googleEmail} googleName={googleName} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Register;
