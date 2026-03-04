import {create} from 'zustand';
import {supabase} from '@/utils';
import storage from 'expo-sqlite/kv-store';
import {Session} from '@supabase/supabase-js';
import Toast from 'react-native-toast-message';
import {persist, createJSONStorage} from 'zustand/middleware';

interface AppState {
  isSOSOpen: boolean;
  session: Session | null;
  hasSeenMoodModal: boolean;
  profileStatus: string | null;
  signOut: () => Promise<void>;
  setSOSOpen: (isOpen: boolean) => void;
  checkProfileStatus: () => Promise<void>;
  setHasSeenMoodModal: (seen: boolean) => void;
  setSession: (session: Session | null) => void;
  setProfileStatus: (status: string | null) => void;
}

const initialState = {
  session: null,
  isSOSOpen: false,
  profileStatus: null,
  hasSeenMoodModal: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setSession: (session) => set({session}),
      setSOSOpen: (isOpen) => set({isSOSOpen: isOpen}),
      setHasSeenMoodModal: (seen) => set({hasSeenMoodModal: seen}),
      setProfileStatus: (status) => set({profileStatus: status}),
      signOut: async () => {
        await supabase.auth.signOut();
        set(initialState);
      },
      checkProfileStatus: async () => {
        const session = get().session;
        if (!session?.user?.id) return Toast.show({type: 'error', text1: 'No session found'});
        const {data} = await supabase.from('profile').select('status').eq('id', session.user.id).single();
        if (data) set({profileStatus: data.status || null});
      },
    }),
    {
      name: 'ROOT_STORAGE',
      storage: createJSONStorage(() => storage),
      onRehydrateStorage: () => (state) => {
        // ✅ When stored data loaded back, stop loading and restore auth state
      },
    }
  )
);
