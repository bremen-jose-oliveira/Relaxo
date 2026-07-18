import Papa from 'papaparse';
import type {
  Baby,
  BathEvent,
  DiaperEvent,
  FeedingEvent,
  SleepEvent,
  SleepPause,
  WakeEvent,
} from '@/types';
import { formatDateKey } from '@/lib/dateUtils';

export const EXPORT_HEADERS = [
  'Baby Name',
  'Birth Date',
  'Date',
  'Activity Type',
  'Start Time',
  'End Time',
  'Notes',
  'Pauses',
] as const;

export type ExportCareInput = {
  baby: Baby;
  events: SleepEvent[];
  sleepPauses: SleepPause[];
  feedings: FeedingEvent[];
  diapers: DiaperEvent[];
  baths: BathEvent[];
  wakes: WakeEvent[];
};

export type ExportSummary = {
  sleep: number;
  feedings: number;
  diapers: number;
  baths: number;
  wakes: number;
  total: number;
};

type ExportRow = Record<(typeof EXPORT_HEADERS)[number], string>;

function formatExportDateTime(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

function formatPausesColumn(sleepEventId: string, pauses: SleepPause[]): string {
  const forSleep = pauses
    .filter((p) => p.sleepEventId === sleepEventId && p.endTime)
    .map((p) => ({ start: p.startTime, end: p.endTime }));
  return forSleep.length > 0 ? JSON.stringify(forSleep) : '';
}

function sleepActivityType(type: SleepEvent['type']): string {
  return type === 'night' ? 'Night Sleep' : 'Nap';
}

function feedingActivityType(feedType: FeedingEvent['feedType']): string {
  if (feedType === 'breast') return 'breastfeed';
  if (feedType === 'solid') return 'solid';
  return 'bottle';
}

function feedingNotes(event: FeedingEvent): string {
  const parts: string[] = [];
  if (event.feedType === 'breast' && event.side) {
    parts.push(`${event.side} side`);
  }
  if (event.amount != null && event.unit) {
    parts.push(`${event.amount} ${event.unit}`);
  }
  if (event.notes?.trim()) parts.push(event.notes.trim());
  return parts.join(' · ');
}

function diaperActivityType(type: DiaperEvent['diaperType']): string {
  if (type === 'wet') return 'Wet diaper';
  if (type === 'dirty') return 'Dirty diaper';
  return 'Mixed diaper';
}

function wakeActivityType(type: WakeEvent['wakeType']): string {
  return type === 'night' ? 'NIGHT_WAKING' : 'WOKE_UP';
}

function row(
  baby: Baby,
  startIso: string,
  activityType: string,
  endIso: string | null,
  notes = '',
  pauses = ''
): ExportRow {
  const start = new Date(startIso);
  return {
    'Baby Name': baby.name,
    'Birth Date': baby.birthDate,
    Date: formatDateKey(start),
    'Activity Type': activityType,
    'Start Time': formatExportDateTime(startIso),
    'End Time': endIso ? formatExportDateTime(endIso) : '',
    Notes: notes,
    Pauses: pauses,
  };
}

/** Build export rows sorted oldest → newest (Napper-compatible activity columns + baby profile). */
export function buildExportRows(input: ExportCareInput): ExportRow[] {
  const rows: { sortTime: string; data: ExportRow }[] = [];
  const { baby } = input;

  for (const event of input.events) {
    rows.push({
      sortTime: event.startTime,
      data: row(
        baby,
        event.startTime,
        sleepActivityType(event.type),
        event.endTime,
        '',
        formatPausesColumn(event.id, input.sleepPauses)
      ),
    });
  }

  for (const event of input.feedings) {
    rows.push({
      sortTime: event.startTime,
      data: row(
        baby,
        event.startTime,
        feedingActivityType(event.feedType),
        event.endTime ?? event.startTime,
        feedingNotes(event)
      ),
    });
  }

  for (const event of input.diapers) {
    rows.push({
      sortTime: event.time,
      data: row(baby, event.time, diaperActivityType(event.diaperType), '', event.notes ?? ''),
    });
  }

  for (const event of input.baths) {
    rows.push({
      sortTime: event.time,
      data: row(baby, event.time, 'Bath', '', event.notes ?? ''),
    });
  }

  for (const event of input.wakes) {
    rows.push({
      sortTime: event.time,
      data: row(
        baby,
        event.time,
        wakeActivityType(event.wakeType),
        event.endTime,
        event.notes ?? ''
      ),
    });
  }

  return rows.sort((a, b) => a.sortTime.localeCompare(b.sortTime)).map((r) => r.data);
}

export function getExportSummary(input: ExportCareInput): ExportSummary {
  return {
    sleep: input.events.length,
    feedings: input.feedings.length,
    diapers: input.diapers.length,
    baths: input.baths.length,
    wakes: input.wakes.length,
    total:
      input.events.length +
      input.feedings.length +
      input.diapers.length +
      input.baths.length +
      input.wakes.length,
  };
}

/** CSV text compatible with Relaxo / Napper import. */
export function exportCareDataToCsv(input: ExportCareInput): string {
  const rows = buildExportRows(input);
  return Papa.unparse({
    fields: [...EXPORT_HEADERS],
    data: rows.map((r) => EXPORT_HEADERS.map((h) => r[h])),
  });
}

export function buildExportFilename(babyName: string, now = new Date()): string {
  const slug = babyName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `relaxo-${slug || 'export'}-${formatDateKey(now)}.csv`;
}
