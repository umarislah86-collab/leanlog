import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';
import { AccountSnapshotWidget, type WidgetAccount } from './RedCoinsWidgets';
import { getWidgetAccounts, saveWidgetAccount, widgetUpdatedTime } from './redcoins-widget-data';
import { LeanLogWidget } from './LeanLogWidget';
import { getWidgetData } from './widget-data';
import { getDailyWidgetPreferences, saveDailyWidgetPreferences, type DailyWidgetPreferences } from './daily-widget-preferences';
import type { RedCoinsAccount } from '../services/redcoins';

export function WidgetConfigurationScreen(props: WidgetConfigurationScreenProps) {
  return props.widgetInfo.widgetName === 'LeanLogDaily'
    ? <DailyWidgetConfiguration {...props} />
    : <AccountWidgetConfiguration {...props} />;
}

function DailyWidgetConfiguration({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const [accounts, setAccounts] = useState<RedCoinsAccount[]>([]);
  const [preferences, setPreferences] = useState<DailyWidgetPreferences>({ mode: 'guards', accountIds: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getWidgetAccounts(), getDailyWidgetPreferences(widgetInfo.widgetId)]).then(([rows, saved]) => {
      if (cancelled) return;
      setAccounts(rows);
      setPreferences({ ...saved, accountIds: saved.accountIds.filter((id) => rows.some((account) => account.id === id)) });
    }).catch(() => Alert.alert('Widget settings unavailable', 'Open LeanLog and try again.')).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [widgetInfo.widgetId]);
  const toggleAccount = (id: string) => {
    if (preferences.accountIds.includes(id)) setPreferences({ ...preferences, accountIds: preferences.accountIds.filter((value) => value !== id) });
    else if (preferences.accountIds.length < 4) setPreferences({ ...preferences, accountIds: [...preferences.accountIds, id] });
    else Alert.alert('Four slots', 'Unselect an account before choosing another.');
  };
  const canSave = !loading && !saving && (preferences.mode === 'guards' || preferences.accountIds.length > 0);
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await saveDailyWidgetPreferences(widgetInfo.widgetId, preferences);
      const data = await getWidgetData(widgetInfo.widgetId);
      renderWidget(<LeanLogWidget {...data} />);
      setResult('ok');
    } catch (error) {
      console.error('Daily widget configuration failed', error);
      Alert.alert('Widget could not be saved', 'Please try again.');
    } finally { setSaving(false); }
  };
  return <View style={s.screen}>
    <Text style={s.eyebrow}>LEANLOG / DAILY WIDGET</Text>
    <Text style={s.title}>Your daily view.</Text>
    <Text style={s.body}>Keep calories and steps. Choose what appears in the four compact slots below.</Text>
    {loading ? <ActivityIndicator color="#EF3F43" /> : <ScrollView style={s.list}>
      {(['guards', 'accounts'] as const).map((mode) => <TouchableOpacity key={mode} style={[s.row, preferences.mode === mode && s.rowActive]} onPress={() => setPreferences({ ...preferences, mode })} accessibilityRole="radio" accessibilityState={{ checked: preferences.mode === mode }}>
        <View style={{ flex: 1 }}><Text style={s.name}>{mode === 'guards' ? 'Spending Guards' : 'Account Snapshot'}</Text><Text style={s.meta}>{mode === 'guards' ? 'Existing pinned guard and spending limits' : 'Live balances for up to four chosen accounts'}</Text></View>
        <Text style={s.balance}>{preferences.mode === mode ? '●' : '○'}</Text>
      </TouchableOpacity>)}
      {preferences.mode === 'accounts' && <View>
        <Text style={s.body}>Choose accounts · {preferences.accountIds.length}/4. Selection order is the display order.</Text>
        {accounts.map((account) => {
          const index = preferences.accountIds.indexOf(account.id);
          return <TouchableOpacity key={account.id} style={[s.row, index >= 0 && s.rowActive]} onPress={() => toggleAccount(account.id)} accessibilityRole="checkbox" accessibilityState={{ checked: index >= 0 }}>
            <View style={{ flex: 1 }}><Text style={s.name}>{index >= 0 ? `${index + 1}. ` : ''}{account.name}</Text><Text style={s.meta}>{account.type}</Text></View>
            <Text style={[s.balance, { color: account.balance < 0 ? '#B33421' : '#315F50' }]}>{account.balance < 0 ? '−' : ''}RM {Math.abs(account.balance).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </TouchableOpacity>;
        })}
        {!accounts.length && <Text style={s.empty}>Add accounts in RedCoins first.</Text>}
      </View>}
    </ScrollView>}
    <View style={s.actions}><TouchableOpacity disabled={saving} style={s.cancel} onPress={() => setResult('cancel')}><Text style={s.cancelText}>CANCEL</Text></TouchableOpacity><TouchableOpacity disabled={!canSave} style={[s.save, !canSave && { opacity: 0.4 }]} onPress={save}><Text style={s.saveText}>{saving ? 'SAVING…' : 'SAVE WIDGET'}</Text></TouchableOpacity></View>
  </View>;
}

