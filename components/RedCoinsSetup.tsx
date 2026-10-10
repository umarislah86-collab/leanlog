import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ThemeText as Text, ThemeTextInput as TextInput } from './ThemePrimitives';
import { useTheme } from '../context/ThemeContext';
import { loadRedCoins, saveRedCoins, type RedCoinsState } from '../services/redcoins';
import { finishRedCoinsSetup, setupAccount, starterCategories, type RedCoinsSetupDraft } from '../services/redcoinsOnboarding';
import { stageRedCoinsBackup, commitRedCoinsBackup } from '../services/redcoinsBackupRestore';

export function RedCoinsSetup({ visible, defaults, onSaved, onBluecoins }: {
  visible: boolean; defaults: RedCoinsState; onSaved: (state: RedCoinsState, firstEntry: boolean) => void; onBluecoins: () => void;
}) {
  const { palette: p } = useTheme();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<RedCoinsSetupDraft>({ name: 'Cash', type: 'Cash', balance: '0',
    categories: starterCategories.map(row => row.name), budget: '', payday: '' });
  const update = (patch: Partial<RedCoinsSetupDraft>) => { setDraft(row => ({ ...row, ...patch })); setError(''); };
  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const finish = (skip = false) => run(async () => {
    const current = await loadRedCoins();
    const next = finishRedCoinsSetup(current, skip ? undefined : draft);
    await saveRedCoins(next);
    onSaved(await loadRedCoins(), !skip);
  });
  const restore = () => run(async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (picked.canceled) return;
    const file = picked.assets[0];
    if ((file.size || 0) > 50 * 1024 * 1024) throw new Error('Backup is too large (maximum 50 MB).');
    const preview = await stageRedCoinsBackup(await FileSystem.readAsStringAsync(file.uri), file.name);
    const confirmed = await new Promise<boolean>(resolve => Alert.alert('Restore RedCoins backup?',
      `${file.name}\n${preview.backup.state.entries.length} transactions · ${preview.backup.state.accounts.length} accounts\n\nCurrent RedCoins data will be replaced. A recovery copy is saved first.`,
      [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Restore', onPress: () => resolve(true) }],
      { cancelable: true, onDismiss: () => resolve(false) }));
    if (!confirmed) return;
    const result = await commitRedCoinsBackup(preview);
    onSaved(await loadRedCoins(), false);
    if (result.warnings.length) Alert.alert('Backup restored', result.warnings.join('\n'));
  });
  function next() {
    try {
      if (step === 1) setupAccount(draft);
      if (step === 2 && !draft.categories.some(name => name !== 'Income')) throw new Error('Choose at least one spending category.');
      setError(''); setStep(value => value + 1);
    } catch (e) { setError((e as Error).message); }
  }
  const button = (label: string, press: () => void, selected = false) => <TouchableOpacity key={label}
    accessibilityRole="button" accessibilityState={{ disabled: busy, selected }} disabled={busy} onPress={press}
    style={{ padding: 15, borderRadius: 12, borderWidth: 1, borderColor: selected ? p.accent : p.border,
      backgroundColor: selected ? p.coralTint : p.surface, marginBottom: 8 }}>
    <Text style={{ color: p.text, fontWeight: '700' }}>{label}</Text>
  </TouchableOpacity>;
  const input = (label: string, value: string, change: (value: string) => void, number = false, placeholder = '') => <View style={{ marginBottom: 16 }}>
    <Text style={{ color: p.text, marginBottom: 7 }}>{label}</Text>
    <TextInput accessibilityLabel={label} editable={!busy} value={value} onChangeText={change} keyboardType={number ? 'decimal-pad' : 'default'}
      placeholder={placeholder} placeholderTextColor={p.muted} style={{ color: p.text, backgroundColor: p.surface, borderColor: p.border,
        borderWidth: 1, borderRadius: 12, padding: 14 }} />
  </View>;
  return <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!busy && step > 0) { setStep(value => value - 1); setError(''); } }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: p.canvas }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, flexGrow: 1 }}>
          <Text style={{ color: p.accent, fontWeight: '700', marginBottom: 12 }}>REDCOINS · {step === 0 ? 'WELCOME' : `SETUP ${step} / 3`}</Text>
          <Text style={{ color: p.text, fontSize: 28, fontWeight: '700', marginBottom: 12 }}>{['Your money, your starting point', 'Add your first account', 'Pick your categories', 'Plan your month'][step]}</Text>
          <Text style={{ color: p.muted, lineHeight: 22, marginBottom: 24 }}>{[
            'Start fresh or bring an existing backup. You can use RedCoins without Bluecoins. Everything can be edited later.',
            'Use the balance you have today. Add more accounts later from Accounts. Opening balances are not income or spending.',
            'These categories are ready for your first transaction. Rename or add more later.',
            `Optional: set a monthly spending budget and payday. Leave blank to keep RM ${defaults.monthlyBudget.toLocaleString()} and payday ${defaults.payday}.`][step]}</Text>
          {step === 0 && <>
            {button('Start fresh', () => setStep(1))}
            {button('Restore RedCoins backup (.json)', () => { void restore(); })}
            {button('Import Bluecoins backup', onBluecoins)}
          </>}
          {step === 1 && <>
            {(['Cash', 'Bank', 'Credit card'] as const).map(type => button(type, () => update({ type, name: draft.name === draft.type ? type : draft.name }), draft.type === type))}
            {input('Account name', draft.name, name => update({ name }))}
            {input(draft.type === 'Credit card' ? 'Amount owed (RM, positive)' : 'Opening balance (RM)', draft.balance, balance => update({ balance }), true)}
          </>}
          {step === 2 && starterCategories.map(row => button(`${draft.categories.includes(row.name) ? '✓ ' : ''}${row.name}`, () => update({
            categories: draft.categories.includes(row.name) ? draft.categories.filter(name => name !== row.name) : [...draft.categories, row.name] }), draft.categories.includes(row.name)))}
          {step === 3 && <>
            {input('Monthly budget (RM, optional)', draft.budget, budget => update({ budget }), true, String(defaults.monthlyBudget))}
            {input('Payday (1–31, optional)', draft.payday, payday => update({ payday }), true, String(defaults.payday))}
            <Text style={{ color: p.muted, lineHeight: 22 }}>Ready: {draft.name.trim()} · {draft.categories.length} categories. Choose a receipt folder when you attach your first receipt.</Text>
          </>}
          {!!error && <Text accessibilityRole="alert" style={{ color: p.expense, marginVertical: 16 }}>{error}</Text>}
          {busy && <ActivityIndicator color={p.accent} style={{ margin: 12 }} />}
          <View style={{ marginTop: 24 }}>
            {step > 0 && button(step === 3 ? 'Finish & add first transaction' : 'Continue', () => { if (step === 3) void finish(); else next(); })}
            {step > 0 && button('Back', () => { setStep(value => value - 1); setError(''); })}
            {button('Skip setup for now', () => { void finish(true); })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
