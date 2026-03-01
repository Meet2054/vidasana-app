const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const eventId = '3b65c668-6da4-4c55-93e8-4bafe55b7d22';
  const { data, error } = await supabase
    .from('event_ticket_types')
    .select('*, events(provider)')
    .eq('event_id', eventId);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Ticket Types:', JSON.stringify(data, null, 2));
  }
}

check();
