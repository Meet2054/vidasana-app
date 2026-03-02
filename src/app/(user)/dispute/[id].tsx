import React, {useEffect, useState} from 'react';
import {View, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons, Feather} from '@expo/vector-icons';
import {supabase} from '@/utils/supabase';
import {H3, Body, Caption} from '@/components';
import dayjs from 'dayjs';
import {useTranslation} from 'react-i18next';

export default function DisputeStatusScreen() {
  const {id} = useLocalSearchParams<{id: string}>(); // This is the BOOKING ID
  const router = useRouter();

  const [dispute, setDispute] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const {t} = useTranslation();

  useEffect(() => {
    fetchDispute();
  }, [id]);

  const fetchDispute = async () => {
    try {
      const {data, error} = await supabase
        .from('disputes')
        .select(`*, provider:profile!disputes_provider_id_fkey(name, phone)`)
        .or(`service_booking_id.eq.${id},event_booking_id.eq.${id}`)
        .single();

      if (error) throw error;
      setDispute(data);
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'PGRST116') {
        // Not found error code might vary
        Alert.alert(t('dispute.error'), t('dispute.notFound'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#00594f" />
      </View>
    );
  }

  if (!dispute) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Feather name="alert-circle" size={48} color="#9CA3AF" />
        <H3 className="mt-4 text-gray-900">{t('dispute.notFound')}</H3>
        <Body className="mt-2 text-center text-gray-500">{t('dispute.notFoundMessage')}</Body>
        <TouchableOpacity onPress={() => router.back()} className="mt-6 rounded-full bg-primary px-6 py-3">
          <Body className="font-nunito-bold text-white">{t('dispute.goBack')}</Body>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-blue-600 bg-blue-100';
      case 'provider_replied':
        return 'text-purple-600 bg-purple-100';
      case 'resolved_refund':
        return 'text-green-600 bg-green-100';
      case 'resolved_payout':
        return 'text-gray-600 bg-gray-200';
      case 'closed':
        return 'text-gray-600 bg-gray-200';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusLabel = (status: string) => {
    return t(`dispute.statusLabels.${status}`, {defaultValue: status});
  };

  const getResolutionLabel = (resolution: string) => {
    return t(`dispute.resolutionLabels.${resolution}`, {defaultValue: resolution});
  };

  // Helper to ensure reasons are translated if they are keys
  const getReasonDisplay = (reasonText: string) => {
    // Check if it's a known key
    if (['notAsDescribed', 'noShow', 'quality', 'safety', 'other'].includes(reasonText.split('\n')[0])) {
      const parts = reasonText.split('\n');
      const key = parts[0];
      const rest = parts.slice(1).join('\n'); // Keep Description part
      return `${t(`dispute.reasons.${key}`)}${rest ? '\n' + rest : ''}`;
    }
    return reasonText;
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-100 px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <H3 className="font-nunito-bold text-lg">{t('dispute.title')}</H3>
      </View>

      <ScrollView className="flex-1 px-5 py-6">
        {/* Status Chip */}
        <View className="mb-6 flex-row justify-center">
          <View className={`rounded-full px-4 py-1.5 ${getStatusColor(dispute.status).split(' ')[1]}`}>
            <Body className={`font-nunito-bold capitalize ${getStatusColor(dispute.status).split(' ')[0]}`}>
              {t('dispute.status')}: {getStatusLabel(dispute.status)}
            </Body>
          </View>
        </View>

        {/* Timeline Info */}
        <View className="mb-6 rounded-xl bg-gray-50 p-4">
          <View className="mb-2 flex-row justify-between">
            <Caption className="text-gray-500">{t('dispute.submittedOn')}</Caption>
            <Caption className="font-nunito-bold text-gray-900">{dayjs(dispute.created_at).format('MMM D, YYYY h:mm A')}</Caption>
          </View>
          <View className="flex-row justify-between">
            <Caption className="text-gray-500">{t('dispute.bookingId')}</Caption>
            <Caption className="font-nunito-bold text-gray-900">#{id?.substring(0, 8)}</Caption>
          </View>
        </View>

        {/* Client Reason */}
        <View className="mb-6">
          <H3 className="mb-2 text-gray-900">{t('dispute.yourReport')}</H3>
          <View className="rounded-xl border border-gray-100 p-4">
            <Body className="leading-5 text-gray-800">{getReasonDisplay(dispute.reason)}</Body>
          </View>
        </View>

        {/* Client Evidence */}
        {dispute.evidence_client && dispute.evidence_client.length > 0 && (
          <View className="mb-6">
            <H3 className="mb-2 text-gray-900">{t('dispute.evidence')}</H3>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {dispute.evidence_client.map((path: string, index: number) => {
                // Assume path is storage path, get signed url
                // Actually in create.tsx we stored 'path'.
                const {data} = supabase.storage.from('dispute').getPublicUrl(path);
                // If using 'images' bucket:
                // const {data} = supabase.storage.from('images').getPublicUrl(path);
                // We need to be consistent with upload.
                return (
                  <View key={index} className="mr-3">
                    <Image source={{uri: data.publicUrl}} className="h-24 w-24 rounded-lg bg-gray-200" />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Provider Response */}
        {dispute.response_provider && (
          <View className="mb-6">
            <H3 className="mb-2 text-gray-900">{t('dispute.providerResponse')}</H3>
            <View className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <View className="mb-2 flex-row items-center">
                <Ionicons name="storefront-outline" size={16} color="#4B5563" />
                <Caption className="ml-2 font-nunito-bold text-gray-600">
                  {t('dispute.responseFrom')} {dispute.provider?.name || t('dispute.provider')}
                </Caption>
              </View>
              <Body className="leading-5 text-gray-800">{dispute.response_provider}</Body>
            </View>
          </View>
        )}

        {/* Resolution */}
        {dispute.resolution && (
          <View className="mb-6">
            <H3 className="mb-2 text-gray-900">{t('dispute.resolution')}</H3>
            <View
              className={`rounded-xl border p-4 ${dispute.resolution === 'client_win' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <Body className="mb-1 font-nunito-bold text-gray-900">{getResolutionLabel(dispute.resolution)}</Body>
              {dispute.admin_notes && <Body className="mt-1 text-sm text-gray-600">{dispute.admin_notes}</Body>}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Footer (if needed) */}
      <View className="border-t border-gray-100 bg-gray-50 p-5">
        <Body className="text-center text-xs text-gray-400">Dispute Reference: {dispute.id}</Body>
      </View>
    </SafeAreaView>
  );
}
