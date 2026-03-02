import React from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Body, Subtitle} from './Typography'; // Assuming these exist in the same directory or are exported from index
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Modal, View, TouchableOpacity, ScrollView, Text, Linking} from 'react-native';

interface LegalModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export const LegalModal: React.FC<LegalModalProps> = ({visible, onClose, title, content}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="h-[85%] overflow-hidden rounded-t-3xl bg-white">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
            <Subtitle className="font-nunito-bold text-lg">{title}</Subtitle>
            <TouchableOpacity onPress={onClose} className="rounded-full bg-gray-100 p-2">
              <Ionicons name="close" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 40 + insets.bottom}} showsVerticalScrollIndicator={true}>
            {content.split('\n').map((line, index) => {
              const trimmedLine = line.trim();
              if (!trimmedLine) return <View key={index} className="h-2" />; // Spacer for empty lines

              // Main Title Styling
              if (index === 0 && (trimmedLine.includes('TERMS AND CONDITIONS') || trimmedLine.includes('PRIVACY POLICY'))) {
                return (
                  <Text key={index} className="mb-6 mt-2 text-center font-nunito-black text-3xl uppercase leading-9 text-primary">
                    {trimmedLine}
                  </Text>
                );
              }

              // Check for main numbered headings (e.g., "1. Introduction")
              if (/^\d+\./.test(trimmedLine)) {
                return (
                  <Subtitle key={index} className="mb-2 mt-4 font-nunito-bold text-lg text-primary">
                    {trimmedLine}
                  </Subtitle>
                );
              }

              // Check for titled points (e.g., "Point Name: Description")
              const colonIndex = trimmedLine.indexOf(':');
              if (colonIndex > 0 && colonIndex < 50) {
                // Limit length to avoid false positives
                const titlePart = trimmedLine.substring(0, colonIndex + 1);
                const descPart = trimmedLine.substring(colonIndex + 1);
                return (
                  <Body key={index} className="mb-2 leading-6 text-gray-600">
                    <Body className="font-nunito-bold text-black">{titlePart}</Body>
                    {descPart}
                  </Body>
                );
              }

              // Check for email address (clickable)
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (emailRegex.test(trimmedLine)) {
                return (
                  <TouchableOpacity key={index} onPress={() => Linking.openURL(`mailto:${trimmedLine}`)}>
                    <Body className="mb-2 font-nunito-bold leading-6 text-blue-500 underline">{trimmedLine}</Body>
                  </TouchableOpacity>
                );
              }

              // Standard paragraph
              return (
                <Body key={index} className="mb-2 leading-6 text-gray-600">
                  {trimmedLine}
                </Body>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
