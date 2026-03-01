import {useQuery} from '@tanstack/react-query';
import {supabase} from '@/utils/supabase';
import {useAppStore} from '@/store';

export interface StripeStatus {
  isConnected: boolean;
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
}

export function useStripeStatus() {
  const {user} = useAppStore((s) => s.session!);

  return useQuery({
    enabled: !!user?.id,
    staleTime: Infinity,
    queryKey: ['STRIPE_CONNECT', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const {data, error} = await supabase.functions.invoke('stripe-connect', {
          body: {action: 'check_status'},
        });
        if (error) throw error;
        return data as StripeStatus;
      } catch (e) {
        console.error('useStripeStatus error:', e);
        // Fallback: just check if stripe ID exists in DB if function fails (e.g. not deployed yet)
        const {data: provider} = await supabase.from('provider').select('stripe').eq('id', user.id).single();
        return {isConnected: !!provider?.stripe, details_submitted: false} as StripeStatus;
      }
    },
  });
}
