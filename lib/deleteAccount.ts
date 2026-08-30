import { clearSyncState } from '@/db/syncState';
import { wipeAllLocalCareData } from '@/db/database';
import { getSupabase } from '@/lib/supabase';
import { signOut as authSignOut } from '@/lib/auth';

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

/** Remove cloud account (RPC) then wipe local data and sign out. */
export async function deleteCloudAccountAndWipeLocal(): Promise<DeleteAccountResult> {
  const supabase = getSupabase();
  if (!supabase) {
    await wipeAllLocalCareData();
    return { ok: true };
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    // Fallback: edge function if RPC missing / auth.users delete blocked.
    const { error: fnError } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });
    if (fnError) {
      return { ok: false, error: error.message || fnError.message };
    }
  }

  try {
    await wipeAllLocalCareData();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Local wipe failed',
    };
  }

  try {
    await authSignOut();
  } catch {
    // Account may already be gone.
  }
  await clearSyncState();
  return { ok: true };
}

export async function wipeLocalDataOnly(): Promise<void> {
  await wipeAllLocalCareData();
  try {
    const { setWidgetBridge } = await import('@/modules/widget-bridge');
    setWidgetBridge(null);
  } catch {
    // ignore
  }
}
