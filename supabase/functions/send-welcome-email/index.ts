import {serve} from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

serve(async (req) => {
  try {
    // 1. Parse the incoming webhook payload from Supabase
    const payload = await req.json();

    // The webhook sends the new row data from auth.users in the `record` object
    const user = payload.record;

    // Safety check: ensure we actually received a record
    if (!user || !user.email) {
      return new Response('No email or record provided', {status: 400});
    }

    const email = user.email;

    // Fetch name if you saved it during signup (e.g. from user_metadata)
    // Supabase auth metadata is stored in raw_user_meta_data
    const name = user.raw_user_meta_data?.full_name || 'there';
    const role = user.raw_user_meta_data?.role || 'user';

    console.log(`Sending welcome email to ${email} (Role: ${role})...`);

    const isProvider = role === 'provider';
    const providerMessage = isProvider
      ? '<p>As a registered Provider, our team will review your application and approve your account within 2 days.</p>'
      : '<p>We are thrilled to have you join our community! Your account has been successfully created.</p>';

    // 2. Send the email using the Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'VidaSana <hello@vidasanawellness.com>', // UPDATE THIS: Replace with your verified Resend domain
        to: email,
        subject: 'Welcome to VidaSana Wellness!',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h1 style="color: #00594f;">Welcome to VidaSana Wellness!</h1>
            <p>Hi ${name},</p>
            ${providerMessage}
            <p>If you have any questions or need help getting started, please don't hesitate to reach out to our support team.</p>
            <br/>
            <p>Best regards,</p>
            <p><strong>The VidaSana Team</strong></p>
          </div>
        `,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      console.log('Email sent successfully:', data);
      return new Response(JSON.stringify(data), {
        headers: {'Content-Type': 'application/json'},
        status: 200,
      });
    } else {
      console.error('Error from Resend:', data);
      return new Response(JSON.stringify(data), {
        headers: {'Content-Type': 'application/json'},
        status: 400,
      });
    }
  } catch (err: any) {
    console.error('Webhook processing error:', err.message);
    return new Response(JSON.stringify({error: err.message}), {
      headers: {'Content-Type': 'application/json'},
      status: 400,
    });
  }
});
