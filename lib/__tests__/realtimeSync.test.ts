jest.mock('@/lib/autoSync', () => ({
  scheduleHouseholdPullSync: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(() => null),
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: {
    getState: () => ({
      householdId: null,
      user: null,
      configured: false,
      isReady: true,
    }),
    subscribe: () => () => {},
  },
}));

import { installHouseholdRealtimeSync } from '@/lib/realtimeSync';
import { scheduleHouseholdPullSync } from '@/lib/autoSync';

describe('installHouseholdRealtimeSync', () => {
  it('exports an installer that is safe when Supabase is not configured', () => {
    const cleanup = installHouseholdRealtimeSync();
    expect(typeof cleanup).toBe('function');
    cleanup();
    expect(scheduleHouseholdPullSync).not.toHaveBeenCalled();
  });
});