function AccountWidgetConfiguration({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const [accounts, setAccounts] = useState<WidgetAccount[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getWidgetAccounts().then((rows) => {
      setAccounts(rows);
      setSelected(rows[0]?.name || '');
    }).catch(() => Alert.alert('Accounts unavailable', 'Unable to load RedCoins accounts. Open LeanLog and try again.')).finally(() => setLoading(false));
  }, []);
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await saveWidgetAccount(widgetInfo.widgetId, selected);
      const account = accounts.find((row) => row.name === selected) || null;
      renderWidget(<AccountSnapshotWidget account={account} updated={widgetUpdatedTime()} />);
      setResult('ok');
    } catch (error) {
      console.error('Account widget configuration failed', error);
      Alert.alert('Widget could not be added', 'Please try adding the account widget again.');
    } finally {
      setSaving(false);
    }
  };
  return <View style={s.screen}>
    <Text style={s.eyebrow}>LEANLOG / WIDGET</Text>
    <Text style={s.title}>Choose an account.</Text>
    <Text style={s.body}>This widget instance will stay attached to the account you choose.</Text>
    {loading ? <ActivityIndicator color="#EF3F43" /> : <ScrollView style={s.list}>
      {accounts.map((account) => <TouchableOpacity key={account.name} style={[s.row, selected === account.name && s.rowActive]} onPress={() => setSelected(account.name)}>
        <View style={{ flex: 1 }}><Text style={s.name}>{account.name}</Text><Text style={s.meta}>{account.type}</Text></View>
        <Text style={s.balance}>{account.balance < 0 ? '−' : ''}RM {Math.abs(account.balance).toFixed(2)}</Text>
      </TouchableOpacity>)}
      {!accounts.length && <Text style={s.empty}>Open RedCoins and sync your accounts first.</Text>}
    </ScrollView>}
    <View style={s.actions}><TouchableOpacity disabled={saving} style={s.cancel} onPress={() => setResult('cancel')}><Text style={s.cancelText}>CANCEL</Text></TouchableOpacity><TouchableOpacity disabled={!selected || saving} style={[s.save, (!selected || saving) && { opacity: 0.4 }]} onPress={save}><Text style={s.saveText}>{saving ? 'ADDING…' : 'ADD WIDGET'}</Text></TouchableOpacity></View>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF9EA', padding: 22, paddingTop: 54 },
  eyebrow: { color: '#EF3F43', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#172033', fontFamily: 'serif', fontSize: 32, fontWeight: '800', marginTop: 8 },
  body: { color: '#737A84', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 20 },
  list: { flex: 1 },
  row: { minHeight: 65, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#E2D9C9', borderRadius: 16, paddingHorizontal: 15, marginBottom: 8 },
  rowActive: { backgroundColor: '#DDF1E7', borderColor: '#83D8B4' },
  name: { color: '#172033', fontSize: 14, fontWeight: '900' },
  meta: { color: '#737A84', fontSize: 9, marginTop: 3 },
  balance: { color: '#172033', fontSize: 12, fontWeight: '900' },
  empty: { color: '#737A84', textAlign: 'center', marginTop: 30 },
  actions: { flexDirection: 'row', gap: 9, paddingTop: 14 },
  cancel: { flex: 1, borderWidth: 1, borderColor: '#CFC5B5', borderRadius: 15, padding: 14, alignItems: 'center' },
  cancelText: { color: '#737A84', fontWeight: '900' },
  save: { flex: 2, backgroundColor: '#83D8B4', borderRadius: 15, padding: 14, alignItems: 'center' },
  saveText: { color: '#172033', fontWeight: '900' },
});
