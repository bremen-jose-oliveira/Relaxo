import type { ChoreRecurrence } from '@/types';

export function normalizeChoreRecurrence(value: string | null | undefined): ChoreRecurrence {
  return value === 'once' ? 'once' : 'daily';
}

export function shouldRemoveChoreOnComplete(
  recurrence: ChoreRecurrence,
  completed: boolean
): boolean {
  return recurrence === 'once' && completed;
}
