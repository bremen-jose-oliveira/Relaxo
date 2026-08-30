import {
  SYNC_PULL_PAGE_SIZE,
  filterChangedPushRows,
  filterTimedEventPushRows,
  payloadsEqual,
  pullAllPages,
  shouldKeepLocalEndOverRemoteOpen,
  shouldKeepLocalOverRemote,
  stripSyncMeta,
} from '@/lib/syncDiff';

describe('syncDiff', () => {
  it('treats null and empty string as equal for optional text', () => {
    expect(payloadsEqual({ notes: null }, { notes: '' })).toBe(true);
    expect(payloadsEqual({ notes: '' }, { notes: null })).toBe(true);
  });

  it('equates numeric strings with numbers', () => {
    expect(payloadsEqual({ amount: 30 }, { amount: '30' })).toBe(true);
    expect(payloadsEqual({ nap_goal: 0 }, { nap_goal: '0' })).toBe(true);
  });

  it('equates boolean flags with 0/1', () => {
    expect(
      payloadsEqual({ track_feeding_duration: 1 }, { track_feeding_duration: true })
    ).toBe(true);
    expect(
      payloadsEqual({ track_feeding_duration: 0 }, { track_feeding_duration: false })
    ).toBe(true);
  });

  it('ignores updated_at / deleted_at when comparing push rows', () => {
    const local = {
      id: '1',
      name: 'Leo',
      updated_at: '2026-08-07T00:00:00.000Z',
      deleted_at: null,
    };
    const remote = { id: '1', name: 'Leo' };
    expect(payloadsEqual(stripSyncMeta(local), remote)).toBe(true);
  });

  it('skips unchanged rows and pushes missing or different ones', () => {
    const snapshots = new Map<string, Record<string, unknown>>([
      ['sleep_events:a', { id: 'a', type: 'nap', start_time: 't1' }],
      ['sleep_events:b', { id: 'b', type: 'nap', start_time: 't2' }],
    ]);
    const rows = [
      { id: 'a', type: 'nap', start_time: 't1', updated_at: 'now' },
      { id: 'b', type: 'night', start_time: 't2', updated_at: 'now' },
      { id: 'c', type: 'nap', start_time: 't3', updated_at: 'now' },
    ];
    const changed = filterChangedPushRows(rows, snapshots, (row) => `sleep_events:${row.id}`);
    expect(changed.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('keeps unpushed still-asleep reopen when remote end is stale', () => {
    expect(
      shouldKeepLocalOverRemote({
        hasLocal: true,
        localDiffersFromRemote: true,
        remoteUpdatedAt: '2026-08-20T09:55:00.000Z',
        lastSyncedAt: '2026-08-20T10:00:00.000Z',
      })
    ).toBe(true);
  });

  it('takes partner sleep end when cloud is newer than last sync', () => {
    expect(
      shouldKeepLocalOverRemote({
        hasLocal: true,
        localDiffersFromRemote: true,
        remoteUpdatedAt: '2026-08-20T10:05:00.000Z',
        lastSyncedAt: '2026-08-20T10:00:00.000Z',
      })
    ).toBe(false);
  });

  it('keeps local end over a still-open remote even if remote updated_at is newer', () => {
    expect(
      shouldKeepLocalEndOverRemoteOpen({
        localEndTime: '2026-08-30T11:00:00.000Z',
        remoteEndTime: null,
      })
    ).toBe(true);
    expect(
      shouldKeepLocalEndOverRemoteOpen({
        localEndTime: null,
        remoteEndTime: '2026-08-30T11:00:00.000Z',
      })
    ).toBe(false);
  });

  it('pushes still-asleep reopen over a stale remote end_time', () => {
    const snapshots = new Map<string, Record<string, unknown>>([
      [
        'sleep_events:a',
        {
          id: 'a',
          type: 'nap',
          start_time: 't1',
          end_time: '2026-08-20T09:50:00.000Z',
        },
      ],
    ]);
    const rows = [
      {
        id: 'a',
        type: 'nap',
        start_time: 't1',
        end_time: null,
        updated_at: 'now',
      },
    ];
    const changed = filterTimedEventPushRows(
      rows,
      snapshots,
      (row) => `sleep_events:${row.id}`
    );
    expect(changed).toHaveLength(1);
    expect(changed[0].end_time).toBeNull();
  });

  it('paginates pulls until a short page', async () => {
    const page1 = Array.from({ length: SYNC_PULL_PAGE_SIZE }, (_, i) => ({ id: `a${i}` }));
    const page2 = [{ id: 'last' }];
    const calls: Array<[number, number]> = [];

    const result = await pullAllPages(async (from, to) => {
      calls.push([from, to]);
      if (from === 0) return { rows: page1 };
      return { rows: page2 };
    });

    expect(calls).toEqual([
      [0, SYNC_PULL_PAGE_SIZE - 1],
      [SYNC_PULL_PAGE_SIZE, SYNC_PULL_PAGE_SIZE * 2 - 1],
    ]);
    expect(result.rows).toHaveLength(SYNC_PULL_PAGE_SIZE + 1);
    expect(result.rows[result.rows.length - 1]).toEqual({ id: 'last' });
  });

  it('treats settle care fields as part of sleep push equality', () => {
    const remote = {
      id: 'a',
      type: 'nap',
      start_time: 't1',
      end_time: null,
      settle_minutes: 12,
      settle_quality: 'calm',
      settle_aid: null,
      sleep_place: 'crib',
    };
    const local = {
      ...remote,
      updated_at: 'now',
      deleted_at: null,
    };
    expect(payloadsEqual(stripSyncMeta(local), remote)).toBe(true);

    const staleSnapshot = {
      id: 'a',
      type: 'nap',
      start_time: 't1',
      end_time: null,
      // Missing settle_* — old clients treated every sleep as dirty.
    };
    expect(payloadsEqual(stripSyncMeta(local), staleSnapshot)).toBe(false);
  });
});
