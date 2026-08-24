import type {
  SleepEvent,
  SleepOnsetMethod,
  SleepPlace,
  SleepSettleAid,
} from '@/types';

/** Map legacy onsetMethod into settle aid / sleep place when new fields are empty. */
export function deriveSettleFromOnsetMethod(onset: SleepOnsetMethod | null | undefined): {
  settleAid: SleepSettleAid | null;
  sleepPlace: SleepPlace | null;
} {
  if (!onset) return { settleAid: null, sleepPlace: null };
  switch (onset) {
    case 'crib':
      return { settleAid: null, sleepPlace: 'crib' };
    case 'breast':
      return { settleAid: 'breast', sleepPlace: null };
    case 'held':
      return { settleAid: 'held', sleepPlace: null };
    case 'cosleep':
      return { settleAid: null, sleepPlace: 'mom' };
    case 'bottle':
    case 'stroller':
    case 'car':
    case 'swing':
      return { settleAid: 'combination', sleepPlace: null };
    default:
      return { settleAid: null, sleepPlace: null };
  }
}

/** Keep a rough onsetMethod for older clients / sync rows. */
export function deriveOnsetMethodFromSettle(input: {
  settleAid?: SleepSettleAid | null;
  sleepPlace?: SleepPlace | null;
  onsetMethod?: SleepOnsetMethod | null;
}): SleepOnsetMethod | null {
  if (input.sleepPlace === 'crib') return 'crib';
  if (input.settleAid === 'breast') return 'breast';
  if (input.settleAid === 'held') return 'held';
  if (input.settleAid === 'on_mom' || input.settleAid === 'on_dad') return 'cosleep';
  if (input.sleepPlace === 'mom' || input.sleepPlace === 'dad') return 'cosleep';
  if (input.settleAid === 'combination' || input.settleAid === 'visual_shield') {
    return input.onsetMethod ?? 'held';
  }
  return input.onsetMethod ?? null;
}

export function resolveSettleFields(event: Pick<
  SleepEvent,
  'onsetMethod' | 'settleAid' | 'sleepPlace' | 'settleMinutes' | 'settleQuality'
>): {
  settleMinutes: number | null;
  settleQuality: SleepEvent['settleQuality'];
  settleAid: SleepSettleAid | null;
  sleepPlace: SleepPlace | null;
} {
  const derived = deriveSettleFromOnsetMethod(event.onsetMethod);
  return {
    settleMinutes: event.settleMinutes ?? null,
    settleQuality: event.settleQuality ?? null,
    settleAid: event.settleAid ?? derived.settleAid,
    sleepPlace: event.sleepPlace ?? derived.sleepPlace,
  };
}
