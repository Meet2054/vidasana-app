import React from 'react';
import {useAppStore} from '@/store';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {H2, Caption} from '../Typography';
import {Avatar} from '../Avatar';
import {View, TouchableOpacity} from 'react-native';

export const HomeHeader = ({onMoodPress}: {onMoodPress?: () => void}) => {
  const router = useRouter();
  const {t} = useTranslation();
  const {user} = useAppStore((s) => s.session!);
  const profileImage = user?.user_metadata?.image;

  return (
    <View className="flex-row items-center justify-between bg-white px-4 py-4">
      <View className="flex-row items-center">
        <TouchableOpacity onPress={() => router.push('/(user)/(tabs)/setting' as any)} activeOpacity={0.8}>
          <Avatar uri={profileImage} name={user?.user_metadata?.full_name} size={48} />
        </TouchableOpacity>
        <View className="ml-3">
          <Caption color="gray">
            {(() => {
              const hour = new Date().getHours();
              if (hour < 12) return t('common.goodMorning');
              if (hour < 17) return t('common.goodAfternoon');
              if (hour < 21) return t('common.goodEvening');
              return t('common.goodNight');
            })()}{' '}
            👋
          </Caption>
          <H2 className="text-lg text-black">{user?.user_metadata?.full_name || 'User'}</H2>
        </View>
      </View>

      <View className="flex-row items-center gap-3">
        <TouchableOpacity className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white" onPress={onMoodPress}>
          <Feather name="smile" size={20} color="black" />
        </TouchableOpacity>
        {/* <TouchableOpacity
          className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
          onPress={() => router.push('/(user)/notifications' as any)}>
          <Feather name="bell" size={20} color="black" />
        </TouchableOpacity> */}
        <TouchableOpacity
          className="h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white"
          onPress={() => router.push('/liked-items' as any)}>
          <Feather name="heart" size={20} color="black" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
