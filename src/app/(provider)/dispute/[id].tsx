import React, {useEffect, useState} from 'react';
import {View, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons, Feather} from '@expo/vector-icons';
import {supabase} from '@/utils/supabase';
import {H3, Body, Caption} from '@/components';
import dayjs from 'dayjs';
import Toast from 'react-native-toast-message';
import {useTranslation} from 'react-i18next';

export default function ProviderDisputeScreen() {
  const {id} = useLocalSearchParams<{id: string}>(); // This is the BOOKING ID
  const router = useRouter();

  const [dispute, setDispute] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {t} = useTranslation();

  useEffect(() => {
    fetchDispute();
  }, [id]);

  const fetchDispute = async () => {
    try {
      const {data, error} = await supabase
        .from('disputes')
        .select(` *, client:profile!disputes_client_id_fkey(name, phone, image)`)
        .or(`service_booking_id.eq.${id},event_booking_id.eq.${id}`)
        .single();

      if (error) throw error;
      setDispute(data);
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'PGRST116') {
        Alert.alert(t('dispute.error'), t('dispute.notFound'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) {
      Alert.alert(t('dispute.error'), t('dispute.error')); // Using generic error or add new key
      return;
    }

    setIsSubmitting(true);
    try {
      const {error} = await supabase
        .from('disputes')
        .update({
          response_provider: responseText,
          status: 'under_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', dispute.id);

      if (error) throw error;

      Toast.show({type: 'success', text1: t('dispute.responseSuccess')});
      fetchDispute(); // Refresh
    } catch (err: any) {
      Alert.alert(t('dispute.error'), err.message || t('dispute.error'));
    } finally {
      setIsSubmitting(false);
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
        return 'text-red-600 bg-red-100'; // Action needed from provider usually
      case 'under_review':
        return 'text-blue-600 bg-blue-100';
      case 'resolved_refund':
        return 'text-gray-600 bg-gray-200';
      case 'resolved_payout':
        return 'text-green-600 bg-green-100';
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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-5 py-6">
          {/* Status Chip */}
          <View className="mb-6 flex-row justify-center">
            <View className={`rounded-full px-4 py-1.5 ${getStatusColor(dispute.status).split(' ')[1]}`}>
              <Body className={`font-nunito-bold capitalize ${getStatusColor(dispute.status).split(' ')[0]}`}>
                {t('dispute.status')}: {getStatusLabel(dispute.status)}
              </Body>
            </View>
          </View>

          {/* Client Info */}
          <View className="mb-6 flex-row items-center rounded-xl bg-gray-50 p-4">
            <Image
              source={{uri: dispute.client?.image ? supabase.storage.from('avatars').getPublicUrl(dispute.client.image).data.publicUrl : undefined}}
              className="mr-3 h-12 w-12 rounded-full bg-gray-200"
            />
            <View>
              <H3 className="text-base text-gray-900">{dispute.client?.name || t('dispute.client')}</H3>
              <Caption className="text-gray-500">
                {t('dispute.bookingId')} #{id?.substring(0, 8)}
              </Caption>
            </View>
          </View>

          {/* Issue Details */}
          <View className="mb-6">
            <H3 className="mb-2 text-gray-900">{t('dispute.reason')}</H3>
            <View className="rounded-xl border border-gray-100 bg-red-50/50 p-4">
              <Body className="leading-5 text-gray-800">{getReasonDisplay(dispute.reason)}</Body>
            </View>
          </View>

          {/* Evidence */}
          {dispute.evidence_client && dispute.evidence_client.length > 0 && (
            <View className="mb-6">
              <H3 className="mb-2 text-gray-900">{t('dispute.evidence')}</H3>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {dispute.evidence_client.map((path: string, index: number) => {
                  const {data} = supabase.storage.from('dispute').getPublicUrl(path);
                  return (
                    <View key={index} className="mr-3">
                      <Image source={{uri: data.publicUrl}} className="h-24 w-24 rounded-lg bg-gray-200" />
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Provider Response Section */}
          <View className="mb-8">
            <H3 className="mb-2 text-gray-900">{t('dispute.yourResponse') || 'Your Response'}</H3>

            {dispute.response_provider ? (
              <View className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <Body className="leading-5 text-gray-800">{dispute.response_provider}</Body>
                <Caption className="mt-2 text-xs text-gray-400">Submitted on {dayjs(dispute.updated_at).format('MMM D, h:mm A')}</Caption>
              </View>
            ) : (
              <View>
                <Caption className="mb-2 text-gray-500">{t('dispute.provideResponse')}</Caption>
                <TextInput
                  className="mb-4 h-32 rounded-xl border border-gray-100 bg-gray-50 p-4 font-nunito text-base text-gray-900"
                  placeholder={t('dispute.responsePlaceholder')}
                  multiline
                  textAlignVertical="top"
                  value={responseText}
                  onChangeText={setResponseText}
                />
                <TouchableOpacity
                  onPress={handleSubmitResponse}
                  disabled={isSubmitting}
                  className={`items-center justify-center rounded-full bg-primary py-3 ${isSubmitting ? 'opacity-70' : ''}`}>
                  {isSubmitting ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Body className="font-nunito-bold text-white">{t('dispute.submitResponse')}</Body>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Resolution */}
          {dispute.resolution && (
            <View className="mb-6">
              <H3 className="mb-2 text-gray-900">{t('dispute.resolution')}</H3>
              <View
                className={`rounded-xl border p-4 ${dispute.resolution === 'provider_win' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <Body className="mb-1 font-nunito-bold text-gray-900">{getResolutionLabel(dispute.resolution)}</Body>
                {dispute.admin_notes && <Body className="mt-1 text-sm text-gray-600">{dispute.admin_notes}</Body>}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
