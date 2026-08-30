// Optional Edge Function alternative to the SQL RPC in 0025_delete_my_account.sql.
// Deploy only if the RPC cannot delete auth.users in your project.
//
// supabase functions deploy delete-account --no-verify-jwt=false
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const uid = user.id;

  // Households this user created that still have other members → transfer ownership.
  const { data: owned } = await admin
    .from('households')
    .select('id')
    .eq('created_by', uid);
  for (const row of owned ?? []) {
    const { data: others } = await admin
      .from('household_members')
      .select('user_id')
      .eq('household_id', row.id)
      .neq('user_id', uid)
      .order('joined_at', { ascending: true })
      .limit(1);
    const nextOwner = others?.[0]?.user_id;
    if (nextOwner) {
      await admin.from('households').update({ created_by: nextOwner }).eq('id', row.id);
    }
  }

  await admin.from('household_members').delete().eq('user_id', uid);

  // Empty households still owned by this user.
  const { data: leftover } = await admin
    .from('households')
    .select('id')
    .eq('created_by', uid);
  for (const row of leftover ?? []) {
    const { count } = await admin
      .from('household_members')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', row.id);
    if (!count) {
      await admin.from('households').delete().eq('id', row.id);
    } else {
      await admin.from('households').update({ created_by: null }).eq('id', row.id);
    }
  }

  await admin.from('profiles').delete().eq('id', uid);
  const { error: delError } = await admin.auth.admin.deleteUser(uid);
  if (delError) {
    return new Response(JSON.stringify({ error: delError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
