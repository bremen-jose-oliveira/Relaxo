import {
  buildExportFilename,
  buildExportRows,
  exportCareDataToCsv,
  getExportSummary,
} from '../exportCareData';
import { autoDetectColumns, parseCsvText } from '../importNapper';
import type {
  Baby,
  DiaperEvent,
  FeedingEvent,
  SleepEvent,
  SleepPause,
  WakeEvent,
} from '@/types';

const baby: Baby = {
  id: 'b1',
  name: 'Test Baby',
  birthDate: '2025-03-01',
  napGoal: null,
};

describe('exportCareData', () => {
  const input = {
    baby,
    events: [
      {
        id: 's1',
        babyId: 'b1',
        type: 'nap' as const,
        startTime: '2025-06-01T09:15:00',
        endTime: '2025-06-01T10:30:00',
      },
      {
        id: 's2',
        babyId: 'b1',
        type: 'night' as const,
        startTime: '2025-06-01T19:30:00',
        endTime: '2025-06-02T06:45:00',
      },
    ],
    sleepPauses: [
      {
        id: 'p1',
        sleepEventId: 's2',
        startTime: '2025-06-01T22:00:00',
        endTime: '2025-06-01T22:10:00',
      },
    ],
    feedings: [
      {
        id: 'f1',
        babyId: 'b1',
        feedType: 'bottle' as const,
        startTime: '2025-06-01T12:00:00',
        endTime: '2025-06-01T12:25:00',
        side: null,
        amount: 120,
        unit: 'ml' as const,
        notes: null,
      },
    ],
    diapers: [
      {
        id: 'd1',
        babyId: 'b1',
        diaperType: 'wet' as const,
        time: '2025-06-02T10:00:00',
        notes: null,
      },
    ],
    wakes: [
      {
        id: 'w1',
        babyId: 'b1',
        time: '2025-06-02T07:00:00',
        endTime: null,
        wakeType: 'morning' as const,
        notes: null,
      },
    ],
  };

  it('builds Napper-style rows for all event types', () => {
    const rows = buildExportRows(input);
    expect(rows).toHaveLength(5);
    expect(rows[0]['Activity Type']).toBe('Nap');
    expect(rows.find((r) => r['Activity Type'] === 'WOKE_UP')).toBeTruthy();
    expect(rows.find((r) => r['Activity Type'] === 'Night Sleep')?.Pauses).toContain('start');
  });

  it('exports CSV that import can auto-detect', () => {
    const csv = exportCareDataToCsv(input);
    const parsed = parseCsvText(csv);
    const detect = autoDetectColumns(parsed.headers);
    expect(detect.isComplete).toBe(true);
    expect(parsed.rows.length).toBe(5);
  });

  it('summarizes export counts', () => {
    expect(getExportSummary(input)).toEqual({
      sleep: 2,
      feedings: 1,
      diapers: 1,
      wakes: 1,
      total: 5,
    });
  });

  it('builds a safe filename', () => {
    expect(buildExportFilename('Test Baby')).toMatch(/^relaxo-test-baby-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
