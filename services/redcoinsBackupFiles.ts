import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { AppState, Platform } from 'react-native';
import { subscribeRedCoinsChanges } from './redcoinsEvents';
import { BACKUP_PREFERENCE_KEYS, parseRedCoinsBackup, type RedCoinsBackup } from './redcoinsBackupFormat';
import type { RedCoinsState } from './redcoins';

const CONFIG_KEY = 'redcoins_backup_folder_v1';
export type BackupFolderConfig = { folderUri: string; automatic: boolean; frequency: 'changes' | 'daily'; lastSavedAt?: string; lastFile?: string; error?: string };
let chain: Promise<unknown> = Promise.resolve();
let previousSnapshot = '';
let paused = false;
export const pauseRedCoinsAutoBackup = (value: boolean) => { paused = value; previousSnapshot = ''; };
export async function getBackupFolderConfig(): Promise<BackupFolderConfig | null> {
  const raw = await AsyncStorage.getItem(CONFIG_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export async function configureBackupFolder(config: BackupFolderConfig) {
  previousSnapshot = '';
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
export async function chooseBackupFolder() {
  if (Platform.OS !== 'android') throw new Error('Persistent folder backups are currently Android-only.');
  const access = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!access.granted) return null;
  const previous = await getBackupFolderConfig();
  const next: BackupFolderConfig = { folderUri: access.directoryUri, automatic: previous?.automatic || false, frequency: previous?.frequency || 'changes' };
  await configureBackupFolder(next);
  return next;
}
export async function captureRedCoinsBackup(state?: RedCoinsState): Promise<RedCoinsBackup> {
  // Include a transaction already saved optimistically by the UI but still
  // waiting for its serialized AsyncStorage write to finish.
  if (!state) { const { flushRedCoinsWrites } = await import('./redcoins'); await flushRedCoinsWrites(); }
  const raw = state ? JSON.stringify(state) : await AsyncStorage.getItem('redcoins_state_v1');
  if (!raw) throw new Error('No saved RedCoins data to back up yet.');
  const preferences: Record<string, string> = {};
  for (const key of BACKUP_PREFERENCE_KEYS) { const value = await AsyncStorage.getItem(key); if (value !== null) preferences[key] = value; }
  return parseRedCoinsBackup(JSON.stringify({ format: 'redcoins-backup', version: 1, exportedAt: new Date().toISOString(), state: JSON.parse(raw), preferences }));
}
/** New timestamped file + read-back verification; never overwrite older backups. */
export async function writeBackupToFolder(backup: RedCoinsBackup, folderUri: string, prefix = 'RedCoins-backup') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6)}.json`;
  const uri = await FileSystem.StorageAccessFramework.createFileAsync(folderUri, name, 'application/json');
  const contents = JSON.stringify(backup, null, 2);
  await FileSystem.writeAsStringAsync(uri, contents);
  const verify = await FileSystem.readAsStringAsync(uri);
  if (verify !== contents) throw new Error('Backup verification failed. Previous backups have not been overwritten.');
  return { name, uri };
}
export function backupRedCoinsToFolder(manual = false): Promise<string | null> {
  const work = async () => {
    if (paused && !manual) return null;
    const config = await getBackupFolderConfig();
    if (!config?.folderUri) { if (manual) throw new Error('Choose a backup folder first.'); return null; }
    if (!manual && !config.automatic) return null;
    try {
      const backup = await captureRedCoinsBackup();
      const snapshot = JSON.stringify([backup.state, backup.preferences]);
      if (!manual && config.frequency === 'changes' && snapshot === previousSnapshot) return null;
      if (!manual && config.frequency === 'daily' && config.lastSavedAt && new Date(config.lastSavedAt).toDateString() === new Date().toDateString()) return null;
      const file = await writeBackupToFolder(backup, config.folderUri);
      previousSnapshot = snapshot;
      // Keep a newer folder selection/toggle if changed while file I/O ran.
      const current = await getBackupFolderConfig();
      if (current?.folderUri === config.folderUri) await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, lastSavedAt: new Date().toISOString(), lastFile: file.name, error: undefined }));
      return file.name;
    } catch (error) {
      const current = await getBackupFolderConfig();
      if (current?.folderUri === config.folderUri) await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  };
  const result = chain.catch(() => {}).then(work);
  chain = result.catch(() => {});
  return result;
}
/** App runtime only: debounce edits, retry on launch/resume, flush on background.
 * No claim of exact execution while Android has killed/suspended the process. */
export function startRedCoinsAutoBackup() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => { void backupRedCoinsToFolder().catch(console.warn); };
  const queue = () => { if (timer) clearTimeout(timer); timer = setTimeout(run, 10000); };
  const unsubscribe = subscribeRedCoinsChanges(queue);
  const subscription = AppState.addEventListener('change', () => { if (timer) clearTimeout(timer); run(); });
  const dailyRetry = setInterval(run, 15 * 60 * 1000);
  run();
  return () => { if (timer) clearTimeout(timer); clearInterval(dailyRetry); unsubscribe(); subscription.remove(); };
}
