import React, {useState, useEffect} from 'react';
import {View, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Linking} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {useTranslation} from 'react-i18next';
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import {supabase} from '@/utils';
import {useAppStore} from '@/store';
import Constants from 'expo-constants';
import {H2, H3, Body, Caption, LanguagePicker, ProviderEditProfileModal} from '@/components';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function ProviderSettingsScreen() {
  const router = useRouter();
  const {t, i18n} = useTranslation();
  const insets = useSafeAreaInsets();

  const session = useAppStore((state) => state.session);
  const currentUser = session?.user;

  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState({
    id: '',
    fullName: '',
    email: '',
    phone: '',
    role: '',
    country: '',
    providerType: '',
    description: '',
    service_type: '',
    pricing: '',
    session_duration: '',
    language: '',
    location: '',
    terms_agreed: false,
    countryCode: '',
  });
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [isLanguagePickerVisible, setIsLanguagePickerVisible] = useState(false);

  const isBusy = isFetchingProfile;

  useEffect(() => {
    if (!currentUser) {
      setUserInfo({
        id: '',
        fullName: '',
        email: '',
        phone: '',
        role: '',
        country: '',
        providerType: '',
        description: '',
        service_type: '',
        pricing: '',
        session_duration: '',
        language: '',
        location: '',
        terms_agreed: false,
        countryCode: '',
      });
      setProfileImage(null);
      setIsFetchingProfile(false);
      return;
    }

    setUserInfo((prev) => ({
      ...prev,
      id: currentUser.id,
      fullName: currentUser.user_metadata?.full_name || prev.fullName,
      email: currentUser.email || prev.email,
      role: String(currentUser.user_metadata?.role || prev.role || ''),
    }));

    fetchProfile();
  }, [currentUser]);

  const fetchProfile = async () => {
    if (!currentUser?.id) return;

    try {
      setIsFetchingProfile(true);
      const {data: profileData, error: profileError} = await supabase
        .from('profile')
        .select('name, phone, role, image, country_code')
        .eq('id', currentUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError.message);
        return;
      }

      if (profileData) {
        let providerData: any = null;
        const userRole = String(profileData.role ?? currentUser.user_metadata?.role ?? '');

        if (userRole === 'provider') {
          const {data: pData, error: pError} = await supabase
            .from('provider')
            .select('type, country, pricing, language, location, description, service_type, session_duration')
            .eq('id', currentUser.id)
            .single();

          if (!pError && pData) {
            providerData = pData;
          } else if (pError) {
            console.error('Error fetching provider profile:', pError.message);
          }
        }

        setUserInfo({
          id: currentUser.id,
          fullName: profileData.name ?? currentUser.user_metadata?.full_name ?? '',
          email: currentUser.email ?? '',
          phone: profileData.phone ?? '',
          role: userRole,
          country: providerData?.country ?? '',
          providerType: providerData?.type ?? '',
          description: providerData?.description ?? '',
          service_type: providerData?.service_type ?? '',
          pricing: providerData?.pricing ?? '',
          session_duration: providerData?.session_duration ?? '',
          language: providerData?.language ?? '',
          location: typeof providerData?.location === 'string' ? providerData.location : '',
          terms_agreed: providerData?.terms_agreed ?? false,
          countryCode: profileData.country_code ?? '',
        });

        if (profileData.image) {
          if (profileData.image.startsWith('http')) {
            setProfileImage(profileData.image);
          } else {
            const {data: imageData} = supabase.storage.from('profile').getPublicUrl(profileData.image);
            setProfileImage(imageData.publicUrl);
          }
        }
      }
    } catch (fetchError) {
      console.error('Error loading profile:', fetchError);
    } finally {
      setIsFetchingProfile(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const handlePasswordChange = () => {
    router.push('/(settings)/change-password');
  };

  const handleEditPress = () => {
    if (isBusy) return;
    setIsEditing(true);
  };

  const handleUpdateSuccess = () => {
    Toast.show({type: 'success', text1: 'Profile updated successfully'});
    fetchProfile();
  };

  const handleOpenLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      Alert.alert('Error', 'Failed to open link.');
    }
  };

  if (isFetchingProfile && !userInfo.fullName && !currentUser) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#00594f" />
        <Body className="mt-4 text-gray-500">Loading profile...</Body>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} className="flex-1 bg-white">
      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="never" contentContainerStyle={{paddingBottom: 14}}>
        <View className="items-center rounded-b-3xl bg-gray-50 pb-8" style={{paddingTop: insets.top + 30}}>
          <TouchableOpacity onPress={handleEditPress}>
            <View className="relative mb-4">
              {profileImage ? (
                <Image source={{uri: profileImage}} className="h-[120px] w-[120px] rounded-full" />
              ) : (
                <View className="h-[120px] w-[120px] items-center justify-center rounded-full bg-gray-200">
                  <Ionicons name="person" size={40} color="#666" />
                </View>
              )}
              <View className="absolute bottom-0 right-0 h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-white bg-primary">
                <Ionicons name="camera" size={14} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>

          <View className={`rounded-full bg-primary px-3 py-1`}>
            <Caption className="text-xs font-bold uppercase text-white">{userInfo.role || currentUser?.user_metadata?.role || 'Member'}</Caption>
          </View>

          <H2 className="mt-2 text-center font-nunito-bold text-2xl text-black">
            {userInfo.fullName || currentUser?.user_metadata?.full_name || 'User'}
          </H2>

          <Body className="mt-1 font-nunito text-base text-gray-500">{userInfo.email || currentUser?.email}</Body>
        </View>

        {isBusy && (
          <View className="flex-row items-center justify-center space-x-2 px-5 py-3">
            <ActivityIndicator size="small" color="#00594f" />
            <Body className="font-nunito text-sm text-gray-700">Refreshing profile...</Body>
          </View>
        )}

        <View className="mt-6 px-5">
          <H3 className="mb-4 font-nunito-bold text-lg text-black">{t('settings.accountSettings')}</H3>

          <TouchableOpacity
            className={`mb-2 flex-row items-center rounded-xl bg-gray-50 px-4 py-3 ${isBusy || isEditing ? 'opacity-60' : ''}`}
            disabled={isBusy || isEditing}
            onPress={handleEditPress}>
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
          onPress={handleLogout}
          className="mx-5 mb-8 mt-10 flex-row items-center justify-center rounded-xl bg-red-50 py-4">
          <Ionicons name="log-out-outline" size={24} color="#E03C31" />
          <Body className="ml-2 font-nunito-bold text-base text-[#E03C31]">{t('settings.logOut')}</Body>
        </AnimatedTouchableOpacity>

        <View className="mb-4 items-center">
          <Caption className="text-gray-400">Version {Constants.expoConfig?.version || Constants.manifest2?.extra?.expoClient?.version}</Caption>
        </View>
      </ScrollView>

      <ProviderEditProfileModal
        visible={isEditing}
        onClose={() => setIsEditing(false)}
        onSuccess={handleUpdateSuccess}
        initialData={{...userInfo, image: profileImage}}
      />
    </Animated.View>
  );
}
