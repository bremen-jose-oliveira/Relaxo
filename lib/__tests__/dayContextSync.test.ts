import {
  dayContextUniqKey,
  pickCanonicalDayContextRemoteIds,
} from '@/lib/dayContextSync';

describe('dayContextSync', () => {
  it('prefers live rows over soft-deleted duplicates', () => {
    const map = pickCanonicalDayContextRemoteIds([
      {
        id: 'old',
        baby_id: 'b1',
        date_key: '2026-08-10',
        tag: 'outing',
        deleted_at: '2026-08-10T10:00:00Z',
      },
      {
        id: 'live',
        baby_id: 'b1',
        date_key: '2026-08-10',
        tag: 'outing',
        deleted_at: null,
      },
    ]);
    expect(map.get(dayContextUniqKey('b1', '2026-08-10', 'outing'))).toBe('live');
  });

  it('keeps soft-deleted id when only tombstone exists', () => {
    const map = pickCanonicalDayContextRemoteIds([
      {
        id: 'tomb',
        baby_id: 'b1',
        date_key: '2026-08-10',
        tag: 'park',
        deleted_at: '2026-08-10T10:00:00Z',
      },
    ]);
    expect(map.get(dayContextUniqKey('b1', '2026-08-10', 'park'))).toBe('tomb');
  });
});
