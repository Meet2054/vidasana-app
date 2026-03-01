import {Stack, useRouter, useSegments} from 'expo-router';
import {useEffect, useState} from 'react';
import {supabase} from '@/utils/supabase';
import {useAppStore} from '@/store';
import {View, ActivityIndicator} from 'react-native';

export default function ProviderLayout() {
  const [loading, setLoading] = useState(true);
  const {user} = useAppStore((s) => s.session!);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkStatus();
  }, [segments]);

  const checkStatus = async () => {
    if (!user) return;

    const routeName = segments[1];

    const {data: profileData} = await supabase.from('profile').select('status').eq('id', user.id).single();
    const adminStatus = profileData?.status;

    if (adminStatus === 'pending' && routeName !== 'under-review') router.replace('/(provider)/under-review');

    setLoading(false);
  };

  if (loading) {
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
      <Stack.Screen name="under-review" />
      <Stack.Screen name="events/create" />
      <Stack.Screen name="events/[id]" />
      <Stack.Screen name="events/edit/[id]" />
      <Stack.Screen name="services/create" />
      <Stack.Screen name="services/[id]" />
      <Stack.Screen name="services/edit/[id]" />
    </Stack>
  );
}
