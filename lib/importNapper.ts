import Papa from 'papaparse';
import type { DiaperEvent, FeedingEvent, SleepEvent, WakeEvent } from '@/types';

export type ColumnMapping = {
  startTime: string;
  endTime: string;
  eventType: string;
  date?: string;
  amount?: string;
  unit?: string;
  side?: string;
  notes?: string;
  pauses?: string;
};

export type MappingField = keyof ColumnMapping;

export type AutoDetectResult = {
  mapping: Partial<ColumnMapping>;
  ambiguous: MappingField[];
  missing: MappingField[];
  isComplete: boolean;
  isUnambiguous: boolean;
};

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

export type ImportEventKind = 'sleep' | 'feeding' | 'diaper' | 'wake';

export type ImportRowOutcome =
  | 'ready'
  | 'ongoing'
  | 'skipped_unrecognized'
  | 'skipped_parse_error'
  | 'skipped_open_old';

export type MappedImportRow = {
  rowIndex: number;
  outcome: ImportRowOutcome;
  eventKind?: ImportEventKind;
  sleepEvent?: Omit<SleepEvent, 'id'>;
  feedingEvent?: Omit<FeedingEvent, 'id'>;
  diaperEvent?: Omit<DiaperEvent, 'id'>;
  wakeEvent?: Omit<WakeEvent, 'id'>;
  sleepPauses?: { startTime: string; endTime: string | null }[];
  rawType?: string;
  preview?: {
    kind: ImportEventKind;
    label: string;
    start: string;
    end: string;
  };
  reason?: string;
};

export type ImportPreview = {
  totalRows: number;
  mapping: ColumnMapping;
  mappingSource: 'auto' | 'manual';
  rows: MappedImportRow[];
  sleepReadyCount: number;
  sleepOngoingCount: number;
  feedingReadyCount: number;
  feedingOngoingCount: number;
  diaperReadyCount: number;
  wakeReadyCount: number;
  skippedUnrecognized: number;
  skippedFailed: number;
  skippedOpenOld: number;
  timezoneNote: string;
};

export const TIMEZONE_NOTE =
  'Times are interpreted in your device\'s local timezone unless the CSV includes an explicit offset.';

export const ONGOING_MAX_AGE_HOURS = 24;

const REQUIRED_FIELDS: MappingField[] = ['startTime', 'endTime', 'eventType'];
export { REQUIRED_FIELDS };

const START_PATTERNS = [/start/i, /begin/i, /from/i, /started/i];
const END_PATTERNS = [/end/i, /stop/i, /finish/i, /\bto\b/i, /ended/i];
const TYPE_PATTERNS = [/type/i, /category/i, /activity/i, /event/i, /kind/i, /label/i];
const DATE_PATTERNS = [/^date$/i, /date/i, /day/i, /when/i];
const AMOUNT_PATTERNS = [/amount/i, /volume/i, /quantity/i, /size/i, /ml/i, /oz/i];
const SIDE_PATTERNS = [/side/i, /breast/i];
const NOTES_PATTERNS = [/note/i, /comment/i, /detail/i];
const PAUSES_PATTERNS = [/^pauses$/i, /pause/i];

const UNRECOGNIZED_PATTERNS = [
  /temp/i,
  /medic/i,
  /vitamin/i,
  /supplement/i,
  /pump/i,
  /growth/i,
  /weight/i,
  /height/i,
  /milestone/i,
];

const FEEDING_PATTERNS = [/feed/i, /bottle/i, /breast/i, /nurs/i, /formula/i, /solid/i, /meal/i];
const BREAST_PATTERNS = [/breast/i, /nurs/i, /latch/i];
const BOTTLE_PATTERNS = [/bottle/i, /formula/i, /expressed/i];
const SOLID_PATTERNS = [/solid/i, /food/i, /puree/i, /meal/i, /weaning/i];

const DIAPER_PATTERNS = [/diaper/i, /nappy/i, /wet/i, /dirty/i, /poo/i, /stool/i, /soiled/i, /mixed/i, /bm/i];
const WET_PATTERNS = [/wet/i, /pee/i, /wee/i, /urin/i];
const DIRTY_PATTERNS = [/dirty/i, /poo/i, /stool/i, /soiled/i, /\bbm\b/i];
const MIXED_PATTERNS = [/mixed/i, /both/i];
const WAKE_PATTERNS = [/woke/i, /wake.?up/i, /waking/i, /night.?waking/i];

