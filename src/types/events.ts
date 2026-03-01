import * as ImagePicker from 'expo-image-picker';

export type LanguageCode = 'en' | 'es' | 'fr';

export type EventUnifiedImage = {
  id: string;
  type: 'existing' | 'new';
  uri: string;
  file?: ImagePicker.ImagePickerAsset;
};

export type TicketType = {
  id?: string;
  name: string;
  price: string;
  capacity: string;
};

export type EventFormValues = {
  title: string;
  description: string;
  category: number | null;
  start_at: Date | null;
  end_at: Date | null;
  book_till: Date | null;
  images: EventUnifiedImage[];
  ticket_types: TicketType[];
  address: string | null;
  lat: number | null;
  lng: number | null;
};

// UI Types
export interface Event {
  id: string;
  title: string;
  description: string;
  images: string[] | null;
  start_at: string;
  end_at: string;
  book_till: string | null;
  category: number;
  lat?: number | null;
  lng?: number | null;
  dist_meters?: number;
  event_ticket_types?: {price: number}[];
  price?: number; // Derived minimum price
}
