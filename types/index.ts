export type NapGoal = 2 | 3 | 4;

export type AppLocale = 'system' | 'en' | 'de';

export type Baby = {
  id: string;
  name: string;
  birthDate: string; // ISO date YYYY-MM-DD
  /** null = automatic (learns from logs, Napper-style); 2–4 = manual routine */
  napGoal: NapGoal | null;
  /** false = log feed at a time only; true = track breastfeeding duration */
  trackFeedingDuration: boolean;
  /** Profile flags for personalized tips */
  easilyOverstimulated: boolean;
  highNeed: boolean;
};

export type NapExtension =
  | 'independent'
  | 'feeding'
  | 'rocking'
  | 'contact'
  | 'not_extended';

export type DayContextTag =
  | 'outing'
  | 'visitors'
  | 'cafe'
  | 'transit'
  | 'car'
  | 'vaccination'
  | 'sick'
  | 'teething'
  | 'baby_class'
  | 'shopping'
  | 'park'
  | 'quiet_home'
  | 'travel';

export type SleepEvent = {
  id: string;
  babyId: string;
  type: 'nap' | 'night';
  startTime: string; // ISO datetime
  endTime: string | null; // null while currently asleep
  /** How the nap was extended into another sleep cycle; null/undefined if not set. */
  extension?: NapExtension | null;
};

export type DayContextTagEvent = {
  id: string;
  babyId: string;
  dateKey: string; // YYYY-MM-DD
  tag: DayContextTag;
};

export type SleepPause = {
  id: string;
  sleepEventId: string;
  startTime: string;
  endTime: string | null; // null while pause is active
};

export type FeedingEvent = {
  id: string;
  babyId: string;
  feedType: 'breast' | 'bottle' | 'solid';
  startTime: string;
  endTime: string | null;
  side: 'left' | 'right' | 'both' | null;
  amount: number | null;
  unit: 'ml' | 'oz' | 'g' | null;
  notes: string | null;
};

export type DiaperEvent = {
  id: string;
  babyId: string;
  diaperType: 'wet' | 'dirty' | 'mixed';
  time: string;
  notes: string | null;
};

export type BathEvent = {
  id: string;
  babyId: string;
  time: string;
  notes: string | null;
};

export type WakeType = 'morning' | 'night';

export type WakeEvent = {
  id: string;
  babyId: string;
  time: string; // ISO datetime
  endTime: string | null; // for wake windows (e.g. night waking); null = instant wake-up
  wakeType: WakeType; // morning = start day; night = night waking
  notes: string | null;
};

export type ChoreRecurrence = 'daily' | 'once';

export type DailyChore = {
  id: string;
  babyId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  recurrence: ChoreRecurrence;
};

export type DailyChoreCompletion = {
  id: string;
  choreId: string;
  dateKey: string;
  completedAt: string;
};

export type CareEventKind = 'sleep' | 'feeding' | 'diaper' | 'bath' | 'wake';

export type TimelineItem =
  | { kind: 'sleep'; id: string; sortTime: string; data: SleepEvent }
  | { kind: 'feeding'; id: string; sortTime: string; data: FeedingEvent }
  | { kind: 'diaper'; id: string; sortTime: string; data: DiaperEvent }
  | { kind: 'bath'; id: string; sortTime: string; data: BathEvent }
  | { kind: 'wake'; id: string; sortTime: string; data: WakeEvent };

export type SleepSlot = 0 | 1 | 2 | 3 | 4;

export type Prediction = {
  predictedTime: Date;
  confidence: 'low' | 'medium' | 'high';
  slot: SleepSlot;
  slotLabel: string;
  personalWeight: number;
};

export type DaySummary = {
  date: string;
  napCount: number;
  totalDaytimeSleepMinutes: number;
  events: SleepEvent[];
};
