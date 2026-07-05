import {
  getLastBreastSide,
  suggestNextBreastSide,
  alternateBreastSide,
} from '../breastSide';
import type { FeedingEvent } from '@/types';

function breast(side: 'left' | 'right', start: string): FeedingEvent {
  return {
    id: `f-${side}-${start}`,
    babyId: 'b1',
    feedType: 'breast',
    startTime: start,
    endTime: start,
    side,
    amount: null,
    unit: null,
    notes: null,
  };
}

describe('breastSide', () => {
  it('suggests right after last left feed', () => {
    const feedings = [breast('left', '2025-06-01T10:00:00')];
    expect(suggestNextBreastSide(feedings)).toBe('right');
    expect(getLastBreastSide(feedings)).toBe('left');
  });

  it('suggests left after last right feed', () => {
    const feedings = [breast('right', '2025-06-01T10:00:00')];
    expect(suggestNextBreastSide(feedings)).toBe('left');
  });

  it('defaults to left with no history', () => {
    expect(suggestNextBreastSide([])).toBe('left');
  });

  it('skips both and uses previous single-side feed', () => {
    const feedings = [
      breast('left', '2025-06-02T10:00:00'),
      { ...breast('left', '2025-06-01T10:00:00'), side: 'both' as const },
    ];
    expect(suggestNextBreastSide(feedings)).toBe('right');
    expect(getLastBreastSide(feedings)).toBe('left');
  });

  it('alternates sides', () => {
    expect(alternateBreastSide('left')).toBe('right');
    expect(alternateBreastSide('right')).toBe('left');
  });
});
