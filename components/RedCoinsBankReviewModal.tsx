import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RedCoinsAccount, RedCoinsState } from '../services/redcoins';
import { accountMovement, bankReviewProjection, reviewSignature, type BankReview } from '../services/redcoinsReconciliation';

const money = (value: number) => `${value < 0 ? '−' : ''}RM ${Math.abs(value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function RedCoinsBankReviewModal({ account, state, close, save }: { account: RedCoinsAccount | null; state: RedCoinsState; close: () => void; save: (accountId: string, review: BankReview) => Promise<void> }) {
  const [draft, setDraft] = useState<BankReview>({ startDay: '', endDay: '', bankBalance: '', matched: {}, savedAt: '' });
  const [search, setSearch] = useState('');
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!account) return;
    const today = new Date();
    setDraft(state.bankReviews?.[account.id] || { startDay: day(new Date(today.getFullYear(), today.getMonth(), 1)), endDay: day(today), bankBalance: '', matched: {}, savedAt: '' });
    setSearch(''); setUnmatchedOnly(false); setDirty(false);
  }, [account?.id]);
  const projection = useMemo(() => account ? bankReviewProjection(state, account, draft) : null, [state, account, draft]);
  const leave = () => {
    if (busy) return;
    if (!dirty) { close(); return; }
    Alert.alert('Leave bank review?', 'Unsaved changes will be discarded. Save progress to resume later.', [{ text: 'Keep reviewing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: close }]);
  };
  const update = (patch: Partial<BankReview>) => { setDirty(true); setDraft(current => ({ ...current, ...patch })); };
  const finish = async () => {
    if (!account || !projection) return;
    if (draft.bankBalance.trim() && projection.bankBalance === null) { Alert.alert('Invalid balance', 'Enter a signed amount without RM or commas, for example 1856.97 or -961.00.'); return; }
    setBusy(true);
    try { await save(account.id, { ...draft, savedAt: new Date().toISOString() }); setDirty(false); close(); }
    catch { Alert.alert('Could not save review', 'Please try again.'); }
    finally { setBusy(false); }
  };
  const rows = projection?.rows.filter(row => (!unmatchedOnly || draft.matched[row.id] !== reviewSignature(row)) && `${row.item} ${row.amount} ${row.note || ''}`.toLowerCase().includes(search.trim().toLowerCase())) || [];
  return <Modal visible={!!account} animationType="slide" onRequestClose={leave}>
    <SafeAreaView style={s.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.head}><TouchableOpacity onPress={leave} accessibilityLabel="Close bank review"><Ionicons name="arrow-back" size={24} color="#111A2A" /></TouchableOpacity><View style={{ flex: 1 }}><Text style={s.eyebrow}>SEMAK DENGAN BANK</Text><Text style={s.title}>{account?.name}</Text></View><TouchableOpacity disabled={busy || !projection} onPress={() => { void finish(); }}><Text style={s.action}>{busy ? 'SAVING…' : 'SAVE'}</Text></TouchableOpacity></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18 }}>
        <Text style={s.hint}>Compare with your banking app side by side. Ticks only save review progress; they never change balances or transaction status.</Text>
        <View style={s.dates}>{(['startDay', 'endDay'] as const).map(key => <View key={key} style={{ flex: 1 }}><Text style={s.label}>{key === 'startDay' ? 'FROM' : 'AS OF · END OF DAY'}</Text><TextInput editable={!busy} style={s.input} value={draft[key]} placeholder="YYYY-MM-DD" onChangeText={value => update({ [key]: value })} autoCorrect={false} /></View>)}</View>
        <Text style={s.label}>BANK BALANCE · RM</Text><TextInput editable={!busy} style={s.input} value={draft.bankBalance} placeholder="Enter balance shown by bank" onChangeText={bankBalance => update({ bankBalance })} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} />
        <Text style={s.hint}>Use a negative balance for card debt/loans. Compare the same posted/current balance, not available credit or a balance including pending authorisations.</Text>
        {projection ? <View style={s.summary}><Text style={s.label}>REDCOINS BALANCE AT THIS DATE</Text><Text style={s.value}>{money(projection.ledgerBalance)}</Text><Text style={s.label}>DIFFERENCE · BANK − REDCOINS</Text><Text style={[s.value, { color: projection.difference === 0 ? '#168A65' : '#C14335' }]}>{projection.difference === null ? 'Enter bank balance' : money(projection.difference)}</Text><Text style={s.hint}>{projection.matchedCount} matched · {projection.remainingCount} unchecked</Text><Text style={s.hint}>{projection.difference === 0 ? 'Balances tally. Check the transactions too; equal totals can hide offsetting mistakes.' : 'Ticking a row does not reduce this difference. Correct any missing/wrong entry separately in the ledger, then review again.'}</Text></View> : <Text style={s.error}>Enter valid YYYY-MM-DD dates, with From on/before As of. Neither date can be in the future.</Text>}
        <Text style={s.hint}>Today is checked up to now; future transactions are excluded. Historical balances rewind your saved current balance, so incorrect opening balances or dates can still cause a mismatch.</Text>
        <TextInput style={s.input} value={search} onChangeText={setSearch} placeholder="Find title or amount…" autoCorrect={false} />
        <TouchableOpacity style={s.toggle} onPress={() => setUnmatchedOnly(value => !value)}><Ionicons name={unmatchedOnly ? 'checkbox' : 'square-outline'} size={20} color="#111A2A" /><Text style={s.name}>Only unchecked</Text></TouchableOpacity>
        {rows.map(row => {
          const matched = draft.matched[row.id] === reviewSignature(row);
          const movement = account ? accountMovement(row, account) / 100 : 0;
          return <Pressable key={row.id} disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: matched }} style={[s.row, matched && { backgroundColor: '#E4F3EB' }]} onPress={() => { setDirty(true); setDraft(current => { const next = { ...current.matched }; if (matched) delete next[row.id]; else next[row.id] = reviewSignature(row); return { ...current, matched: next }; }); }}>
            <Ionicons name={matched ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={matched ? '#168A65' : '#7C8290'} /><View style={{ flex: 1 }}><Text style={s.name}>{row.item}</Text><Text style={s.hint}>{new Date(row.date).toLocaleString('en-MY')} · {row.type === 'transfer' ? `${row.account} → ${row.toAccount}` : row.subcategory || row.category}</Text></View><Text style={{ color: movement < 0 ? '#C14335' : '#168A65', fontWeight: '700' }}>{money(movement)}</Text>
          </Pressable>;
        })}
        {!rows.length && <Text style={s.hint}>No transactions match this view.</Text>}
        {!!draft.savedAt && <Text style={s.hint}>Last saved {new Date(draft.savedAt).toLocaleString('en-MY')}. Changed transactions need checking again.</Text>}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}
const s = StyleSheet.create({ page: { flex: 1, backgroundColor: '#FFF9EA' }, head: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderBottomWidth: 1, borderBottomColor: '#E1DCCF' }, eyebrow: { fontSize: 9, letterSpacing: 1, fontWeight: '800', color: '#F04444' }, title: { fontFamily: 'serif', fontSize: 23, color: '#111A2A', marginTop: 4 }, action: { color: '#168A65', fontSize: 12, fontWeight: '800' }, hint: { color: '#7C8290', fontSize: 11, lineHeight: 17, marginVertical: 5 }, label: { color: '#7C8290', fontSize: 9, fontWeight: '800', marginTop: 12, marginBottom: 6 }, input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1DCCF', borderRadius: 13, padding: 13, color: '#111A2A', marginVertical: 5 }, dates: { flexDirection: 'row', gap: 10 }, summary: { backgroundColor: '#F3EDDF', borderRadius: 18, padding: 15, marginVertical: 12 }, value: { fontSize: 24, color: '#111A2A', fontWeight: '800' }, error: { color: '#C14335', marginVertical: 12 }, toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: '#E1DCCF', backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 5 }, name: { color: '#111A2A', fontSize: 12, fontWeight: '700' } });
