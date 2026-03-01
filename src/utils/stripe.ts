import {supabase} from './supabase';
import {Alert, Linking} from 'react-native';

/**
 * Onboard a provider to Stripe Connect
 */
export const connectAccount = async () => {
  try {
    const {data, error} = await supabase.functions.invoke('connect-account', {method: 'POST'});

    if (error) throw error;
    if (data?.url) {
      await Linking.openURL(data.url);
    } else {
      throw new Error('No onboarding URL returned');
    }
  } catch (error: any) {
    console.error('Stripe Connect Error:', error);
    Alert.alert('Error', error.message || 'Failed to connect Stripe account');
  }
};

/**
 * Fetch parameters for PaymentSheet (Secure/Cloud implementation)
 * Uses Supabase Edge Functions to handle payments securely.
 */
export const fetchPaymentSheetParams = async ({id, type, ticketId}: {id: string; type: 'service' | 'event'; ticketId?: string}) => {
  try {
    const {
      data: {user},
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not found');

    // 1. Get Details from Database
    let providerId;
    let price = 0;

    if (type === 'service') {
      const {data} = await supabase.from('services').select('id, price, provider').eq('id', id).single();
      if (!data) throw new Error('Service not found');
      providerId = data.provider;
      price = data.price || 0;
    } else if (type === 'event') {
      // For events, we need the ticket price and the event's owner (provider)
      if (!ticketId) throw new Error('Ticket ID required for events');

      const {data: ticket} = await supabase.from('event_ticket_types').select('price, events(provider)').eq('id', ticketId).single();
      if (!ticket) throw new Error('Ticket not found');

      providerId = (ticket.events as any)?.provider;
      price = ticket.price || 0;
    }

    if (!providerId) throw new Error('Provider ID missing');

    // 2. Ensure Stripe Customer ID
    let customerId = user.user_metadata?.stripe_customer_id;
    if (!customerId) {
      const {data: customerData, error: customerError} = await supabase.functions.invoke('stripe-connect', {
        body: {email: user.email, action: 'create-customer', name: user.user_metadata?.full_name || user.email},
      });

      if (customerError) throw customerError;
      if (customerData?.error) throw new Error(`Edge Function: ${customerData.error}`);

      customerId = customerData.customerId;
    }

    // 3. Get Ephemeral Key via Edge Function
    const {data: ekData, error: ekError} = await supabase.functions.invoke('stripe-connect', {
      body: {action: 'create-ephemeral-key', customerId},
    });

    if (ekError) throw ekError;
    if (ekData?.error) throw new Error(`Ephemeral Key Error: ${ekData.error}`);

    // If price is 0, skip Payment Intent (it's a free item)
    if (price === 0) {
      return {
        customer: customerId,
        ephemeralKey: ekData.secret,
        paymentIntent: null, // No payment intent for free items
        publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      };
    }

    // 4. Create Payment Intent via Edge Function
    const amount = Math.round(price * 100);
    const {data: piData, error: piError} = await supabase.functions.invoke('stripe-connect', {
      body: {amount, customerId, providerId, action: 'create-payment-intent'},
    });

    if (piError) throw piError;
    if (piData?.error) throw new Error(`Payment Intent Error: ${piData.error}`);

    return {
      customer: customerId,
      ephemeralKey: ekData.secret,
      paymentIntent: piData.clientSecret,
      publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    };
  } catch (error: any) {
    console.error('fetchPaymentSheetParams Error:', error);
    throw error;
  }
};
