import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_ID = 'relaxo-next-sleep';
const REMINDER_MINUTES_BEFORE = 30;

/** Local notifications work on iOS/Android only — not on web. */
export function isNotificationsSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

if (isNotificationsSupported()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelSleepReminder(): Promise<void> {
  if (!isNotificationsSupported()) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Ignore — notification may not exist
  }
}

export async function scheduleSleepReminder(
  predictedTime: Date,
  slotLabel: string,
  babyName: string
): Promise<void> {
  if (!isNotificationsSupported()) return;

  try {
    await cancelSleepReminder();

    const triggerTime = new Date(
      predictedTime.getTime() - REMINDER_MINUTES_BEFORE * 60 * 1000
    );
    const now = new Date();
    if (triggerTime <= now) return;

    const granted = await requestNotificationPermissions();
    if (!granted) return;

    // DATE trigger is more reliable than a long TIME_INTERVAL countdown
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: `${babyName}'s ${slotLabel} soon`,
        body: `Predicted in ~${REMINDER_MINUTES_BEFORE} minutes. Time to start winding down.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerTime,
      },
    });
  } catch (error) {
    // Don't crash prediction flow if scheduling fails (permissions, simulator, etc.)
    console.warn('[Relaxo] Could not schedule sleep reminder:', error);
  }
}

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('sleep-reminders', {
      name: 'Sleep Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('task-reminders', {
      name: 'Task Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch (error) {
    console.warn('[Relaxo] Could not create notification channel:', error);
  }
}
