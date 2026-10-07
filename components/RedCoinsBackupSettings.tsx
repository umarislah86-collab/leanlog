import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { backupRedCoinsToFolder, chooseBackupFolder, configureBackupFolder, getBackupFolderConfig, type BackupFolderConfig } from '../services/redcoinsBackupFiles';
import { commitRedCoinsBackup, hasRecoveryBackup, stageRecoveryBackup, stageRedCoinsBackup } from '../services/redcoinsBackupRestore';
import { exportRedCoinsBackup, loadRedCoins } from '../services/redcoins';

export function RedCoinsBackupSettings() {
  const [config, setConfig] = useState<BackupFolderConfig | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { setConfig(await getBackupFolderConfig()); setRecovery(await hasRecoveryBackup()); }, []);
  useFocusEffect(useCallback(() => { void refresh(); const timer = setInterval(() => { void refresh().catch(console.warn); }, 5000); return () => clearInterval(timer); }, [refresh]));
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (error) { Alert.alert('Backup action failed', error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); await refresh(); }
  };
  const restore = async (internal = false) => {
    if (busy) return;
    setBusy(true);
    try {
      let preview: Awaited<ReturnType<typeof stageRedCoinsBackup>>;
      if (internal) preview = await stageRecoveryBackup();
      else {
        const selected = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
        if (selected.canceled) { setBusy(false); return; }
        const asset = selected.assets[0];
        if ((asset.size || 0) > 50 * 1024 * 1024) throw new Error('Backup is too large (maximum 50 MB).');
        preview = await stageRedCoinsBackup(await FileSystem.readAsStringAsync(asset.uri), asset.name);
      }
      const old = preview.current, next = preview.backup.state;
      const accountPreview = next.accounts.slice(0, 6).map(account => `${account.name}: RM ${account.balance.toFixed(2)}`).join('\n');
      Alert.alert('Replace RedCoins with this backup?', `${preview.name}\nSaved ${new Date(preview.backup.exportedAt).toLocaleString('en-MY')}\n\nTransactions: ${old.entries.length} → ${next.entries.length}\nAccounts: ${old.accounts.length} → ${next.accounts.length}\nCategories: ${next.categories.length} · Schedules: ${next.reminders.length}\n\n${accountPreview}${next.accounts.length > 6 ? '\n…more accounts' : ''}\n\nThis REPLACES RedCoins, not merges it. A recovery copy is saved first. LeanLog food/health data is untouched. Device widget account selections may need reselecting.${preview.orphanCount ? `\nWARNING: ${preview.orphanCount} transactions reference missing accounts.` : ''}${!preview.backup.preferences ? '\nOlder backup: spendable account choices and Spending Guards were not included; reconfigure them after restoring.' : ''}\nEnabled schedules will be restored; overdue auto-log may catch up when loaded.`, [
        { text: 'Cancel', style: 'cancel', onPress: () => setBusy(false) },
        { text: 'Restore & replace', style: 'destructive', onPress: () => { void (async () => {
          try { const result = await commitRedCoinsBackup(preview); Alert.alert('RedCoins restored', ['Data replaced successfully. Pre-restore recovery is available below.', ...result.warnings].join('\n')); }
          catch (error) { Alert.alert('Restore not completed', error instanceof Error ? error.message : String(error)); }
          finally { setBusy(false); await refresh(); }
        })(); } },
      ], { cancelable: true, onDismiss: () => setBusy(false) });
    } catch (error) { setBusy(false); Alert.alert('Cannot restore backup', error instanceof Error ? error.message : String(error)); }
  };
  const button = (label: string, action: () => void) => <TouchableOpacity disabled={busy} style={[s.row, busy && { opacity: 0.5 }]} onPress={action}><Text style={s.name}>{label}</Text><Text style={s.arrow}>›</Text></TouchableOpacity>;
  return <View style={s.card}>
    <Text style={s.hint}>RedCoins JSON backups · accounts, transactions, budgets, schedules, icons, bank reviews and supported finance settings.</Text>
    {button(config ? 'Change backup folder' : 'Choose backup folder', () => { void run(async () => { const chosen = await chooseBackupFolder(); if (chosen) { setConfig(chosen); if (chosen.automatic) await backupRedCoinsToFolder(); } }); })}
    {config && <Text style={s.hint}>Folder: {decodeURIComponent(config.folderUri).split('/').pop()}</Text>}
    <View style={s.row}><View style={{ flex: 1 }}><Text style={s.name}>Auto-backup</Text><Text style={s.hint}>Needs a selected folder.</Text></View><Switch disabled={busy || !config} value={config?.automatic || false} onValueChange={automatic => { void run(async () => { const current = await getBackupFolderConfig(); if (!current) return; await configureBackupFolder({ ...current, automatic }); if (automatic) await backupRedCoinsToFolder(); }); }} trackColor={{ true: '#8BD6B2', false: '#DDD8CD' }} /></View>
    {config && <View style={s.row}><Text style={[s.name, { flex: 1 }]}>Frequency</Text>{(['changes', 'daily'] as const).map(frequency => <TouchableOpacity key={frequency} disabled={busy} style={s.choice} onPress={() => { void run(async () => { const current = await getBackupFolderConfig(); if (current) await configureBackupFolder({ ...current, frequency }); }); }}><Text style={{ color: config.frequency === frequency ? '#168A65' : '#7C8290', fontSize: 11, fontWeight: '700' }}>{config.frequency === frequency ? '✓ ' : ''}{frequency === 'changes' ? 'After edits' : 'Daily'}</Text></TouchableOpacity>)}</View>}
    <Text style={s.hint}>After edits: saves a new snapshot after 10 seconds without more edits. Daily: at most one snapshot per day while LeanLog runs (checked every 15 minutes). Also tries on launch/resume/background; Android may stop the app before a pending backup runs.</Text>
    <Text style={s.hint}>Last saved: {config?.lastSavedAt ? new Date(config.lastSavedAt).toLocaleString('en-MY') : 'Not saved to selected folder yet'}{config?.lastFile ? `\n${config.lastFile}` : ''}</Text>
    {!!config?.error && <Text style={s.error}>Last backup failed: {config.error}. Reselect the folder if access was revoked.</Text>}
    {button(busy ? 'Working…' : 'Back up now', () => { void run(async () => { if (config) { const name = await backupRedCoinsToFolder(true); Alert.alert('Backup saved', name || 'Saved.'); } else await exportRedCoinsBackup(await loadRedCoins()); }); })}
    {button('Import / restore JSON backup', () => { void restore(); })}
    {recovery && button('Restore pre-restore recovery copy', () => { void restore(true); })}
    <Text style={s.hint}>Backups are new timestamped files, never overwritten or auto-deleted. Keep a copy outside this phone; JSON contains your financial data.</Text>
  </View>;
}
const s = StyleSheet.create({ card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1DCCF', borderRadius: 22, padding: 18 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#E7E1D5' }, name: { fontSize: 13, fontWeight: '700', color: '#111A2A', flexShrink: 1 }, hint: { color: '#7C8290', fontSize: 11, lineHeight: 17, marginVertical: 5 }, arrow: { color: '#7C8290', fontSize: 22, marginLeft: 'auto' }, choice: { padding: 7 }, error: { color: '#C14335', fontSize: 11, lineHeight: 17, marginVertical: 5 } });
