import {
  parseSleepLiveActivityAction,
  sleepActionUrl,
} from '@/lib/sleepLiveActivityProps';
import { buildSleepLiveActivityProps } from '@/lib/sleepLiveActivityProps';
import type { SleepEvent, SleepPause } from '@/types';

describe('parseSleepLiveActivityAction', () => {
  it('parses query sleepAction links', () => {
    expect(parseSleepLiveActivityAction(sleepActionUrl('end'))).toBe('end');
    expect(parseSleepLiveActivityAction(sleepActionUrl('pause'))).toBe('pause');
    expect(parseSleepLiveActivityAction(sleepActionUrl('resume'))).toBe('resume');
    expect(parseSleepLiveActivityAction(sleepActionUrl('start-nap'))).toBe('start-nap');
    expect(parseSleepLiveActivityAction(sleepActionUrl('start-bedtime'))).toBe(
      'start-bedtime'
    );
    expect(parseSleepLiveActivityAction(sleepActionUrl('active'))).toBe('active');
  });

  it('still parses legacy path links', () => {
    expect(parseSleepLiveActivityAction('relaxo://sleep/end')).toBe('end');
    expect(parseSleepLiveActivityAction('relaxo://sleep/start-nap')).toBe('start-nap');
    expect(parseSleepLiveActivityAction('relaxo://sleep')).toBe('active');
  });

  it('returns null for unrelated urls', () => {
    expect(parseSleepLiveActivityAction('relaxo://settings')).toBeNull();
    expect(parseSleepLiveActivityAction('https://example.com')).toBeNull();
  });
});

describe('buildSleepLiveActivityProps', () => {
  const ongoing: SleepEvent = {
    id: 's1',
    babyId: 'b1',
    type: 'nap',
    startTime: '2026-08-02T10:00:00.000Z',
    endTime: null,
    extension: null,
  };

  it('builds running nap props with button targets', () => {
    const props = buildSleepLiveActivityProps({
      ongoing,
      pauses: [],
      locale: 'en',
    });
    expect(props.title).toBe('Nap');
    expect(props.paused).toBe(false);
    expect(props.endTarget).toBe('end');
    expect(props.secondaryTarget).toBe('pause');
    expect(props.timerLowerMs).toBe(new Date(ongoing.startTime).getTime());
  });

  it('builds paused props from open pause', () => {
    const pauses: SleepPause[] = [
      {
        id: 'p1',
        sleepEventId: 's1',
        startTime: '2026-08-02T10:15:00.000Z',
        endTime: null,
      },
    ];
    const props = buildSleepLiveActivityProps({
      ongoing,
      pauses,
      locale: 'en',
    });
    expect(props.title).toBe('Baby awake');
    expect(props.paused).toBe(true);
    expect(props.secondaryTarget).toBe('resume');
    expect(props.timerLowerMs).toBe(new Date(pauses[0].startTime).getTime());
  });
});
