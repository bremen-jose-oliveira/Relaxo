jest.mock('@/modules/widget-bridge', () => ({
  getWidgetPendingActions: jest.fn(() => []),
  clearWidgetPendingActions: jest.fn(),
}));

jest.mock('@/lib/sleepWidgetActions', () => ({
  applyWidgetInteraction: jest.fn(async () => true),
}));

jest.mock('@/store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      isInitialized: true,
      initialize: jest.fn(),
      activeBabyId: 'b1',
      events: [],
      refreshEvents: jest.fn(),
      endSleep: jest.fn(),
    }),
  },
}));

import { getWidgetPendingActions } from '@/modules/widget-bridge';
import { drainWidgetPendingQueue } from '@/lib/widgetPendingDrain';

describe('drainWidgetPendingQueue', () => {
  it('no-ops when the App Group queue is empty', async () => {
    (getWidgetPendingActions as jest.Mock).mockReturnValue([]);
    await expect(drainWidgetPendingQueue()).resolves.toBe(0);
  });
});
