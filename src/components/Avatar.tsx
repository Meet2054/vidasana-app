import {stringHash} from '@/utils';
import {supabase} from '@/utils/supabase';
import {Image, Text, View} from 'react-native';

type AvatarProps = {name?: string; size?: number; className?: string; uri?: string | null};

const colorSet = [
  {bg: '#FFF9EB', text: '#FFB300'},
  {bg: '#FDEBFF', text: '#EE33FF'},
  {bg: '#FFEBF1', text: '#FF3377'},
  {bg: '#EBEEFF', text: '#3358FF'},
];

const resolveUri = (uri: string | null | undefined): string | null => {
  if (!uri) return null;
  // Already a full URL — use as-is
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  // Relative path — resolve via Supabase storage
  return supabase.storage.from('profile').getPublicUrl(uri).data.publicUrl;
};

export function Avatar({name = '', uri = null, size = 60, className}: AvatarProps) {
  const colorIndex = name ? stringHash(name) % colorSet.length : 0;
  const randomColor = colorSet[colorIndex];
  const resolvedUri = resolveUri(uri);

  const getInitials = (fullName: string) => {
    if (!fullName.trim()) return 'N/A';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    const first = parts[0][0];
    const last = parts[parts.length - 1][0];
    return (first + last).toUpperCase();
  };

  const initials = getInitials(name);
  const backgroundColor = randomColor.bg;
  const initialsColor = randomColor.text;

  return (
    <View
      style={{width: size, height: size, backgroundColor: backgroundColor}}
      className={`items-center justify-center overflow-hidden rounded-full ${className}`}>
      {resolvedUri ? (
        <Image source={{uri: resolvedUri}} style={{width: size, height: size, borderRadius: size / 2}} />
      ) : (
        <Text className="font-nunito-bold" style={{fontSize: size * 0.4, color: initialsColor}}>
          {initials}
        </Text>
      )}
    </View>
  );
}