const NAP_PATTERNS = [/nap/i, /day.?sleep/i, /daytime/i, /cat.?nap/i];
const NIGHT_PATTERNS = [/night/i, /bed/i, /overnight/i, /evening.?sleep/i];
const EVENT_TYPE_PRIORITY_PATTERNS = [
  /^category$/i,
  /^activity\s*type$/i,
  /^event\s*type$/i,
  /^type$/i,
  /category/i,
  /activity/i,
  /event/i,
];
const EVENT_TYPE_EXCLUDE_PATTERNS = [
  /happiness/i,
  /mood/i,
  /weight/i,
  /content/i,
  /temperature/i,
  /comment/i,
  /created/i,
  /pause/i,
];

type RowClassification =
  | { category: 'sleep'; sleepType: 'nap' | 'night' }
  | { category: 'feeding'; feedType: 'breast' | 'bottle' | 'solid' }
  | { category: 'diaper'; diaperType: 'wet' | 'dirty' | 'mixed' }
  | { category: 'wake' }
  | { category: 'unrecognized' };

function normalizeHeader(header: string): string {
  return header.trim();
}

function scoreHeader(header: string, patterns: RegExp[]): number {
  const h = normalizeHeader(header).toLowerCase();
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(h)) score += 1;
  }
  if (patterns === END_PATTERNS && /start|begin|from/i.test(h)) score -= 2;
  if (patterns === START_PATTERNS && /\bend\b|stop|finish/i.test(h) && !/start/i.test(h)) {
    score -= 2;
  }
  return score;
}

