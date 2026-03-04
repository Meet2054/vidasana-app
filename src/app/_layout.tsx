import '@/i18n';
import '../../global.css';
import '../../nativewind-interop';
import {useEffect} from 'react';
import {Stack} from 'expo-router';
import {useAppStore} from '@/store';
import AppProvider from '@/provider';
import * as SplashScreen from 'expo-splash-screen';
import {StripeProvider} from '@stripe/stripe-react-native';
import {
  useFonts,
  Nunito_700Bold,
  Nunito_300Light,
  Nunito_900Black,
  Nunito_500Medium,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_800ExtraBold,
  Nunito_200ExtraLight,
} from '@expo-google-fonts/nunito';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {initialRouteName: 'index'};

export default function RootLayout() {
  const session = useAppStore((e) => e.session!);
  const user = session?.user;

  const [fontsLoaded] = useFonts({
    Nunito_700Bold,
    Nunito_300Light,
    Nunito_900Black,
    Nunito_500Medium,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_800ExtraBold,
    Nunito_200ExtraLight,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
      <AppProvider>
        <Stack screenOptions={{headerShown: false}}>
          <Stack.Protected guard={!user?.user_metadata?.role}>
            <Stack.Screen name="auth" />
          </Stack.Protected>
          <Stack.Protected guard={user?.user_metadata?.role === 'user'}>
            <Stack.Screen name="(user)" />
          </Stack.Protected>
          <Stack.Protected guard={user?.user_metadata?.role === 'provider'}>
            <Stack.Screen name="(provider)" />
          </Stack.Protected>
          <Stack.Protected guard={!!user && !!user.user_metadata?.role}>
            <Stack.Screen name="edit-profile" />
          </Stack.Protected>
        </Stack>
      </AppProvider>
    </StripeProvider>
  );
}
