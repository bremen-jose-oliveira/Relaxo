import {
  formatChartDateRange,
  formatChartXLabel,
  formatDayGroupHeader,
  pickChartLabelIndices,
} from '@/lib/chartLabels';

describe('chartLabels', () => {
  const now = new Date('2025-06-25T14:00:00');

  it('shows day number for today', () => {
    expect(formatChartXLabel(now, now, 13, 14)).toBe('25');
  });

  it('skips yesterday when it would crowd today', () => {
    const yesterday = new Date('2025-06-24T10:00:00');
    expect(formatChartXLabel(yesterday, now, 12, 14)).toBe('');
  });

  it('hides some intermediate labels on 14-day charts', () => {
    const jun17 = new Date('2025-06-17T10:00:00');
    const jun12 = new Date('2025-06-12T10:00:00');
    expect(formatChartXLabel(jun17, now, 5, 14)).toBe('');
    expect(formatChartXLabel(jun12, now, 0, 14)).toBe('12');
    expect(pickChartLabelIndices(14)).toEqual([0, 3, 7, 10, 13]);
  });

  it('formats date range across months', () => {
    expect(formatChartDateRange('2025-06-12', '2025-06-25')).toMatch(/Jun/);
  });

  it('formats day group header', () => {
    expect(formatDayGroupHeader('2025-06-25', now)).toBe('Today');
    expect(formatDayGroupHeader('2025-06-24', now)).toBe('Yesterday');
  });
});