function findBestMatches(headers: string[], patterns: RegExp[]) {
  return headers
    .map((header) => ({ header, score: scoreHeader(header, patterns) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

function pickField(
  headers: string[],
  patterns: RegExp[],
  used: Set<string>,
  required = false
): { header?: string; ambiguous: boolean } {
  const matches = findBestMatches(headers, patterns).filter((m) => !used.has(m.header));
  if (matches.length === 0) return { ambiguous: false };
  if (matches.length === 1 || matches[0].score > matches[1].score) {
    return { header: matches[0].header, ambiguous: false };
  }
  return { ambiguous: required };
}

export function parseCsvText(csvText: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(result.errors[0]?.message ?? 'Failed to parse CSV');
  }

  const headers = result.meta.fields?.map(normalizeHeader) ?? [];
  const rows = result.data.filter((row) =>
    Object.values(row).some((v) => String(v ?? '').trim() !== '')
  );

  return { headers, rows };
}

export function autoDetectColumns(headers: string[]): AutoDetectResult {
  const used = new Set<string>();
  const mapping: Partial<ColumnMapping> = {};
  const ambiguous: MappingField[] = [];
  const missing: MappingField[] = [];

  for (const [field, patterns, req] of [
    ['startTime', START_PATTERNS, true],
    ['endTime', END_PATTERNS, true],
    ['eventType', TYPE_PATTERNS, true],
    ['date', DATE_PATTERNS, false],
    ['amount', AMOUNT_PATTERNS, false],
    ['unit', [/unit/i, /ml/i, /oz/i, /gram/i], false],
    ['side', SIDE_PATTERNS, false],
    ['notes', NOTES_PATTERNS, false],
    ['pauses', PAUSES_PATTERNS, false],
  ] as const) {
    const result = pickField(headers, [...patterns], used, req);
    if (result.ambiguous) {
      if (field === 'eventType') {
        const preferred = headers.find(
          (h) =>
            EVENT_TYPE_PRIORITY_PATTERNS.some((p) => p.test(h)) &&
            !EVENT_TYPE_EXCLUDE_PATTERNS.some((p) => p.test(h))
        );
        if (preferred) {
          mapping[field] = preferred;
          used.add(preferred);
          continue;
        }
      }
      ambiguous.push(field);
    } else if (result.header) {
      mapping[field] = result.header;
      used.add(result.header);
    } else if (req) missing.push(field);
  }

  return {
    mapping,
    ambiguous,
    missing,
    isComplete: REQUIRED_FIELDS.every((f) => mapping[f] != null),
    isUnambiguous: ambiguous.length === 0,
  };
}

export function isCompleteMapping(
  mapping: Partial<ColumnMapping>
): mapping is ColumnMapping {
  return (
    typeof mapping.startTime === 'string' &&
    typeof mapping.endTime === 'string' &&
    typeof mapping.eventType === 'string'
  );
}

export function classifyRow(raw: string): RowClassification {
  const value = raw.trim();
  if (!value) return { category: 'unrecognized' };

  if (UNRECOGNIZED_PATTERNS.some((p) => p.test(value))) {
    return { category: 'unrecognized' };
  }

  if (DIAPER_PATTERNS.some((p) => p.test(value))) {
    if (MIXED_PATTERNS.some((p) => p.test(value))) return { category: 'diaper', diaperType: 'mixed' };
    if (DIRTY_PATTERNS.some((p) => p.test(value))) return { category: 'diaper', diaperType: 'dirty' };
    if (WET_PATTERNS.some((p) => p.test(value))) return { category: 'diaper', diaperType: 'wet' };
    return { category: 'diaper', diaperType: 'mixed' };
  }

  if (FEEDING_PATTERNS.some((p) => p.test(value)) || /^feed(ing)?$/i.test(value)) {
    if (BREAST_PATTERNS.some((p) => p.test(value))) return { category: 'feeding', feedType: 'breast' };
    if (SOLID_PATTERNS.some((p) => p.test(value))) return { category: 'feeding', feedType: 'solid' };
    if (BOTTLE_PATTERNS.some((p) => p.test(value))) return { category: 'feeding', feedType: 'bottle' };
    return { category: 'feeding', feedType: 'bottle' };
  }

  if (WAKE_PATTERNS.some((p) => p.test(value))) return { category: 'wake' };
  if (NAP_PATTERNS.some((p) => p.test(value))) return { category: 'sleep', sleepType: 'nap' };
  if (NIGHT_PATTERNS.some((p) => p.test(value))) return { category: 'sleep', sleepType: 'night' };
  if (/^sleep$/i.test(value)) return { category: 'sleep', sleepType: 'nap' };

  return { category: 'unrecognized' };
}

/** @deprecated use classifyRow */
export function classifyEventType(raw: string): 'nap' | 'night' | 'not_sleep' | null {
  const c = classifyRow(raw);
  if (c.category === 'sleep') return c.sleepType;
  if (c.category === 'unrecognized') return null;
  return 'not_sleep' as never;
}

function parseDateTime(value: string, datePart?: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (datePart?.trim()) {
    const combined = `${datePart.trim()} ${trimmed}`;
    const d = new Date(combined);
    if (!isNaN(d.getTime())) return d;
    const isoCombined = `${datePart.trim()}T${trimmed}`;
    const d2 = new Date(isoCombined);
    if (!isNaN(d2.getTime())) return d2;
  }

  const direct = new Date(trimmed);
  if (!isNaN(direct.getTime())) return direct;

  const slashMatch = trimmed.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (slashMatch) {
    const [, a, b, y, h, m, s] = slashMatch;
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
    for (const [day, month] of [
      [parseInt(a, 10), parseInt(b, 10)],
      [parseInt(b, 10), parseInt(a, 10)],
    ]) {
      const d = new Date(year, month - 1, day, parseInt(h, 10), parseInt(m, 10), parseInt(s ?? '0', 10));
      if (!isNaN(d.getTime()) && d.getFullYear() === year) return d;
    }
  }

  const timeOnly = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnly && datePart?.trim()) {
    const [, h, m, s] = timeOnly;
    const base = new Date(datePart.trim());
    if (!isNaN(base.getTime())) {
      base.setHours(parseInt(h, 10), parseInt(m, 10), parseInt(s ?? '0', 10), 0);
      return base;
    }
  }

  return null;
}

function formatPreviewTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function inferWakeType(rawType: string): WakeEvent['wakeType'] {
  if (/night.?waking/i.test(rawType)) return 'night';
  return 'morning';
}

export function parseNapperPauses(
  raw: string | undefined
): { startTime: string; endTime: string | null }[] {
  if (!raw?.trim() || raw.trim() === '[object Object]') return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const result: { startTime: string; endTime: string | null }[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const startRaw = item.start ?? item.startTime ?? item.from;
      const endRaw = item.end ?? item.endTime ?? item.to ?? null;
      if (!startRaw) continue;
      const startDate = new Date(startRaw);
      if (isNaN(startDate.getTime())) continue;
      let endTime: string | null = null;
      if (endRaw) {
        const endDate = new Date(endRaw);
        if (!isNaN(endDate.getTime())) endTime = endDate.toISOString();
      }
      result.push({ startTime: startDate.toISOString(), endTime });
    }
    return result;
  } catch {
    return [];
  }
}

function parseSide(raw?: string): FeedingEvent['side'] {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (/both|dual/.test(v)) return 'both';
  if (/left|l\b/.test(v)) return 'left';
  if (/right|r\b/.test(v)) return 'right';
  return null;
}

function parseAmount(row: Record<string, string>, mapping: ColumnMapping): {
  amount: number | null;
  unit: FeedingEvent['unit'];
} {
  const raw = mapping.amount ? row[mapping.amount]?.trim() : '';
  const unitRaw = mapping.unit ? row[mapping.unit]?.trim().toLowerCase() : '';
  const parsed = raw ? parseFloat(raw.replace(/[^\d.]/g, '')) : NaN;
  const amount = Number.isFinite(parsed) ? parsed : null;
  let unit: FeedingEvent['unit'] = null;
  if (/oz|ounce/.test(unitRaw)) unit = 'oz';
  else if (/ml|milliliter/.test(unitRaw)) unit = 'ml';
  else if (/g|gram/.test(unitRaw)) unit = 'g';
  else if (raw && /oz/i.test(raw)) unit = 'oz';
  else if (raw && /ml/i.test(raw)) unit = 'ml';
  else if (raw && /g/i.test(raw)) unit = 'g';
  return { amount, unit };
}

function resolveEndTime(
  startDate: Date,
  endRaw: string,
  datePart: string | undefined,
  now: Date,
  allowOngoing: boolean
): { endTime: string | null; outcome: 'ready' | 'ongoing' | 'skipped_open_old' | 'skipped_parse_error'; reason?: string } {
  if (!endRaw) {
    if (!allowOngoing) {
      return { endTime: startDate.toISOString(), outcome: 'ready' };
    }
    const ageHours = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    if (ageHours >= 0 && ageHours <= ONGOING_MAX_AGE_HOURS) {
      return { endTime: null, outcome: 'ongoing' };
    }
    return {
      endTime: null,
      outcome: 'skipped_open_old',
      reason: `No end time and session started ${Math.round(ageHours)}h ago`,
    };
  }

  let endDate = parseDateTime(endRaw, datePart);
  if (!endDate) {
    return { endTime: null, outcome: 'skipped_parse_error', reason: `Could not parse end time: "${endRaw}"` };
  }
  if (endDate.getTime() <= startDate.getTime()) {
    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    if (nextDay.getTime() > startDate.getTime()) endDate = nextDay;
    else {
      return { endTime: null, outcome: 'skipped_parse_error', reason: 'End time is before start time' };
    }
  }
  return { endTime: endDate.toISOString(), outcome: 'ready' };
}

export function mapImportRow(
  row: Record<string, string>,
  rowIndex: number,
  mapping: ColumnMapping,
  babyId: string,
  now: Date = new Date()
): MappedImportRow {
  const rawType = row[mapping.eventType]?.trim() ?? '';
  const classification = classifyRow(rawType);

  if (classification.category === 'unrecognized') {
    return {
      rowIndex,
      outcome: 'skipped_unrecognized',
      rawType,
      reason: `Unrecognized event type: "${rawType || 'empty'}"`,
    };
  }

  const datePart = mapping.date ? row[mapping.date] : undefined;
  let startRaw = row[mapping.startTime]?.trim() ?? '';
  const endRaw = row[mapping.endTime]?.trim() ?? '';

  if (classification.category === 'diaper' && !startRaw && datePart) {
    startRaw = datePart;
  }

  const startDate = parseDateTime(startRaw, datePart);

  if (!startDate) {
    return {
      rowIndex,
      outcome: 'skipped_parse_error',
      rawType,
      reason: `Could not parse start time: "${startRaw}"`,
    };
  }

  if (classification.category === 'diaper') {
    const diaperEvent: Omit<DiaperEvent, 'id'> = {
      babyId,
      diaperType: classification.diaperType,
      time: startDate.toISOString(),
      notes: mapping.notes ? row[mapping.notes]?.trim() || null : null,
    };
    return {
      rowIndex,
      outcome: 'ready',
      eventKind: 'diaper',
      diaperEvent,
      rawType,
      preview: {
        kind: 'diaper',
        label: classification.diaperType,
        start: formatPreviewTime(diaperEvent.time),
        end: '—',
      },
    };
  }

  if (classification.category === 'wake') {
    const endResult = resolveEndTime(startDate, endRaw, datePart, now, false);
    if (endResult.outcome === 'skipped_parse_error') {
      return {
        rowIndex,
        outcome: endResult.outcome,
        rawType,
        reason: endResult.reason,
      };
    }
    const wakeEvent: Omit<WakeEvent, 'id'> = {
      babyId,
      time: startDate.toISOString(),
      endTime: endResult.endTime,
      wakeType: inferWakeType(rawType),
      notes: mapping.notes ? row[mapping.notes]?.trim() || null : null,
    };
    return {
      rowIndex,
      outcome: 'ready',
      eventKind: 'wake',
      wakeEvent,
      rawType,
      preview: {
        kind: 'wake',
        label: wakeEvent.wakeType === 'night' ? 'night waking' : 'start day',
        start: formatPreviewTime(wakeEvent.time),
        end: wakeEvent.endTime ? formatPreviewTime(wakeEvent.endTime) : '—',
      },
    };
  }

  if (classification.category === 'feeding') {
    const { amount, unit } = parseAmount(row, mapping);
    const side = parseSide(mapping.side ? row[mapping.side] : undefined);
    const endResult = resolveEndTime(
      startDate,
      endRaw,
      datePart,
      now,
      classification.feedType === 'breast'
    );

    if (endResult.outcome === 'skipped_open_old' || endResult.outcome === 'skipped_parse_error') {
      return {
        rowIndex,
        outcome: endResult.outcome,
        rawType,
        reason: endResult.reason,
      };
    }

    const endIso =
      endResult.endTime ??
      (classification.feedType === 'bottle' || classification.feedType === 'solid'
        ? startDate.toISOString()
        : null);

    const feedingEvent: Omit<FeedingEvent, 'id'> = {
      babyId,
      feedType: classification.feedType,
      startTime: startDate.toISOString(),
      endTime: endIso,
      side: classification.feedType === 'breast' ? side : null,
      amount,
      unit: classification.feedType === 'solid' ? unit ?? 'g' : unit,
      notes: mapping.notes ? row[mapping.notes]?.trim() || null : null,
    };

    return {
      rowIndex,
      outcome: endResult.outcome,
      eventKind: 'feeding',
      feedingEvent,
      rawType,
      preview: {
        kind: 'feeding',
        label: classification.feedType,
        start: formatPreviewTime(feedingEvent.startTime),
        end: feedingEvent.endTime ? formatPreviewTime(feedingEvent.endTime) : '(ongoing)',
      },
    };
  }

  const endResult = resolveEndTime(startDate, endRaw, datePart, now, true);
  if (endResult.outcome === 'skipped_open_old' || endResult.outcome === 'skipped_parse_error') {
    return { rowIndex, outcome: endResult.outcome, rawType, reason: endResult.reason };
  }

  const sleepEvent: Omit<SleepEvent, 'id'> = {
    babyId,
    type: classification.sleepType,
    startTime: startDate.toISOString(),
    endTime: endResult.endTime,
  };

  const pauseRaw = mapping.pauses ? row[mapping.pauses] : undefined;
  const parsedPauses = parseNapperPauses(pauseRaw);

  return {
    rowIndex,
    outcome: endResult.outcome,
    eventKind: 'sleep',
    sleepEvent,
    sleepPauses: parsedPauses.length > 0 ? parsedPauses : undefined,
    rawType,
    preview: {
      kind: 'sleep',
      label: classification.sleepType,
      start: formatPreviewTime(sleepEvent.startTime),
      end: sleepEvent.endTime ? formatPreviewTime(sleepEvent.endTime) : '(ongoing)',
    },
  };
}

/** @deprecated use mapImportRow */
export function mapRowToSleepEvent(
  row: Record<string, string>,
  rowIndex: number,
  mapping: ColumnMapping,
  babyId: string,
  now?: Date
): MappedImportRow {
  return mapImportRow(row, rowIndex, mapping, babyId, now);
}

function summarizePreview(rows: MappedImportRow[]): Omit<
  ImportPreview,
  'totalRows' | 'mapping' | 'mappingSource' | 'rows' | 'timezoneNote'
> {
  return {
    sleepReadyCount: rows.filter((r) => r.eventKind === 'sleep' && r.outcome === 'ready').length,
    sleepOngoingCount: rows.filter((r) => r.eventKind === 'sleep' && r.outcome === 'ongoing').length,
    feedingReadyCount: rows.filter((r) => r.eventKind === 'feeding' && r.outcome === 'ready').length,
    feedingOngoingCount: rows.filter((r) => r.eventKind === 'feeding' && r.outcome === 'ongoing').length,
    diaperReadyCount: rows.filter((r) => r.eventKind === 'diaper' && r.outcome === 'ready').length,
    wakeReadyCount: rows.filter((r) => r.eventKind === 'wake' && r.outcome === 'ready').length,
    skippedUnrecognized: rows.filter((r) => r.outcome === 'skipped_unrecognized').length,
    skippedFailed: rows.filter((r) => r.outcome === 'skipped_parse_error').length,
    skippedOpenOld: rows.filter((r) => r.outcome === 'skipped_open_old').length,
  };
}

export function buildImportPreview(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  babyId: string,
  mappingSource: 'auto' | 'manual',
  now: Date = new Date()
): ImportPreview {
  const rows = parsed.rows.map((row, i) => mapImportRow(row, i + 1, mapping, babyId, now));
  const summary = summarizePreview(rows);

  return {
    totalRows: parsed.rows.length,
    mapping,
    mappingSource,
    rows,
    ...summary,
    timezoneNote: TIMEZONE_NOTE,
  };
}

export function prepareImportFromCsv(
  csvText: string,
  babyId: string,
  manualMapping?: ColumnMapping,
  now: Date = new Date()
) {
  const parsed = parseCsvText(csvText);
  const autoDetect = autoDetectColumns(parsed.headers);

  if (manualMapping) {
    return {
      parsed,
      autoDetect,
      preview: buildImportPreview(parsed, manualMapping, babyId, 'manual', now),
      needsManualMapping: false,
    };
  }

  if (autoDetect.isComplete && autoDetect.isUnambiguous) {
    return {
      parsed,
      autoDetect,
      preview: buildImportPreview(
        parsed,
        autoDetect.mapping as ColumnMapping,
        babyId,
        'auto',
        now
      ),
      needsManualMapping: false,
    };
  }

  return { parsed, autoDetect, needsManualMapping: true };
}

export function getImportableEvents(preview: ImportPreview): {
  sleep: Omit<SleepEvent, 'id'>[];
  feedings: Omit<FeedingEvent, 'id'>[];
  diapers: Omit<DiaperEvent, 'id'>[];
  wakes: Omit<WakeEvent, 'id'>[];
  sleepPauses: {
    sleepStartTime: string;
    pauses: { startTime: string; endTime: string | null }[];
  }[];
} {
  const sleep: Omit<SleepEvent, 'id'>[] = [];
  const feedings: Omit<FeedingEvent, 'id'>[] = [];
  const diapers: Omit<DiaperEvent, 'id'>[] = [];
  const wakes: Omit<WakeEvent, 'id'>[] = [];
  const sleepPauses: {
    sleepStartTime: string;
    pauses: { startTime: string; endTime: string | null }[];
  }[] = [];

  for (const row of preview.rows) {
    if (row.outcome !== 'ready' && row.outcome !== 'ongoing') continue;
    if (row.sleepEvent) {
      sleep.push(row.sleepEvent);
      if (row.sleepPauses?.length) {
        sleepPauses.push({
          sleepStartTime: row.sleepEvent.startTime,
          pauses: row.sleepPauses,
        });
      }
    }
    if (row.feedingEvent) feedings.push(row.feedingEvent);
    if (row.diaperEvent) diapers.push(row.diaperEvent);
    if (row.wakeEvent) wakes.push(row.wakeEvent);
  }

  return { sleep, feedings, diapers, wakes, sleepPauses };
}

export const MAPPING_FIELD_LABELS: Record<MappingField, string> = {
  startTime: 'Start time',
  endTime: 'End time / time',
  eventType: 'Event type',
  date: 'Date (optional)',
  amount: 'Amount (optional)',
  unit: 'Unit (optional)',
  side: 'Side (optional)',
  notes: 'Notes (optional)',
  pauses: 'Pauses (optional)',
};
