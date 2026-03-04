import {supabase} from '@/utils';
import {useAppStore} from '@/store';
import {useStripeStatus} from '@/hooks';
import {useEffect} from 'react';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {Alert, Pressable, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {withLayoutContext, useRouter, usePathname} from 'expo-router';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';

const {Navigator} = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext(Navigator);

export default function TopTabsLayout() {
  const router = useRouter();
  const {t} = useTranslation();
  const pathname = usePathname();
  const {user} = useAppStore((s) => s.session!);
  const isEventsTab = pathname.includes('/events');
  const profileStatus = useAppStore((s) => s.profileStatus);
  const checkProfileStatus = useAppStore((s) => s.checkProfileStatus);
  const {data: stripeStatus, isLoading: isCheckingStripe} = useStripeStatus();

  useEffect(() => {
    if (!profileStatus) checkProfileStatus();
  }, [user?.id]);

  const handleCreate = () => {
    if (!profileStatus)
      return Alert.alert('Failed to load profile', 'Please try again later.', [{text: 'OK', style: 'default', onPress: () => checkProfileStatus()}]);

    if (profileStatus === 'onboarding')
      return Alert.alert('Profile Incomplete', 'Please complete your profile details in settings to start creating services or events.', [
        {text: 'OK', style: 'default', onPress: () => router.push('/(provider)/(tabs)/setting')},
      ]);

    if (profileStatus === 'pending')
      return Alert.alert(
        'Profile Under Review',
        'Your profile is currently under review. You will be able to create services and events once approved.',
        [{text: 'OK', style: 'default'}]
      );

    if (profileStatus === 'reject')
      return Alert.alert('Profile Rejected', 'Your profile was not approved. Please update your details in settings and resubmit.', [
        {text: 'OK', style: 'default', onPress: () => router.push('/(provider)/(tabs)/setting')},
      ]);

    if (!isCheckingStripe && !stripeStatus?.isConnected)
      return Alert.alert(
        t('stripe.notConnectedTitle', 'Stripe Not Connected'),
        t('stripe.notConnectedMessage', 'You must connect your bank account via Stripe before creating listings so you can receive payouts.'),
        [
          {text: t('common.cancel', 'Cancel'), style: 'cancel'},
          {text: t('stripe.connectNow', 'Connect Stripe'), onPress: () => router.push('/(provider)/payment-setup')},
        ]
      );

    router.push(isEventsTab ? '/(provider)/events/create' : '/(provider)/services/create');
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <MaterialTopTabs
        screenOptions={{
          tabBarActiveTintColor: '#2d5016',
          tabBarInactiveTintColor: '#6B7280',
          tabBarIndicatorStyle: {backgroundColor: '#2d5016', height: 3},
          tabBarLabelStyle: {fontWeight: 'bold', textTransform: 'capitalize'},
          tabBarStyle: {elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: '#f3f4f6'},
        }}>
        <MaterialTopTabs.Screen name="index" options={{title: 'Services'}} />
        <MaterialTopTabs.Screen name="events" options={{title: 'Events'}} />
      </MaterialTopTabs>

      {/* Shared FAB */}
      <View className="absolute bottom-6 w-full items-center" pointerEvents="box-none">
        <Pressable onPress={handleCreate} className="h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg">
          <Feather name="plus" size={30} color="white" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
