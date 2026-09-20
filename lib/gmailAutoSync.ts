/**
 * Automatic Gmail sync (Pro): once a day the same inbox scan as the manual one, then a notification when it found
 * something new. Free users are untouched — the task is only registered for Pro with the Settings toggle on.
 * Metadata only, like the manual scan: no email content is stored, just message ids.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';

import { isPro } from '../services/SubscriptionManager';
import { isGmailConnected } from './gmailTripExtras';
import { addImportedIds, savePendingImports, saveSyncStatus, scanGmailInbox } from './gmailInboxStore';
import { shouldRunGmailSync, syncNotification, syncScanDays } from './gmailAutoSyncRules';
import { t } from './i18n';

export const GMAIL_SYNC_TASK = 'waiair-gmail-sync';
/** Stamp of the last completed sync. */
export const GMAIL_LAST_SYNC_KEY = 'gmail_last_sync';
/** Settings toggle "Auto-import travel emails"; Pro default is on. */
export const GMAIL_AUTO_SYNC_KEY = 'gmail_auto_sync';
/** The task wakes every 6h at the earliest; the 24h rule decides whether it really scans. */
const TASK_INTERVAL_MIN = 6 * 60;

export function parseAutoSyncEnabled(raw: string | null | undefined): boolean {
  return raw !== '0' && raw !== 'false';
}

export async function isAutoSyncEnabled(): Promise<boolean> {
  try {
    return parseAutoSyncEnabled(await AsyncStorage.getItem(GMAIL_AUTO_SYNC_KEY));
  } catch {
    return true;
  }
}

export async function setAutoSyncEnabled(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(GMAIL_AUTO_SYNC_KEY, on ? '1' : '0');
  } catch { /* the toggle still applies this session */ }
  await (on ? registerGmailSyncTask() : unregisterGmailSyncTask());
}

async function lastSyncMs(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(GMAIL_LAST_SYNC_KEY);
    const ms = Number(raw);
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  } catch {
    return null;
  }
}

/** Notifications the user switched off stay off: this reuses the app's own notification permission. */
async function notifyFound(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await Notifications.scheduleNotificationAsync({
      // Tapping this opens the Gmail import screen (App.tsx reads gmailImport).
      content: { title, body, sound: true, data: { gmailImport: '1' } },
      trigger: null,
    });
  } catch { /* a failed notification never fails the sync */ }
}

/**
 * One sync pass. Returns whether it scanned, so the task can report success without pretending on a skipped run.
 * Every failure is swallowed: a background task must not crash the app.
 */
export async function runGmailAutoSync(now = Date.now()): Promise<boolean> {
  try {
    const [pro, connected, autoSyncOn, last] = await Promise.all([
      isPro(),
      isGmailConnected(),
      isAutoSyncEnabled(),
      lastSyncMs(),
    ]);
    if (!shouldRunGmailSync({ isPro: pro, connected, autoSyncOn, lastSyncMs: last, now })) return false;

    const result = await scanGmailInbox({ days: syncScanDays(last, now) });
    // The stamp is written even on a failed scan, so a broken inbox cannot cause a scan every wake-up.
    await AsyncStorage.setItem(GMAIL_LAST_SYNC_KEY, String(now)).catch(() => {});
    // What Settings reports under "Travel emails": when, and how many — never what the mails said.
    await saveSyncStatus({ ms: now, found: result.items.length });
    if (result.reason || !result.items.length) return true;

    const copy = t();
    const note = syncNotification(result.items, {
      gmailSyncFoundTitle: copy.gmailSyncFoundTitle,
      gmailSyncFoundOne: copy.gmailSyncFoundOne,
      gmailSyncFoundMany: copy.gmailSyncFoundMany,
    });
    if (!note) return true;
    // Queue what was found for the import screen, and remember the ids so nothing is offered twice.
    await savePendingImports(result.items);
    await addImportedIds(result.items.map(i => i.id));
    await notifyFound(note.title, note.body);
    return true;
  } catch (e) {
    console.warn('[gmailAutoSync]', e);
    return false;
  }
}

/** Pro with the toggle on: make sure the task exists. */
export async function registerGmailSyncTask(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!(await isPro()) || !(await isAutoSyncEnabled())) return;
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;
    if (await TaskManager.isTaskRegisteredAsync(GMAIL_SYNC_TASK)) return;
    await BackgroundTask.registerTaskAsync(GMAIL_SYNC_TASK, { minimumInterval: TASK_INTERVAL_MIN });
  } catch { /* Expo Go / missing native module */ }
}

/** Pro cancelled or the toggle switched off: the task goes away. */
export async function unregisterGmailSyncTask(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(GMAIL_SYNC_TASK))) return;
    await BackgroundTask.unregisterTaskAsync(GMAIL_SYNC_TASK);
  } catch { /* nothing registered */ }
}

/** Register or unregister in one call, after a Pro change or a toggle. */
export async function syncGmailTaskRegistration(): Promise<void> {
  if (await isPro()) {
    await registerGmailSyncTask();
    return;
  }
  await unregisterGmailSyncTask();
}

/** Must run at import time (global scope) so iOS can wake the JS task. */
export function defineGmailSyncTask(): void {
  if (Platform.OS === 'web') return;
  try {
    TaskManager.defineTask(GMAIL_SYNC_TASK, async () => {
      try {
        await runGmailAutoSync();
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch { /* native module not present */ }
}
