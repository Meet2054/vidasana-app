import {Stack} from 'expo-router';
import {useAppStore} from '@/store';
import {View, ActivityIndicator} from 'react-native';

export default function ProviderLayout() {
  const {user} = useAppStore((s) => s.session!);

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#00594f" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{headerShown: false}}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="payment-setup" />
      <Stack.Screen name="events/create" />
      <Stack.Screen name="events/[id]" />
      <Stack.Screen name="events/edit/[id]" />
      <Stack.Screen name="services/create" />
      <Stack.Screen name="services/[id]" />
      <Stack.Screen name="services/edit/[id]" />
    </Stack>
  );
}
