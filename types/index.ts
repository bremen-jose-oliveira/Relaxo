export type NapGoal = 2 | 3 | 4;

export type Baby = {
  id: string;
  name: string;
  birthDate: string; // ISO date YYYY-MM-DD
  /** null = automatic (learns from logs, Napper-style); 2–4 = manual routine */
  napGoal: NapGoal | null;
};

export type SleepEvent = {
  id: string;
  babyId: string;
  type: 'nap' | 'night';
  startTime: string; // ISO datetime
  endTime: string | null; // null while currently asleep
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

export type WakeType = 'morning' | 'night';

export type WakeEvent = {
  id: string;
  babyId: string;
  time: string; // ISO datetime
  endTime: string | null; // for wake windows (e.g. night waking); null = instant wake-up
  wakeType: WakeType; // morning = start day; night = night waking
  notes: string | null;
};

export type CareEventKind = 'sleep' | 'feeding' | 'diaper' | 'wake';

export type TimelineItem =
  | { kind: 'sleep'; id: string; sortTime: string; data: SleepEvent }
  | { kind: 'feeding'; id: string; sortTime: string; data: FeedingEvent }
  | { kind: 'diaper'; id: string; sortTime: string; data: DiaperEvent }
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
