import { buildSleepHomeWidgetProps } from '@/lib/sleepHomeWidget';
import { optimisticSleepHomeWidgetProps } from '@/lib/sleepWidgetOptimistic';
import type { Baby, SleepEvent, WakeEvent } from '@/types';
import type { PredictResult } from '@/lib/predictNextSleep';

const baby: Baby = {
  id: 'b1',
  name: 'Leo',
  birthDate: '2025-10-01',
  napGoal: null,
  trackFeedingDuration: false,
  easilyOverstimulated: false,
  highNeed: false,
};

describe('buildSleepHomeWidgetProps', () => {
  it('shows start actions when awake', () => {
    const props = buildSleepHomeWidgetProps({
      ongoing: null,
      pauses: [],
      locale: 'en',
      babyName: 'Leo',
    });
    expect(props.title).toBe('Leo');
    expect(props.babyName).toBe('Leo');
    expect(props.asleep).toBe(false);
    expect(props.statusTone).toBe('awake');
    expect(props.primaryTarget).toBe('start-nap');
    expect(props.secondaryTarget).toBe('start-bedtime');
    expect(props.pendingAction).toBe('');
  });

  it('includes awake timer, prediction, and readiness when data is available', () => {
    const now = new Date('2026-08-07T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    const events: SleepEvent[] = [
      {
        id: 's0',
        babyId: 'b1',
        type: 'nap',
        startTime: '2026-08-07T07:00:00.000Z',
        endTime: '2026-08-07T08:00:00.000Z',
        extension: null,
      },
    ];
    const wakes: WakeEvent[] = [];
    const prediction: PredictResult = {
      predictedTime: new Date('2026-08-07T11:30:00.000Z'),
      confidence: 'medium',
      slot: 1,
      slotLabel: 'Nap 2',
      personalWeight: 0.5,
      resolvedNapGoal: 3,
      napGoalSource: 'age',
    };

    const props = buildSleepHomeWidgetProps({
      ongoing: null,
      pauses: [],
      events,
      wakes,
      prediction,
      baby,
      locale: 'en',
      babyName: 'Leo',
    });

    expect(props.showTimer).toBe(true);
    expect(props.timerLowerMs).toBe(new Date('2026-08-07T08:00:00.000Z').getTime());
    expect(props.showPrediction).toBe(true);
    expect(props.predictionLabel).toContain('Nap 2');
    expect(props.predictionTime.length).toBeGreaterThan(0);
    expect(props.showReadiness).toBe(true);
    expect(['Rested', 'Prepare', 'Ready']).toContain(props.readinessLabel);

    jest.useRealTimers();
  });

  it('shows end/pause when asleep', () => {
    const ongoing: SleepEvent = {
      id: 's1',
      babyId: 'b1',
      type: 'nap',
      startTime: '2026-08-02T10:00:00.000Z',
      endTime: null,
      extension: null,
    };
    const props = buildSleepHomeWidgetProps({
      ongoing,
      pauses: [],
      locale: 'en',
      babyName: 'Leo',
    });
    expect(props.title).toBe('Nap');
    expect(props.asleep).toBe(true);
    expect(props.statusTone).toBe('asleep');
    expect(props.showTimer).toBe(true);
    expect(props.showPrediction).toBe(false);
    expect(props.primaryTarget).toBe('end');
    expect(props.secondaryTarget).toBe('pause');
  });

  it('optimistically flips to asleep on start-nap', () => {
    const props = buildSleepHomeWidgetProps({
      ongoing: null,
      pauses: [],
      locale: 'en',
      babyName: 'Leo',
    });
    const next = optimisticSleepHomeWidgetProps(props, 'start-nap');
    expect(next.asleep).toBe(true);
    expect(next.primaryTarget).toBe('end');
    expect(next.pendingAction).toBe('start-nap');
    expect(next.pendingActionAt).toBeGreaterThan(0);
  });

  it('marks pending sync and flashes sync label without changing sleep state', () => {
    const props = buildSleepHomeWidgetProps({
      ongoing: null,
      pauses: [],
      locale: 'en',
      babyName: 'Leo',
    });
    const next = optimisticSleepHomeWidgetProps(props, 'sync');
    expect(next.pendingAction).toBe('sync');
    expect(next.asleep).toBeUndefined();
    expect(next.subtitle).toBe(props.labelSync);
    expect(props.labelSync).toBe('Sync');
  });
});
