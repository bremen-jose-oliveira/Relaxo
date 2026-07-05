import { isInstantFeeding, isOngoingFeeding } from '../feedingUtils';
import type { FeedingEvent } from '@/types';

describe('feedingUtils', () => {
  const instant: FeedingEvent = {
    id: '1',
    babyId: 'b',
    feedType: 'breast',
    startTime: '2025-06-01T10:00:00',
    endTime: '2025-06-01T10:00:00',
    side: 'left',
    amount: null,
    unit: null,
    notes: null,
  };

  const ongoing: FeedingEvent = {
    ...instant,
    id: '2',
    startTime: '2025-06-01T11:00:00',
    endTime: null,
  };

  it('detects instant feeds', () => {
    expect(isInstantFeeding(instant)).toBe(true);
    expect(isInstantFeeding(ongoing)).toBe(false);
  });

  it('detects ongoing breast feed', () => {
    expect(isOngoingFeeding([instant, ongoing])).toBe(ongoing);
  });
});
