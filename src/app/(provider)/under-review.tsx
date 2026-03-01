import {supabase} from '@/utils';
import {useAppStore} from '@/store';
import {useRouter} from 'expo-router';
import React, {useEffect} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {View, BackHandler} from 'react-native';
import {Display, Subtitle, Button} from '@/components';
import {SafeAreaView} from 'react-native-safe-area-context';

export default function UnderReviewScreen() {
  const router = useRouter();
  const {user} = useAppStore((s) => s.session!);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const handleRefresh = async () => {
    // Check if status changed
    const {data} = await supabase.from('profile').select('status').eq('id', user?.id).single();
    if (data?.status === 'active') {
      router.replace('/(provider)/(tabs)/booking');
    } else {
      alert('Still under review. Please check back later.');
    }
  };

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white p-6">
      <View className="mb-8 items-center">
        <View className="mb-6 h-24 w-24 items-center justify-center rounded-full bg-yellow-50">
          <Ionicons name="hourglass-outline" size={48} color="#CA8A04" />
        </View>
        <Display align="center" className="mb-2">
          Under Review
        </Display>
        <Subtitle align="center">Your provider profile is currently being reviewed by our team. This usually takes 24-48 hours.</Subtitle>
      </View>

      <View className="w-full">
        <Button label="Refresh Status" onPress={handleRefresh} fullWidth className="mb-4" />
        <Button label="Log Out" variant="outline" fullWidth onPress={() => supabase.auth.signOut().finally(() => router.replace('/auth'))} />
      </View>
    </SafeAreaView>
  );
}
