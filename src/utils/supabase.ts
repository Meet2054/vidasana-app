import {Database} from '@/types';
import {createClient} from '@supabase/supabase-js';
import {DocumentPickerAsset} from 'expo-document-picker';
import {ImagePickerAsset} from 'expo-image-picker';
import {deleteItemAsync, getItemAsync, setItemAsync} from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => getItemAsync(key),
  removeItem: (key: string) => deleteItemAsync(key),
  setItem: (key: string, value: string) => {
    if (value.length > 2048)
      console.warn(
        'Value being stored in SecureStore is larger than 2048 bytes and it may not be stored successfully. In a future SDK version, this call may throw an error.'
      );
    return setItemAsync(key, value);
  },
};

export const supabase = createClient<Database>(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', {
  auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: ExpoSecureStoreAdapter as any},
});

type Buckets = 'provider_docs' | 'images' | 'profile';

export async function uploadFile(file: DocumentPickerAsset | ImagePickerAsset, bucket: Buckets, path: string) {
  try {
    const formData = new FormData();
    // @ts-ignore
    formData.append('file', {uri: file.uri, name: file.name || (file as any).fileName, type: file.mimeType} as any);
    return await supabase.storage.from(bucket).upload(path, formData, {upsert: true, contentType: file.mimeType});
  } catch (err) {
    return {data: null, error: err};
  }
}
