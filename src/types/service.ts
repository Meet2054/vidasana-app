import {Enums} from '@/types/supabase';
import * as ImagePicker from 'expo-image-picker';

export type WeekDay = Enums<'week_day'>;
export type LanguageCode = 'en' | 'es' | 'fr';

export type UnifiedImage = {
  id: string;
  type: 'existing' | 'new';
  uri: string;
  path?: string;
  file?: ImagePicker.ImagePickerAsset;
};

export type ServiceFormValues = {
  title: string;
  description: string;
  category: number | null;
  price: string;
  capacity: string;
  start_at: Date | null;
  end_at: Date | null;
  week_day: WeekDay[];
  images: UnifiedImage[];
  address: string | null;
  lat: number | null;
  lng: number | null;
};
