import {supabase} from '@/utils';
import {Ionicons} from '@expo/vector-icons';
import {Link, useRouter} from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, {useState} from 'react';
import {H2, Body, Caption, Loader} from '@/components';
import {View, TouchableOpacity, ScrollView, Alert, RefreshControl} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useStripeStatus} from '@/hooks';

export default function PaymentSetupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {data: status, isLoading: initialLoad, refetch: checkStatus, isRefetching} = useStripeStatus();

  const checkingStatus = initialLoad || isRefetching;

  const handleConnect = async () => {
    try {
      setLoading(true);
      const invokeFunction = (action: string) => supabase.functions.invoke('stripe-connect', {body: {action}});
      const {data, error} = await invokeFunction('create_account_link');

      if (error) throw error;
      if (!data?.url) throw new Error('No URL returned');

      // Open the onboarding flow
      const result = await WebBrowser.openAuthSessionAsync(data.url, 'vidasana://stripe-connect/return');

      // Refresh status when they come back
      if (result.type === 'success' || result.type === 'dismiss') {
        checkStatus();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginLink = async () => {
    try {
      setLoading(true);
      const {data, error} = await supabase.functions.invoke('stripe-connect', {body: {action: 'create_login_link'}});

      if (error) throw error;
      if (!data?.url) throw new Error('No URL returned');

      await WebBrowser.openBrowserAsync(data.url);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center border-b border-gray-100 px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <H2 className="text-gray-900">Payouts</H2>
      </View>
      <ScrollView
        className="p-6"
        contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}
        refreshControl={
          <RefreshControl
            tintColor="#00594f"
            titleColor="#00594f"
            colors={['#00594f']}
            onRefresh={checkStatus}
            refreshing={checkingStatus}
            progressBackgroundColor="#ffffff"
          />
        }>
        <View className="mb-8 items-center">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Ionicons name="card-outline" size={40} color="#00594f" />
          </View>
          <H2 className="text-gray-900">Get Paid with Stripe</H2>
          <Body className="mt-2 text-center text-gray-500">Connect your bank account to receive payouts from your bookings instantly.</Body>

          <TouchableOpacity
            disabled={checkingStatus}
            onPress={() => checkStatus()}
            className={`mt-6 flex-row items-center justify-center rounded-full px-5 py-2 ${checkingStatus ? 'bg-gray-100' : 'bg-primary/10'}`}>
            <Ionicons name="refresh" size={18} color={checkingStatus ? '#9ca3af' : '#00594f'} />
            <Body className={`ml-2 font-nunito-bold ${checkingStatus ? 'text-gray-400' : 'text-primary'}`}>
              {checkingStatus ? 'Refreshing...' : 'Refresh Status'}
            </Body>
          </TouchableOpacity>
        </View>

        <View>
          {/* 1. NOT CONNECTED -> Connect Button */}
          {!status?.isConnected && (
            <View>
              <TouchableOpacity onPress={handleConnect} className="flex-row items-center justify-center rounded-xl bg-primary py-4 shadow-sm">
                <Body className="mr-2 font-nunito-bold text-lg text-white">Connect Stripe</Body>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </TouchableOpacity>
              <Caption className="mt-4 text-center text-gray-400">You will be redirected to completely secure onboarding hosted by Stripe.</Caption>
            </View>
          )}

          {/* 2. CONNECTED BUT INCOMPLETE -> Continue Setup */}
          {status?.isConnected && !status?.details_submitted && (
            <View className="items-center">
              <View className="mb-4 flex-row items-center rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <Ionicons name="warning-outline" size={24} color="#ca8a04" />
                <View className="ml-3 flex-1">
                  <Body className="font-nunito-bold text-yellow-800">Setup Incomplete</Body>
                  <Caption className="text-yellow-700">You need to provide more information to start receiving payouts.</Caption>
                </View>
              </View>
              <TouchableOpacity onPress={handleConnect} className="w-full flex-row items-center justify-center rounded-xl bg-primary py-3 shadow-sm">
                <Body className="font-nunito-bold text-white">Complete Setup</Body>
              </TouchableOpacity>
            </View>
          )}

          {/* 3. FULLY ACTIVE -> Manage Dashboard */}
          {status?.isConnected && status?.details_submitted && (
            <View>
              <View className="mb-6 flex-row items-center rounded-xl border border-sage/30 bg-sage/20 p-4">
                <Ionicons name="checkmark-circle" size={24} color="#00594f" />
                <View className="ml-3">
                  <Body className="font-nunito-bold text-gray-800">Stripe Connected</Body>
                  <Caption className="text-gray-600">Your account is ready to receive payouts.</Caption>
                </View>
              </View>

              <TouchableOpacity onPress={handleLoginLink} className="mb-4 w-full flex-row items-center justify-center rounded-xl bg-gray-100 py-3">
                <Body className="mr-2 font-nunito-bold text-gray-800">Manage Payouts</Body>
                <Ionicons name="open-outline" size={18} color="black" />
              </TouchableOpacity>

              <Link href="/" replace asChild>
                <TouchableOpacity className="mb-4 w-full flex-row items-center justify-center rounded-xl bg-primary py-3 shadow-sm">
                  <Body className="mr-2 font-nunito-bold text-white">Go Home</Body>
                  <Ionicons name="home-outline" size={18} color="white" />
                </TouchableOpacity>
              </Link>
            </View>
          )}
        </View>
      </ScrollView>
      <Loader visible={loading} />
    </SafeAreaView>
  );
}
