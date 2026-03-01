import {withLayoutContext, useRouter, usePathname} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import {Alert, Pressable, View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useStripeStatus} from '@/hooks';

const {Navigator} = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext(Navigator);

export default function TopTabsLayout() {
  const router = useRouter();
  const {t} = useTranslation();
  const {data: stripeStatus, isLoading: isCheckingStripe} = useStripeStatus();

  const pathname = usePathname();
  const isEventsTab = pathname.includes('/events');

  const handleCreate = () => {
    if (!isCheckingStripe && !stripeStatus?.isConnected) {
      Alert.alert(
        t('stripe.notConnectedTitle', 'Stripe Not Connected'),
        t('stripe.notConnectedMessage', 'You must connect your bank account via Stripe before creating listings so you can receive payouts.'),
        [
          {text: t('common.cancel', 'Cancel'), style: 'cancel'},
          {text: t('stripe.connectNow', 'Connect Stripe'), onPress: () => router.push('/(provider)/payment-setup')},
        ]
      );
    } else {
      router.push(isEventsTab ? '/(provider)/events/create' : '/(provider)/services/create');
    }
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
