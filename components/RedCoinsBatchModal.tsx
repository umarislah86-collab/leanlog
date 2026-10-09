import { ThemeText as Text, ThemeTextInput as TextInput } from '../components/ThemePrimitives';
import { useTheme, useThemeStyles } from '../context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { RedCoinsEntry, RedCoinsState } from '../services/redcoins';
import type { BatchAction } from '../services/redcoinsBatch';
import { loggerCategories } from '../services/redcoinsLogger';

type Kind = BatchAction['kind'] | 'copy' | 'paste';
const actions: { kind: Kind; title: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { kind: 'name', title: 'Change title', icon: 'text-outline' }, { kind: 'date', title: 'Change date', icon: 'calendar-outline' },
  { kind: 'amount', title: 'Change amount', icon: 'calculator-outline' }, { kind: 'account', title: 'Change accounts', icon: 'wallet-outline' },
  { kind: 'category', title: 'Change category', icon: 'grid-outline' }, { kind: 'labels', title: 'Manage labels', icon: 'pricetags-outline' },
  { kind: 'status', title: 'Set status / reconcile', icon: 'checkmark-done-outline' }, { kind: 'copy', title: 'Copy transactions', icon: 'copy-outline' },
  { kind: 'paste', title: 'Paste copied transactions', icon: 'duplicate-outline' }, { kind: 'delete', title: 'Delete permanently', icon: 'trash-outline' },
];
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function RedCoinsBatchModal({ visible, state, entries, copiedCount, pasteOnly, busy, close, apply, copy, paste }: {
  visible: boolean; state: RedCoinsState; entries: RedCoinsEntry[]; copiedCount: number; pasteOnly: boolean; busy: boolean;
  close: () => void; apply: (action: BatchAction) => void; copy: () => void; paste: (day: string | null) => void;
}) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  const [kind, setKind] = useState<Kind | null>(null);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [preserveDates, setPreserveDates] = useState(false);
  const [account, setAccount] = useState('');
  const [destination, setDestination] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [labelsMode, setLabelsMode] = useState<'add' | 'replace' | 'remove' | 'clear'>('add');
  const [status, setStatus] = useState<NonNullable<RedCoinsEntry['status']>>('cleared');
  const [picker, setPicker] = useState<'source' | 'destination' | 'category' | null>(null);
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!visible) return;
    setKind(pasteOnly ? 'paste' : null); setValue(''); setDate(new Date()); setDateOpen(false); setPreserveDates(false);
    setAccount(''); setDestination(''); setCategory(''); setSubcategory(''); setLabelsMode('add'); setStatus('cleared'); setPicker(null); setSearch('');
  }, [visible, pasteOnly]);
  const types = new Set(entries.map(entry => entry.type));
  const canChangeCategory = types.size === 1 && !types.has('transfer');
  const hasTransfers = types.has('transfer');
  const categoryChoices = canChangeCategory ? loggerCategories(state.categories, state.entries, entries[0].type) : [];
  const chooseAction = (action: Kind) => { setValue(''); setKind(action); setPicker(null); };
  const choosePicker = (next: typeof picker) => { setPicker(next); setSearch(''); };
  const submit = () => {
    if (kind === 'copy') return copy();
    if (kind === 'paste') return paste(preserveDates ? null : dayKey(date));
    if (kind === 'delete') return apply({ kind });
    if (kind === 'name') return apply({ kind, value });
    if (kind === 'amount') return apply({ kind, value: Number(value) });
    if (kind === 'date') return apply({ kind, day: dayKey(date) });
    if (kind === 'account') return apply({ kind, account, toAccount: destination || undefined });
    if (kind === 'category') return apply({ kind, category, subcategory });
    if (kind === 'labels') return apply({ kind, mode: labelsMode, labels: value.split(',').map(label => label.trim()).filter(Boolean) });
    if (kind === 'status') return apply({ kind, value: status });
  };
  const ready = !!kind && !busy && (kind !== 'name' && kind !== 'amount' || !!value.trim()) && (kind !== 'account' || !!account || hasTransfers && !!destination) && (kind !== 'category' || !!subcategory) && (kind !== 'paste' || copiedCount > 0) && (kind !== 'labels' || labelsMode === 'clear' || !!value.trim());
  const row = (label: string, selected: boolean, onPress: () => void, meta?: string) => <TouchableOpacity key={label} style={[s.row, selected && s.active]} onPress={onPress} disabled={busy}>
    <View style={{ flex: 1 }}><Text style={s.label}>{label}</Text>{meta ? <Text style={s.meta}>{meta}</Text> : null}</View><Ionicons name={selected ? 'checkmark-circle' : 'chevron-forward'} size={19} color={selected ? themed('#168A65', 'color') : themed('#7C8290', 'color')} />
  </TouchableOpacity>;
  const title = picker ? picker === 'category' ? 'Choose category' : picker === 'source' ? 'Choose source account' : 'Choose destination' : kind ? actions.find(action => action.kind === kind)?.title : 'Selection actions';
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) close(); }}>
    <KeyboardAvoidingView style={s.shade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={s.fill} onPress={() => { if (!busy) close(); }}><Pressable style={s.sheet} onPress={() => {}}>
        <View style={s.grab} /><View style={s.header}>
          {(kind && !pasteOnly || picker) && <TouchableOpacity disabled={busy} onPress={() => { if (picker) setPicker(null); else setKind(null); }} style={s.close}><Ionicons name="arrow-back" size={21} color={themed("#111A2A", 'color')} /></TouchableOpacity>}
          <Text style={s.title}>{title}</Text><TouchableOpacity disabled={busy} onPress={close} style={s.close} accessibilityLabel="Close batch actions"><Ionicons name="close" size={22} color={themed("#111A2A", 'color')} /></TouchableOpacity>
        </View>
        <Text style={s.hint}>{kind === 'paste' ? `${copiedCount} copied transactions · creates new entries` : `${entries.length} selected · changes affect every selected entry`}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
          {picker ? <View>
            <TextInput placeholder="Search…" value={search} onChangeText={setSearch} style={s.input} autoFocus />
            {picker === 'category' ? categoryChoices.map(group => <View key={group.id}>
              <Text style={s.group}>{group.name}</Text>{group.subcategories.filter(sub => `${group.name} ${sub}`.toLowerCase().includes(search.toLowerCase())).map(sub => row(sub, category === group.name && subcategory === sub, () => { setCategory(group.name); setSubcategory(sub); setPicker(null); }, group.name))}
            </View>) : <View>
              {picker === 'source' && row('Keep each current source', !account, () => { setAccount(''); setPicker(null); })}
              {picker === 'destination' && row('Keep each current destination', !destination, () => { setDestination(''); setPicker(null); })}
              {state.accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).map(a => row(a.name, (picker === 'source' ? account : destination) === a.name, () => { if (picker === 'source') setAccount(a.name); else setDestination(a.name); setPicker(null); }, a.type))}
            </View>}
          </View> : !kind ? actions.map(action => {
            const disabled = action.kind === 'category' && !canChangeCategory || action.kind === 'paste' && !copiedCount;
            return <TouchableOpacity key={action.kind} style={[s.row, disabled && { opacity: 0.4 }]} disabled={disabled || busy} onPress={() => chooseAction(action.kind)}>
              <Ionicons name={action.icon} size={20} color={action.kind === 'delete' ? themed('#F04444', 'color') : themed('#111A2A', 'color')} style={{ marginRight: 12 }} /><View style={{ flex: 1 }}><Text style={[s.label, action.kind === 'delete' && { color: themed('#F04444', 'color') }]}>{action.title}</Text>{action.kind === 'category' && !canChangeCategory ? <Text style={s.meta}>Select expenses only or incomes only.</Text> : null}</View><Ionicons name="chevron-forward" size={17} color={themed("#7C8290", 'color')} />
            </TouchableOpacity>;
          }) : <View>
            {(kind === 'name' || kind === 'amount') && <TextInput value={value} onChangeText={setValue} placeholder={kind === 'name' ? 'New title for all selected entries' : 'New amount for each entry'} keyboardType={kind === 'amount' ? 'decimal-pad' : 'default'} autoFocus style={s.input} editable={!busy} />}
            {kind === 'amount' && <Text style={s.hint}>This sets the same amount on EACH entry, not a shared total.</Text>}
            {(kind === 'date' || kind === 'paste') && <View>
              {kind === 'paste' && row('Keep original dates', preserveDates, () => setPreserveDates(!preserveDates))}
              {!preserveDates && row(date.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }), true, () => setDateOpen(true), 'Tap to choose date · original time is preserved')}
              {dateOpen && <DateTimePicker value={date} mode="date" onChange={(event, next) => { setDateOpen(Platform.OS === 'ios'); if (event.type !== 'dismissed' && next) setDate(next); }} />}
            </View>}
            {kind === 'account' && <View>{row(account || 'Keep each current source', !!account, () => choosePicker('source'), 'Tap to choose a different source account')}{hasTransfers && row(destination || 'Keep each current destination', !!destination, () => choosePicker('destination'), 'Transfers only · source and destination must differ')}</View>}
            {kind === 'category' && row(subcategory || 'Choose category', !!subcategory, () => choosePicker('category'), category)}
            {kind === 'labels' && <View>
              {(['add', 'replace', 'remove', 'clear'] as const).map(mode => row({ add: 'Add labels', replace: 'Replace all existing labels', remove: 'Remove these labels', clear: 'Remove all labels' }[mode], labelsMode === mode, () => setLabelsMode(mode)))}
              {labelsMode !== 'clear' && <TextInput style={s.input} value={value} onChangeText={setValue} placeholder="Labels separated by commas" editable={!busy} />}
            </View>}
            {kind === 'status' && <View>{(['none', 'pending', 'cleared', 'reconciled'] as const).map(value => row(value === 'none' ? 'None / no review status' : value[0].toUpperCase() + value.slice(1), status === value, () => setStatus(value)))}<Text style={s.hint}>Status records review state. It does not create another payment or change the transaction amount.</Text></View>}
            {kind === 'copy' && <Text style={s.hint}>Keeps a reusable copy inside LeanLog, even if you close the app. Your original transactions are unchanged.</Text>}
            {kind === 'paste' && <Text style={s.hint}>Each copy gets a new ID. Reminder schedules, export flags and reconciliation links are NOT duplicated.</Text>}
            {kind === 'delete' && <Text style={[s.hint, { color: themed('#F04444', 'color') }]}>Deletes these entries permanently and reverses their account effects. This does not cancel an associated recurring schedule.</Text>}
          </View>}
        </ScrollView>
        {kind && !picker && <TouchableOpacity disabled={!ready} onPress={submit} style={[s.apply, kind === 'delete' && { backgroundColor: themed('#F04444', 'backgroundColor') }, !ready && { opacity: 0.4 }]}>{busy ? <ActivityIndicator color={themed("#FFF9EA", 'color')} /> : <Text style={s.applyText}>{kind === 'copy' ? 'COPY' : kind === 'paste' ? 'REVIEW PASTE' : 'REVIEW CHANGE'}</Text>}</TouchableOpacity>}
      </Pressable></Pressable>
    </KeyboardAvoidingView>
  </Modal>;
}
const baseS = StyleSheet.create({
  shade: { flex: 1, backgroundColor: 'rgba(6,10,18,.72)' }, fill: { flex: 1, justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: '#FFF9EA', borderRadius: 26, padding: 18, maxHeight: '92%' },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D6CEBE', alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 }, title: { fontFamily: 'serif', fontSize: 23, fontWeight: '800', color: '#111A2A', flex: 1 },
  close: { padding: 5 }, hint: { color: '#7C8290', fontSize: 12, lineHeight: 18, marginVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#E2D9C8', minHeight: 51 },
  active: { backgroundColor: '#DDF1E7', borderRadius: 10 }, label: { fontSize: 13, fontWeight: '700', color: '#111A2A' }, meta: { fontSize: 10, color: '#7C8290', marginTop: 4 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9D3C6', borderRadius: 12, padding: 14, fontSize: 16, color: '#111A2A', marginVertical: 8 },
  group: { color: '#7C8290', fontSize: 13, fontWeight: '800', marginTop: 17 },
  apply: { backgroundColor: '#111A2A', padding: 16, borderRadius: 13, alignItems: 'center', marginTop: 8 }, applyText: { color: '#FFF9EA', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
});
