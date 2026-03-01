import React from 'react';
import {Modal, View, TouchableOpacity} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {H2, Body, H3} from '../Typography';

interface MoodCheckInModalProps {
  visible: boolean;
  onClose: () => void;
  onMoodSelect?: (categoryId: number) => void;
}

const MOODS = [
  {id: 'energetic', icon: '⚡', label: 'Energetic', categoryId: 3, color: '#F59E0B', bg: '#FFFBEB'}, // Amber
  {id: 'relaxed', icon: '🧘', label: 'Relaxed', categoryId: 1, color: '#10B981', bg: '#ECFDF5'}, // Emerald
  {id: 'happy', icon: '😊', label: 'Happy', categoryId: 5, color: '#EC4899', bg: '#FDF2F8'}, // Pink
  {id: 'focused', icon: '🎯', label: 'Focused', categoryId: 6, color: '#3B82F6', bg: '#EFF6FF'}, // Blue
  {id: 'sad', icon: '😔', label: 'Low', categoryId: 2, color: '#6366F1', bg: '#EEF2FF'}, // Indigo
  {id: 'stressed', icon: '😫', label: 'Anxious', categoryId: 4, color: '#8B5CF6', bg: '#F5F3FF'}, // Violet
];

export const MoodCheckInModal = ({visible, onClose, onMoodSelect}: MoodCheckInModalProps) => {
  const router = useRouter();
  const {t} = useTranslation();

  const handleMoodSelect = (categoryId: number) => {
    onClose();
    if (onMoodSelect) {
      onMoodSelect(categoryId);
    } else {
      // Fallback for standalone usage if any
      setTimeout(() => {
        // @ts-ignore
        router.push({
          pathname: '/(user)/(tabs)/home',
          params: {categoryId: categoryId.toString(), focus: 'false'},
        });
      }, 100);
    }
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-4">
        <View className="w-full max-w-sm overflow-hidden rounded-[32px] bg-white p-6 shadow-2xl">
          {/* Header */}
          <View className="mb-6 flex-row items-start justify-between">
            <View>
              <H2 className="text-gray-900">Hi, Finding Balance?</H2>
              <Body className="mt-1 text-gray-500">How are you feeling right now?</Body>
            </View>
            <TouchableOpacity onPress={onClose} className="rounded-full bg-gray-50 p-2">
              <Feather name="x" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Grid */}
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {MOODS.map((mood) => (
              <TouchableOpacity
                key={mood.id}
                onPress={() => handleMoodSelect(mood.categoryId)}
                activeOpacity={0.7}
                className="h-36 w-[48%] items-center justify-center rounded-3xl border-2"
                style={{
                  borderColor: mood.color,
                  backgroundColor: mood.bg,
                }}>
                <View className="h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                  <H2 className="text-3xl">{mood.icon}</H2>
                </View>
                <H3 className="mt-3 text-lg" style={{color: mood.color}}>
                  {mood.label}
                </H3>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};
