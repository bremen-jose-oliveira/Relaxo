import { buildSleepHomeWidgetProps } from '@/lib/sleepHomeWidget';
import { buildWatchSleepSnapshot } from '@/lib/watchSnapshot';

describe('buildWatchSleepSnapshot', () => {
  it('mirrors awake widget props for the Watch complication', () => {
    const props = buildSleepHomeWidgetProps({
      ongoing: null,
      pauses: [],
      events: [],
      wakes: [],
      locale: 'en',
      babyName: 'Mila',
    });
    const snap = buildWatchSleepSnapshot(props, 'Mila');
    expect(snap.v).toBe(1);
    expect(snap.asleep).toBe(false);
    expect(snap.babyName).toBe('Mila');
    expect(snap.statusTone).toBe('awake');
    expect(snap.primaryTarget).toBe('start-nap');
    expect(snap.secondaryTarget).toBe('start-bedtime');
  });

  it('mirrors asleep widget props', () => {
    const props = buildSleepHomeWidgetProps({
      ongoing: {
        id: 's1',
        babyId: 'b1',
        type: 'nap',
        startTime: '2026-08-13T10:00:00.000Z',
        endTime: null,
      },
      pauses: [],
      locale: 'en',
      babyName: 'Mila',
    });
    const snap = buildWatchSleepSnapshot(props, 'Mila');
    expect(snap.asleep).toBe(true);
    expect(snap.showTimer).toBe(true);
    expect(snap.statusTone).toBe('asleep');
    expect(snap.primaryTarget).toBe('end');
    expect(snap.secondaryTarget).toBe('pause');
  });
});
