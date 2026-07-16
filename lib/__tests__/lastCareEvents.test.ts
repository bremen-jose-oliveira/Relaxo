import {
  formatLastCareWhen,
  getLastBath,
  getLastDirtyDiaper,
} from '../lastCareEvents';
import type { BathEvent, DiaperEvent } from '@/types';

function bath(id: string, time: string): BathEvent {
  return { id, babyId: 'b1', time, notes: null };
}

function diaper(
  id: string,
  diaperType: DiaperEvent['diaperType'],
  time: string
): DiaperEvent {
  return { id, babyId: 'b1', diaperType, time, notes: null };
}

describe('lastCareEvents', () => {
  it('returns newest bath', () => {
    const baths = [
      bath('1', '2025-06-01T10:00:00'),
      bath('2', '2025-06-03T19:00:00'),
      bath('3', '2025-06-02T12:00:00'),
    ];
    expect(getLastBath(baths)?.id).toBe('2');
  });

  it('excludes bath id when editing', () => {
    const baths = [
      bath('1', '2025-06-01T10:00:00'),
      bath('2', '2025-06-03T19:00:00'),
    ];
    expect(getLastBath(baths, '2')?.id).toBe('1');
  });

  it('returns newest dirty or mixed diaper and skips wet', () => {
    const diapers = [
      diaper('w1', 'wet', '2025-06-04T12:00:00'),
      diaper('d1', 'dirty', '2025-06-02T08:00:00'),
      diaper('m1', 'mixed', '2025-06-03T09:00:00'),
    ];
    expect(getLastDirtyDiaper(diapers)?.id).toBe('m1');
  });

  it('formats today / yesterday / older labels', () => {
    const now = new Date('2025-06-10T15:00:00');
    const labels = { today: 'Today', yesterday: 'Yesterday' };

    expect(formatLastCareWhen('2025-06-10T09:30:00', labels, now)).toMatch(
      /^Today · /
    );
    expect(formatLastCareWhen('2025-06-09T19:40:00', labels, now)).toMatch(
      /^Yesterday · /
    );
    expect(formatLastCareWhen('2025-06-05T11:00:00', labels, now)).not.toMatch(
      /Today|Yesterday/
    );
  });
});
