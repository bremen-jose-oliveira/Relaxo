import {
  autoDetectColumns,
  buildImportPreview,
  classifyRow,
  parseCsvText,
  prepareImportFromCsv,
  getImportableEvents,
  parseNapperPauses,
  mapImportRow,
} from '@/lib/importNapper';

const BABY_ID = 'baby-test';
const NOW = new Date('2025-06-20T14:00:00');

const CSV_CONVENTIONAL = `Date,Activity Type,Start Time,End Time,Notes
2025-06-01,Nap,09:15,10:30,
2025-06-01,Feeding,12:00,12:25,bottle
2025-06-01,Night Sleep,19:30,06:45,
2025-06-02,Wet diaper,2025-06-02 10:00,,
2025-06-02,Nap,2025-06-02 13:00,2025-06-02 14:15,
`;

const CSV_ABBREVIATED = `day,category,begin,stop
01/06/2025,daytime nap,08:00,09:30
01/06/2025,breastfeed,11:00,11:20
01/06/2025,bedtime,20:00,07:00
`;

const CSV_AMBIGUOUS = `Time A,Time B,Event,Extra
2025-06-01 09:00,2025-06-01 10:00,Nap,
2025-06-01 12:00,2025-06-01 12:30,Feed,
`;

const CSV_DUPLICATE_HEADERS = `Start,Start Time,End Time,Category
2025-06-01 09:00,2025-06-01 09:05,2025-06-01 10:00,Nap
`;

describe('importNapper', () => {
  describe('parseCsvText', () => {
    it('parses headers and rows', () => {
      const parsed = parseCsvText(CSV_CONVENTIONAL);
      expect(parsed.rows).toHaveLength(5);
    });
  });

  describe('autoDetectColumns', () => {
    it('detects conventional headers', () => {
      const parsed = parseCsvText(CSV_CONVENTIONAL);
      const result = autoDetectColumns(parsed.headers);
      expect(result.isComplete).toBe(true);
      expect(result.isUnambiguous).toBe(true);
    });

    it('flags incomplete mapping when time columns are unrecognized', () => {
      const parsed = parseCsvText(CSV_AMBIGUOUS);
      const result = autoDetectColumns(parsed.headers);
      expect(result.isComplete).toBe(false);
    });
  });

  describe('classifyRow', () => {
    it('classifies sleep, feeding, and diaper rows', () => {
      expect(classifyRow('Nap').category).toBe('sleep');
      expect(classifyRow('Feeding').category).toBe('feeding');
      expect(classifyRow('Wet diaper').category).toBe('diaper');
      expect(classifyRow('Temperature').category).toBe('unrecognized');
    });
  });

  describe('prepareImportFromCsv', () => {
    it('maps mixed event types from conventional CSV', () => {
      const result = prepareImportFromCsv(CSV_CONVENTIONAL, BABY_ID, undefined, NOW);
      expect(result.preview!.sleepReadyCount).toBe(3);
      expect(result.preview!.feedingReadyCount).toBe(1);
      expect(result.preview!.diaperReadyCount).toBe(1);
    });

    it('accepts manual mapping override', () => {
      const manual = {
        startTime: 'Time A',
        endTime: 'Time B',
        eventType: 'Event',
      };
      const result = prepareImportFromCsv(CSV_AMBIGUOUS, BABY_ID, manual, NOW);
      expect(result.preview!.sleepReadyCount).toBe(1);
      expect(result.preview!.feedingReadyCount).toBe(1);
    });
  });

  describe('buildImportPreview edge cases', () => {
    it('treats recent open sleep as ongoing', () => {
      const csv = `Date,Type,Start,End
2025-06-20,Nap,2025-06-20 13:00,,
`;
      const parsed = parseCsvText(csv);
      const mapping = { startTime: 'Start', endTime: 'End', eventType: 'Type', date: 'Date' };
      const preview = buildImportPreview(parsed, mapping, BABY_ID, 'manual', NOW);
      expect(preview.sleepOngoingCount).toBe(1);
    });
  });

  describe('getImportableEvents', () => {
    it('returns events grouped by type', () => {
      const result = prepareImportFromCsv(CSV_CONVENTIONAL, BABY_ID, undefined, NOW);
      const { sleep, feedings, diapers } = getImportableEvents(result.preview!);
      expect(sleep.length).toBeGreaterThan(0);
      expect(feedings.length).toBe(1);
      expect(diapers.length).toBe(1);
    });
  });

  describe('wake types and pauses', () => {
    it('classifies WOKE_UP vs NIGHT_WAKING', () => {
      const mapping = {
        startTime: 'start',
        endTime: 'end',
        eventType: 'category',
      };
      const woke = mapImportRow(
        { start: '2025-06-20T07:00:00', end: '2025-06-20T07:00:00', category: 'WOKE_UP' },
        1,
        mapping,
        BABY_ID,
        NOW
      );
      const night = mapImportRow(
        {
          start: '2025-06-20T02:00:00',
          end: '2025-06-20T02:15:00',
          category: 'NIGHT_WAKING',
        },
        2,
        mapping,
        BABY_ID,
        NOW
      );
      expect(woke.wakeEvent?.wakeType).toBe('morning');
      expect(night.wakeEvent?.wakeType).toBe('night');
    });

    it('parses Napper pause JSON when present', () => {
      const pauses = parseNapperPauses(
        JSON.stringify([
          { start: '2025-06-20T22:00:00.000Z', end: '2025-06-20T22:10:00.000Z' },
        ])
      );
      expect(pauses).toHaveLength(1);
      expect(pauses[0].endTime).not.toBeNull();
      expect(parseNapperPauses('[object Object]')).toEqual([]);
    });
  });
});
