/**
 * N6 — review reminders (client-only slice).
 *
 * A static, localStorage-only build can't push a notification when the tab is
 * closed (that needs a service worker + push server + scheduler — see the
 * roadmap). What it CAN do is nudge the user with a browser notification when
 * they open Nabbit and have concepts due. This module wraps the Notification
 * API and the opt-in preference; the "scheduled email/push" piece stays roadmap.
 */

const REMINDERS_KEY = 'nabbit_reminders_enabled_v1';

export type PermissionState = NotificationPermission | 'unsupported';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): PermissionState {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export function getRemindersEnabled(): boolean {
  try {
    return localStorage.getItem(REMINDERS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setRemindersEnabled(on: boolean): void {
  try {
    localStorage.setItem(REMINDERS_KEY, on ? '1' : '0');
  } catch {
    // storage unavailable — preference just won't persist
  }
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Fire a "you have reviews due" notification, if allowed. No-op otherwise. */
export function notifyDueReviews(count: number, onClick?: () => void): void {
  if (!notificationsSupported() || Notification.permission !== 'granted' || count <= 0) return;
  try {
    const n = new Notification('Nabbit — time to review', {
      body: `You have ${count} concept${count === 1 ? '' : 's'} due for review. Keep your streak going.`,
      tag: 'nabbit-due-reviews',
    });
    if (onClick) {
      n.onclick = () => {
        window.focus();
        onClick();
        n.close();
      };
    }
  } catch {
    // Notification construction can throw in some embedded contexts — ignore
  }
}
