import {useAppStore} from '@/store';
import {useRouter} from 'expo-router';
import React, {useState} from 'react';
import Constants from 'expo-constants';
import {Ionicons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import Toast from 'react-native-toast-message';
import * as WebBrowser from 'expo-web-browser';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import {View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking} from 'react-native';
import {H2, H3, Body, Caption, LanguagePicker, ProviderEditProfileModal, Avatar} from '@/components';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function ProviderSettingsScreen() {
  const router = useRouter();
  const {t, i18n} = useTranslation();
  const insets = useSafeAreaInsets();
  const signOut = useAppStore((state) => state.signOut);
  const profileStatus = useAppStore((state) => state.profileStatus);
  const {user: currentUser} = useAppStore((state) => state.session! || {});
  const checkProfileStatus = useAppStore((state) => state.checkProfileStatus);

  const [isEditing, setIsEditing] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isLanguagePickerVisible, setIsLanguagePickerVisible] = useState(false);

  const handleRefreshStatus = async () => {
    try {
      setIsRefreshingStatus(true);
      await checkProfileStatus();
      Toast.show({type: 'success', text1: 'Status refreshed successfully'});
    } catch (error) {
      console.error('Error refreshing status:', error);
      Toast.show({type: 'error', text1: 'Failed to refresh status'});
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const handlePasswordChange = () => router.push('/(settings)/change-password');

  const handleEditPress = () => setIsEditing(true);

  const handleUpdateSuccess = () => {
    Toast.show({type: 'success', text1: 'Profile updated successfully'});
    checkProfileStatus();
  };

  const handleOpenLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      Alert.alert('Error', 'Failed to open link.');
    }
  };

  if (!currentUser)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#00594f" />
      </View>
    );

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} className="flex-1 bg-white">
      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="never" contentContainerStyle={{paddingBottom: 14}}>
        <View className="items-center rounded-b-3xl bg-gray-50 pb-8" style={{paddingTop: insets.top + 30}}>
          <TouchableOpacity onPress={handleEditPress}>
            <View className="relative mb-4">
              <Avatar size={128} uri={currentUser?.user_metadata?.image} name={currentUser?.user_metadata?.full_name || 'User'} />
              <View className="absolute bottom-0 right-0 h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-primary">
                <Ionicons name="camera" size={14} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>

          <View
            className={`rounded-full px-3 py-1 ${
              profileStatus === 'active'
                ? 'bg-green-500'
                : profileStatus === 'onboarding'
                  ? 'bg-orange-400'
                  : profileStatus === 'pending'
                    ? 'bg-blue-500'
                    : profileStatus === 'reject'
                      ? 'bg-red-500'
                      : 'bg-primary'
            }`}>
            <Caption className="text-xs font-bold uppercase text-white">
              {currentUser?.user_metadata?.role || 'Member'} • {profileStatus || 'Unknown'}
            </Caption>
          </View>

          <H2 className="mt-2 text-center font-nunito-bold text-2xl text-black">{currentUser?.user_metadata?.full_name || 'User'}</H2>

          <Body className="mt-1 font-nunito text-base text-gray-500">{currentUser?.email}</Body>

          <TouchableOpacity
            onPress={handleRefreshStatus}
            disabled={isRefreshingStatus}
            className="mt-3 flex-row items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 shadow-sm">
            <Ionicons name="refresh" size={16} color={isRefreshingStatus ? '#9ca3af' : '#4b5563'} />
            <Body className={`ml-2 text-sm font-semibold ${isRefreshingStatus ? 'text-gray-400' : 'text-gray-600'}`}>
              {isRefreshingStatus ? 'Refreshing...' : 'Refresh Status'}
            </Body>
          </TouchableOpacity>
        </View>

        <View className="mt-6 px-5">
          <H3 className="mb-4 font-nunito-bold text-lg text-black">{t('settings.accountSettings')}</H3>

          <TouchableOpacity className="mb-2 flex-row items-center rounded-xl bg-gray-50 px-4 py-3" onPress={handleEditPress}>
            <Ionicons name="person-outline" size={24} color="#00594f" />
            <Body className="ml-3 flex-1 font-nunito-bold text-base text-primary">{t('profile.editTitle')}</Body>
            <Ionicons name="chevron-forward" size={24} color="#00594f" />
          </TouchableOpacity>

          <TouchableOpacity className="mb-2 flex-row items-center rounded-xl bg-gray-50 px-4 py-3" onPress={handlePasswordChange}>
            <Ionicons name="key-outline" size={24} color="#00594f" />
            <Body className="ml-3 flex-1 font-nunito-bold text-base text-primary">{t('settings.changePassword')}</Body>
            <Ionicons name="chevron-forward" size={24} color="#00594f" />
          </TouchableOpacity>

          <TouchableOpacity
            className="mb-2 flex-row items-center rounded-xl bg-gray-50 px-4 py-3"
            onPress={() => router.push('/(provider)/payment-setup')}>
            <Ionicons name="card-outline" size={24} color="#00594f" />
            <Body className="ml-3 flex-1 font-nunito-bold text-base text-primary">Payouts & Stripe</Body>
            <Ionicons name="chevron-forward" size={24} color="#00594f" />
          </TouchableOpacity>
        </View>

        <View className="mt-6 px-5">
          <H3 className="mb-4 font-nunito-bold text-lg text-black">{t('settings.preferences')}</H3>

          <TouchableOpacity className="mb-2 flex-row items-center rounded-xl bg-gray-50 px-4 py-3" onPress={() => setIsLanguagePickerVisible(true)}>
            <Ionicons name="globe-outline" size={24} color="#00594f" />
            <Body className="ml-3 flex-1 font-nunito-bold text-base text-primary">
              {t('settings.language')} ({t(`languages.${i18n.language}`)})
            </Body>
            <Ionicons name="chevron-forward" size={24} color="#00594f" />
          </TouchableOpacity>
        </View>

        <LanguagePicker visible={isLanguagePickerVisible} onClose={() => setIsLanguagePickerVisible(false)} />

        <View className="mt-6 px-5">
          <H3 className="mb-4 font-nunito-bold text-lg text-black">{t('settings.support')}</H3>

          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:mary@vidasanawellness.com')}
            className="mb-2 flex-row items-center rounded-xl bg-gray-50 px-4 py-3">
            <Ionicons name="help-circle-outline" size={24} color="#00594f" />
            <Body className="ml-3 flex-1 font-nunito-bold text-base text-primary">{t('settings.helpCenter')}</Body>
            <Ionicons name="chevron-forward" size={24} color="#00594f" />
          </TouchableOpacity>

          <TouchableOpacity
            className="mb-2 flex-row items-center rounded-xl bg-gray-50 px-4 py-3"
            onPress={() => handleOpenLink('https://vidasanawellness.com/terms')}>
            <Ionicons name="document-text-outline" size={24} color="#00594f" />
            <Body className="ml-3 flex-1 font-nunito-bold text-base text-primary">{t('settings.termsAndConditions')}</Body>
            <Ionicons name="chevron-forward" size={24} color="#00594f" />
          </TouchableOpacity>

          <TouchableOpacity
            className="mb-2 flex-row items-center rounded-xl bg-gray-50 px-4 py-3"
            onPress={() => handleOpenLink('https://vidasanawellness.com/privacy')}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#00594f" />
            <Body className="ml-3 flex-1 font-nunito-bold text-base text-primary">{t('settings.privacyPolicy')}</Body>
            <Ionicons name="chevron-forward" size={24} color="#00594f" />
          </TouchableOpacity>
        </View>

        <AnimatedTouchableOpacity
          entering={FadeIn}
          exiting={FadeOut}
          onPress={signOut}
          className="mx-5 mb-8 mt-10 flex-row items-center justify-center rounded-xl bg-red-50 py-4">
          <Ionicons name="log-out-outline" size={24} color="#E03C31" />
          <Body className="ml-2 font-nunito-bold text-base text-[#E03C31]">{t('settings.logOut')}</Body>
        </AnimatedTouchableOpacity>

        <View className="mb-4 items-center">
          <Caption className="text-gray-400">Version {Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version}</Caption>
        </View>
      </ScrollView>

      <ProviderEditProfileModal visible={isEditing} onClose={() => setIsEditing(false)} onSuccess={handleUpdateSuccess} />
    </Animated.View>
  );
}
