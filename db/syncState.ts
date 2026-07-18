import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';

const { syncState } = schema;

export type SyncState = {
  householdId: string | null;
  inviteCode: string | null;
  householdName: string | null;
  lastSyncedAt: string | null;
};

const DEFAULT_ID = 'default';

export async function getSyncState(): Promise<SyncState> {
  const db = await getDb();
  const rows = await db.select().from(syncState).where(eq(syncState.id, DEFAULT_ID)).limit(1);
  if (rows.length === 0) {
    await db.insert(syncState).values({
      id: DEFAULT_ID,
      householdId: null,
      inviteCode: null,
      householdName: null,
      lastSyncedAt: null,
    });
    return {
      householdId: null,
      inviteCode: null,
      householdName: null,
      lastSyncedAt: null,
    };
  }
  const row = rows[0];
  return {
    householdId: row.householdId ?? null,
    inviteCode: row.inviteCode ?? null,
    householdName: row.householdName ?? null,
    lastSyncedAt: row.lastSyncedAt ?? null,
  };
}

export async function setSyncState(patch: Partial<SyncState>): Promise<SyncState> {
  const current = await getSyncState();
  const next: SyncState = {
    householdId: patch.householdId !== undefined ? patch.householdId : current.householdId,
    inviteCode: patch.inviteCode !== undefined ? patch.inviteCode : current.inviteCode,
    householdName:
      patch.householdName !== undefined ? patch.householdName : current.householdName,
    lastSyncedAt: patch.lastSyncedAt !== undefined ? patch.lastSyncedAt : current.lastSyncedAt,
  };
  const db = await getDb();
  await db
    .update(syncState)
    .set({
      householdId: next.householdId,
      inviteCode: next.inviteCode,
      householdName: next.householdName,
      lastSyncedAt: next.lastSyncedAt,
    })
    .where(eq(syncState.id, DEFAULT_ID));
  return next;
}

export async function clearSyncState(): Promise<void> {
  await setSyncState({
    householdId: null,
    inviteCode: null,
    householdName: null,
    lastSyncedAt: null,
  });
}
