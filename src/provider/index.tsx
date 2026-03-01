import {useAppStore} from '@/store';
import {useRouter} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import storage from 'expo-sqlite/kv-store';
import {useQueryClientState} from '@/hooks';
import {SOSFAB, SOSModal} from '@/components';
import {supabase, toastConfig} from '@/utils';
import {ReactElement, useEffect} from 'react';
import Toast from 'react-native-toast-message';
import {QueryClient} from '@tanstack/react-query';
import {KeyboardProvider} from 'react-native-keyboard-controller';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {PersistQueryClientProvider} from '@tanstack/react-query-persist-client';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister';

const queryClient = new QueryClient({defaultOptions: {queries: {retry: 2, staleTime: __DEV__ ? 0 : 1000 * 60 * 10}}});

const AppProvider = ({children}: {children: ReactElement}) => {
  useQueryClientState();
  const router = useRouter();
  const {top} = useSafeAreaInsets();
  const session = useAppStore((e) => e.session!);
  const setSession = useAppStore((s) => s.setSession);

  const user = session?.user;

  useEffect(() => {
    const {data} = supabase.auth.onAuthStateChange((e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Global status check for reject/delete (applies to both users and providers)
  useEffect(() => {
    const checkUserStatus = async () => {
      if (!user) return;
      const {data} = await supabase.from('profile').select('status').eq('id', user.id).single();
      const status = data?.status;
      if (status === 'reject') {
        router.replace('/contact-support?reason=reject');
      } else if (status === 'delete') {
        router.replace('/contact-support?reason=delete');
      } else if (status === 'suspended') {
        router.replace('/contact-support?reason=suspended');
      }
    };
    // supabase.auth.signOut();
    checkUserStatus();
  }, [user]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView className="flex-1">
        <PersistQueryClientProvider client={queryClient} persistOptions={{persister: createAsyncStoragePersister({storage})}}>
          <KeyboardProvider>{children}</KeyboardProvider>
        </PersistQueryClientProvider>
        <StatusBar translucent style="auto" backgroundColor="transparent" />
        <Toast position="top" topOffset={top} config={toastConfig} />
        <SOSModal />
        <SOSFAB />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default AppProvider;
