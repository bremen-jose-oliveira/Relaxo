import {
  clampSleepMinutes,
  computeNiceMax,
  computeSleepMaxHours,
  computeSleepMaxMinutes,
  sleepMinutesToChartValue,
} from '../chartScale';

describe('chartScale', () => {
  it('computeNiceMax rounds up with headroom', () => {
    expect(computeNiceMax(3)).toBe(4);
    expect(computeNiceMax(7)).toBe(10);
    expect(computeNiceMax(11)).toBe(16);
  });

  it('computeSleepMaxHours caps at 24', () => {
    expect(computeSleepMaxHours(5)).toBe(6);
    expect(computeSleepMaxHours(22)).toBe(24);
    expect(computeSleepMaxHours(30)).toBe(24);
  });

  it('computeSleepMaxMinutes caps at 1440', () => {
    expect(computeSleepMaxMinutes(300)).toBe(360);
    expect(computeSleepMaxMinutes(1500)).toBe(1440);
  });

  it('clampSleepMinutes limits to 0–1440', () => {
    expect(clampSleepMinutes(-5)).toBe(0);
    expect(clampSleepMinutes(2000)).toBe(1440);
  });

  it('sleepMinutesToChartValue converts units', () => {
    expect(sleepMinutesToChartValue(90, 'hours')).toBe(1.5);
    expect(sleepMinutesToChartValue(90, 'minutes')).toBe(90);
    expect(sleepMinutesToChartValue(2000, 'hours')).toBe(24);
  });
});
