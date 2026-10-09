import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { loadRedCoins, replaceRedCoinsFromBackup, getRedCoinsSummary, readSavedRedCoinsRaw } from './redcoins';
import { syncRedCoinsLedger } from './redcoinsLedger';
import { syncReminderNotifications } from './redcoinsReminders';
import { BACKUP_PREFERENCE_KEYS, parseRedCoinsBackup, type RedCoinsBackup } from './redcoinsBackupFormat';
import { backupRedCoinsToFolder, captureRedCoinsBackup, getBackupFolderConfig, pauseRedCoinsAutoBackup, writeBackupToFolder } from './redcoinsBackupFiles';
import { refreshLeanLogWidget } from './widget';
const RECOVERY_KEY = 'redcoins_before_json_restore_v1';
let restoring = false;

export async function stageRedCoinsBackup(contents: string, name: string) {
  const backup = parseRedCoinsBackup(contents);
  const current = await loadRedCoins();
  const original = await readSavedRedCoinsRaw();
  if (!original) throw new Error('Could not checkpoint current RedCoins state.');
  const expectedPreferences: Record<string, string | null> = {};
  for (const key of BACKUP_PREFERENCE_KEYS) expectedPreferences[key] = await AsyncStorage.getItem(key);
  const names = new Set(backup.state.accounts.map(account => account.name));
  const orphanCount = backup.state.entries.filter(entry => !names.has(entry.account) || entry.type === 'transfer' && !names.has(entry.toAccount || '')).length;
  return { backup, original, expectedPreferences, name, current, orphanCount };
}
export async function stageRecoveryBackup() {
  const raw = await AsyncStorage.getItem(RECOVERY_KEY);
  if (!raw) throw new Error('No pre-restore recovery backup is available.');
  return stageRedCoinsBackup(raw, 'Pre-restore recovery backup');
}
export async function hasRecoveryBackup() { return !!await AsyncStorage.getItem(RECOVERY_KEY); }

export async function commitRedCoinsBackup(preview: Awaited<ReturnType<typeof stageRedCoinsBackup>>) {
  if (restoring) throw new Error('A restore is already running.');
  restoring = true; pauseRedCoinsAutoBackup(true);
  try {
    if (await readSavedRedCoinsRaw() !== preview.original) throw new Error('RedCoins changed. Preview the backup again.');
    // Parse again at the trust boundary in case a preview object was altered.
    const backup: RedCoinsBackup = parseRedCoinsBackup(JSON.stringify(preview.backup));
    const recovery = await captureRedCoinsBackup(preview.current);
    const recoveryContents = JSON.stringify(recovery);
    await AsyncStorage.setItem(RECOVERY_KEY, recoveryContents);
    if (await AsyncStorage.getItem(RECOVERY_KEY) !== recoveryContents) throw new Error('Safety checkpoint verification failed. Restore cancelled.');
    const recoveryUri = `${FileSystem.documentDirectory}RedCoins-before-restore.json`;
    await FileSystem.writeAsStringAsync(recoveryUri, recoveryContents);
    if (await FileSystem.readAsStringAsync(recoveryUri) !== recoveryContents) throw new Error('Safety file verification failed. Restore cancelled.');
    const warnings: string[] = [];
    const folder = await getBackupFolderConfig();
    if (folder?.folderUri) {
      try { await writeBackupToFolder(recovery, folder.folderUri, 'RedCoins-before-restore'); }
      catch { warnings.push('Safety copy saved inside LeanLog; selected-folder copy failed.'); }
    }
    // Old v1 exports did not contain guard/cash preferences. Clear unrelated
    // current preferences rather than silently mix two different ledgers.
    const preferences: Record<string, string> = {
      bluecoins_monthly_budget_v1: String(backup.state.monthlyBudget), bluecoins_payday_v1: String(backup.state.payday), bluecoins_cash_reality_buffer_v1: String(backup.state.safetyBuffer),
      bluecoins_cash_reality_accounts_v1: '[]', bluecoins_cash_reality_accounts_initialised_v1: 'false',
      bluecoins_fixed_commitments_v1: '[]', bluecoins_spending_guards_v1: '[]', bluecoins_spending_guards_initialised_v1: 'true', bluecoins_pinned_spending_guard_v1: '',
      ...backup.preferences,
    };
    await replaceRedCoinsFromBackup(backup.state, preview.original, preferences, preview.expectedPreferences);
    // Commit point above. Failures here must be reported as refresh warnings,
    // never as a failed restore which tempts the user to replay it.
    let restored = backup.state;
    try { restored = await loadRedCoins(); } catch { warnings.push('Restore saved; data migration/refresh will retry on reopening.'); }
    try { await syncRedCoinsLedger(restored.entries); } catch { warnings.push('Restore saved; ledger index will refresh on reopening.'); }
    try { await syncReminderNotifications(preview.current.reminders.map(reminder => ({ ...reminder, enabled: false }))); await syncReminderNotifications(restored.reminders); } catch { warnings.push('Restore saved; check reminder notification permissions.'); }
    try { await getRedCoinsSummary(restored); await refreshLeanLogWidget(); } catch { warnings.push('Restore saved; summary/widgets need refreshing.'); }
    return { warnings, recoveryUri };
  } finally { restoring = false; pauseRedCoinsAutoBackup(false); void backupRedCoinsToFolder().catch(console.warn); }
}
