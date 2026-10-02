import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';
import { AccountSnapshotWidget, type WidgetAccount } from './RedCoinsWidgets';
import { getWidgetAccounts, saveWidgetAccount, widgetUpdatedTime } from './redcoins-widget-data';

export function WidgetConfigurationScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
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
