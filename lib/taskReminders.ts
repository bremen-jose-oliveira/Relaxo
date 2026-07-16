import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DailyChore } from '@/types';
import {
  isNotificationsSupported,
  requestNotificationPermissions,
} from '@/lib/notifications';

/** Default daily nudge: 6:00 PM local. */
export const DEFAULT_TASK_REMINDER_MINUTES = 18 * 60;

const TASK_CHANNEL_ID = 'task-reminders';

function reminderId(choreId: string): string {
  return `task-reminder-${choreId}`;
}

function snoozeId(choreId: string): string {
  return `task-snooze-${choreId}`;
}

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function triggerDateForMinutes(
  minutesFromMidnight: number,
  recurrence: DailyChore['recurrence']
): Date {
  const now = new Date();
  const trigger = new Date(now);
  trigger.setHours(
    Math.floor(minutesFromMidnight / 60),
    minutesFromMidnight % 60,
    0,
    0
  );
  if (trigger > now) return trigger;

  if (recurrence === 'daily') {
    trigger.setDate(trigger.getDate() + 1);
    return trigger;
  }
  // One-time: nudge again in an hour if today's slot already passed
  return new Date(now.getTime() + 60 * 60 * 1000);
}

async function ensurePermissions(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  return requestNotificationPermissions();
}

export async function cancelTaskReminder(choreId: string): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderId(choreId));
  } catch {
    // ignore
  }
}

export async function cancelTaskSnooze(choreId: string): Promise<void> {
  if (!isNotificationsSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(snoozeId(choreId));
  } catch {
    // ignore
  }
}

export async function cancelAllTaskNotifications(choreId: string): Promise<void> {
  await cancelTaskReminder(choreId);
  await cancelTaskSnooze(choreId);
}

async function scheduleAt(
  identifier: string,
  chore: DailyChore,
  babyName: string,
  when: Date,
  body: string
): Promise<void> {
  if (when <= new Date()) return;
  const granted = await ensurePermissions();
  if (!granted) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: babyName ? `${babyName}: ${chore.title}` : chore.title,
        body,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: TASK_CHANNEL_ID } : null),
        data: { type: 'task', choreId: chore.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
  } catch (error) {
    console.warn('[Relaxo] Could not schedule task reminder:', error);
  }
}

export async function scheduleTaskReminder(
  chore: DailyChore,
  babyName: string
): Promise<void> {
  if (!isNotificationsSupported()) return;
  await cancelTaskReminder(chore.id);

  if (chore.reminderMinutes == null) return;

  const when = triggerDateForMinutes(chore.reminderMinutes, chore.recurrence);
  await scheduleAt(
    reminderId(chore.id),
    chore,
    babyName,
    when,
    `Still open — reminder for ${minutesToLabel(chore.reminderMinutes)}.`
  );
}

/** Snooze: cancel the daily slot and fire again after `minutes`. */
export async function snoozeTaskReminder(
  chore: DailyChore,
  babyName: string,
  minutes: number
): Promise<void> {
  if (!isNotificationsSupported() || minutes <= 0) return;
  await cancelAllTaskNotifications(chore.id);

  const when = new Date(Date.now() + minutes * 60 * 1000);
  await scheduleAt(
    snoozeId(chore.id),
    chore,
    babyName,
    when,
    `Reminding you again in a bit — still unchecked.`
  );
}

/** Snooze until a clock time tonight (default 8 PM). If past, use tomorrow. */
export async function snoozeTaskUntilTonight(
  chore: DailyChore,
  babyName: string,
  tonightMinutes: number = 20 * 60
): Promise<void> {
  if (!isNotificationsSupported()) return;
  await cancelAllTaskNotifications(chore.id);

  const when = triggerDateForMinutes(tonightMinutes, 'daily');
  await scheduleAt(
    snoozeId(chore.id),
    chore,
    babyName,
    when,
    `Evening nudge — still unchecked.`
  );
}

export async function syncTaskReminders(
  chores: DailyChore[],
  completedIds: Iterable<string>,
  babyName: string
): Promise<void> {
  if (!isNotificationsSupported()) return;

  const completed = new Set(completedIds);
  const choreIds = new Set(chores.map((c) => c.id));

  let scheduled: Notifications.NotificationRequest[] = [];
  try {
    scheduled = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    scheduled = [];
  }

  const snoozed = new Set(
    scheduled
      .filter((n) => n.identifier.startsWith('task-snooze-'))
      .map((n) => n.identifier.slice('task-snooze-'.length))
  );

  for (const chore of chores) {
    if (completed.has(chore.id)) {
      await cancelAllTaskNotifications(chore.id);
      continue;
    }
    if (snoozed.has(chore.id)) {
      await cancelTaskReminder(chore.id);
      continue;
    }
    if (chore.reminderMinutes == null) {
      await cancelAllTaskNotifications(chore.id);
      continue;
    }
    await scheduleTaskReminder(chore, babyName);
  }

  for (const n of scheduled) {
    const isReminder = n.identifier.startsWith('task-reminder-');
    const isSnooze = n.identifier.startsWith('task-snooze-');
    if (!isReminder && !isSnooze) continue;
    const id = n.identifier.replace(/^task-(reminder|snooze)-/, '');
    if (!choreIds.has(id)) {
      try {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      } catch {
        // ignore
      }
    }
  }
}
