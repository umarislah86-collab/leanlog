import { ThemeText as Text } from '../components/ThemePrimitives';
import { useTheme, useThemeStyles } from '../context/ThemeContext';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { analyseRedCoins, simulateRedCoinsCuts } from '../services/redcoinsAnalysis';
import { AI_REDUCTION_TARGETS, type AiPromptScope } from '../services/redcoinsAiPrompt';
import type { RedCoinsEntry, RedCoinsState } from '../services/redcoins';

const money = (value: number) => `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type ExpenseClass = 'protected' | 'flexible' | 'unconfirmed';
export function RedCoinsAnalysis({ state, scope, classify, inspect, openSubcategory }: { state: RedCoinsState; scope: AiPromptScope; classify: (key: string, value: ExpenseClass) => Promise<void>; inspect: (entry: RedCoinsEntry) => void; openSubcategory: (category: string, subcategory: string, window: { start: number; endExclusive: number; actualThrough: number }) => void }) {
  const s = useThemeStyles(baseS);
  const { themed } = useTheme();
  const [lookback, setLookback] = useState<3 | 6>(3);
  const [target, setTarget] = useState(10);
  const [cuts, setCuts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const start = scope.start.getTime();
  // An ongoing report's exact end advances on every ledger change; that is not a new report.
  const endDay = new Date(scope.endExclusive.getTime() - 1).toDateString();
  useEffect(() => { setCuts({}); setDetail(null); }, [start, endDay, scope.mode, scope.salarySource?.label]);
  const analysis = useMemo(() => analyseRedCoins(state, scope, lookback), [state, scope, lookback]);
  useEffect(() => {
    const flexible = new Set(analysis.groups.filter(group => group.classification === 'flexible').map(group => group.key));
    setCuts(current => Object.keys(current).some(key => !flexible.has(key)) ? Object.fromEntries(Object.entries(current).filter(([key]) => flexible.has(key))) : current);
  }, [analysis.groups]);
  const simulation = useMemo(() => simulateRedCoinsCuts(analysis, target, cuts), [analysis, target, cuts]);
  const charges = (rows: RedCoinsEntry[]) => rows.map(row => <TouchableOpacity key={row.id} style={s.charge} onPress={() => inspect(row)}><View style={{ flex: 1 }}><Text style={s.name}>{row.item}</Text><Text style={s.hint}>{new Date(row.date).toLocaleDateString('en-MY')} · {row.account}</Text></View><Text style={s.amount}>{money(row.amount)}</Text></TouchableOpacity>);
  const header = (key: string, title: string, hint: string) => <TouchableOpacity style={s.section} onPress={() => { setOpen(value => value === key ? null : key); setDetail(null); }}><View style={{ flex: 1 }}><Text style={s.sectionTitle}>{title}</Text><Text style={s.hint}>{hint}</Text></View><Ionicons name={open === key ? 'chevron-up' : 'chevron-down'} size={17} color={themed("#7C8290", 'color')} /></TouchableOpacity>;
  const saveClass = async (key: string, value: ExpenseClass) => {
    if (busy) return;
    setBusy(true);
    try { await classify(key, value); }
    catch { Alert.alert('Classification not saved', 'Please try again.'); }
    finally { setBusy(false); }
  };
  const picker = (value: number, change: (value: number) => void, choices: readonly number[], suffix: string) => <View style={s.picker}><Picker style={s.pickerText} dropdownIconColor="#111A2A" selectedValue={value} onValueChange={next => change(Number(next))}>{choices.map(choice => <Picker.Item key={choice} color={themed("#111A2A", 'color')} value={choice} label={`${choice}${suffix}`} />)}</Picker></View>;
  return <View style={s.card}>
    <Text style={s.eyebrow}>ANALYSIS / THIS REPORT</Text>
    <Text style={s.title}>Read the pattern.</Text>
    <View style={s.totals}><Text style={s.hint}>TOTAL OUTGOINGS · EXPENSE + LOAN PAYMENTS</Text><Text style={s.total}>{money(analysis.metrics.spendingIncludingLoanRepayments)}</Text><Text style={s.hint}>Expense {money(analysis.metrics.expense)} · Loan {money(analysis.metrics.loanRepayments)}</Text><Text style={s.hint}>Income left after both: {money(analysis.metrics.netAfterExpensesAndLoanRepayments)}. Not an account balance.</Text></View>
    <Text style={s.label}>COMPARE WITH PREVIOUS COMPLETED PERIODS</Text>
    {picker(lookback, value => setLookback(value as 3 | 6), [3, 6], ' periods')}
    <View style={s.pulse}><Text style={s.sectionTitle}>Cycle pulse</Text>{analysis.pulse.rate ? <><Text style={s.pulseValue}>{money(analysis.pulse.rate.current)} / day</Text><Text style={s.hint}>Baseline {money(analysis.pulse.rate.baseline)} / day{analysis.pulse.deltaPercent !== null ? ` · ${analysis.pulse.deltaPercent >= 0 ? '+' : ''}${analysis.pulse.deltaPercent.toFixed(0)}%` : ' · no non-zero baseline'}</Text></> : <Text style={s.hint}>Not enough completed history for a fair comparison.</Text>}<Text style={s.hint}>{analysis.pulse.method}{analysis.pulse.matchedDays !== null ? ` · first ${analysis.pulse.matchedDays.toFixed(1)} days` : ''}. Expense only; loans remain separate above.</Text><Text style={s.hint}>{analysis.baselinePeriods}/{lookback} available periods. Missing records can affect the result.</Text></View>
    {header('changes', 'What changed', 'Category shifts · comparable daily rates')}
    {open === 'changes' && <View style={s.details}>{analysis.changes.map(change => <View key={change.category}>
      <TouchableOpacity style={s.row} accessibilityRole="button" accessibilityState={{ expanded: detail === change.category }} onPress={() => setDetail(value => value === change.category ? null : change.category)}><View style={{ flex: 1 }}><Text style={s.categoryName}>{change.category}</Text><Text style={s.hint}>Now {money(change.currentDaily)}/day · before {money(change.baselineDaily)}/day</Text></View><Text style={[s.amount, { color: change.deltaDaily > 0 ? themed('#C14335', 'color') : themed('#168A65', 'color') }]}>{change.deltaDaily >= 0 ? '+' : '−'}{money(Math.abs(change.deltaDaily))}/day</Text><Ionicons name={detail === change.category ? 'chevron-up' : 'chevron-down'} size={16} color={themed("#7C8290", 'color')} /></TouchableOpacity>
      {detail === change.category && <View style={s.subcategoryGroup}>
        <Text style={s.subcategoryLabel}>SUBCATEGORIES · TAP TO VIEW LEDGER</Text>
        {analysis.subcategoryChanges.filter(part => part.category === change.category).map(part => <TouchableOpacity key={part.subcategory} style={s.subcategoryRow} accessibilityRole="button" accessibilityLabel={`Show ${change.category}, ${part.subcategory || 'No subcategory'} transactions in ledger`} onPress={() => openSubcategory(change.category, part.subcategory, analysis.comparisonWindow)}><View style={{ flex: 1 }}><Text style={s.subcategoryName}>{part.subcategory || 'No subcategory'}</Text><Text style={s.subcategoryHint}>Now {money(part.currentDaily)}/day · before {money(part.baselineDaily)}/day</Text><Text style={s.subcategoryHint}>{part.transactionIds.length} current entries</Text></View><Text style={[s.subcategoryAmount, { color: part.deltaDaily > 0 ? themed('#C14335', 'color') : themed('#168A65', 'color') }]}>{part.deltaDaily >= 0 ? '+' : '−'}{money(Math.abs(part.deltaDaily))}/day</Text><Ionicons name="chevron-forward" size={14} color={themed("#7C8290", 'color')} /></TouchableOpacity>)}
        <Text style={s.subcategoryHint}>Ledger opens current entries in the compared span, not baseline history or necessarily the entire report.</Text>
      </View>}
    </View>)}{!analysis.changes.length && <Text style={s.hint}>No comparable category history yet.</Text>}</View>}
    {header('repeated', 'Repeated charges', `${analysis.repeatedCharges.length} repeated titles · not assumed subscriptions`)}
    {open === 'repeated' && <View style={s.details}>{analysis.repeatedCharges.map(group => {
      const key = JSON.stringify([group.title, group.category, group.subcategory]);
      return <View key={key}><TouchableOpacity style={s.row} onPress={() => setDetail(value => value === key ? null : key)}><View style={{ flex: 1 }}><Text style={s.name}>{group.title}</Text><Text style={s.hint}>{group.count} entries · {group.subcategory}</Text></View><Text style={s.amount}>{money(group.amount)}</Text></TouchableOpacity>{detail === key && charges(group.entries)}</View>;
    })}{!analysis.repeatedCharges.length && <Text style={s.hint}>No repeated expense titles in this report.</Text>}<Text style={s.hint}>Repeated names are not proof of duplicates. Inspect the charges before changing anything.</Text></View>}
    {header('classes', 'Commitments & choices', 'You decide what is flexible; loans stay protected')}
    {open === 'classes' && <View style={s.details}><Text style={s.hint}>Protected {money(analysis.classificationTotals.protected)} · Flexible {money(analysis.classificationTotals.flexible)} · Unconfirmed {money(analysis.classificationTotals.unconfirmed)}</Text>{analysis.loanEntries.length > 0 && <><Text style={s.label}>LOAN REPAYMENTS · ALWAYS PROTECTED</Text>{charges(analysis.loanEntries)}</>}{analysis.groups.map(group => <View key={group.key} style={s.classRow}><Text style={s.name}>{group.subcategory || group.category} · {money(group.amount)}</Text><Text style={s.hint}>{group.category}</Text><View style={s.picker}><Picker style={s.pickerText} dropdownIconColor="#111A2A" enabled={!busy} selectedValue={group.classification} onValueChange={value => { void saveClass(group.key, value as ExpenseClass); }}><Picker.Item color={themed("#111A2A", 'color')} label="Unconfirmed · no assumed cut" value="unconfirmed" /><Picker.Item color={themed("#111A2A", 'color')} label="Protected · do not cut" value="protected" /><Picker.Item color={themed("#111A2A", 'color')} label="Flexible · allow simulation" value="flexible" /></Picker></View></View>)}</View>}
    {header('simulator', 'Cut simulator', 'Read-only scenario · never changes your budget')}
    {open === 'simulator' && <View style={s.details}><Text style={s.label}>TARGET · EXPENSE ONLY, LOANS EXCLUDED FROM CUTS</Text>{picker(target, setTarget, AI_REDUCTION_TARGETS, '% reduction')}<Text style={s.hint}>Target {money(simulation.targetAmount)} · selected cuts {money(simulation.saving)} · gap {money(simulation.gap)}</Text><Text style={s.hint}>Expense after proposed cuts: {money(simulation.projectedExpense)}. These are arithmetic scenarios, not guaranteed savings.</Text>{simulation.proposals.map(group => <View key={group.key} style={s.classRow}><Text style={s.name}>{group.subcategory || group.category} · {money(group.amount)}</Text><Text style={s.hint}>{group.category} · proposed saving {money(group.saving)}</Text>{picker(group.percent, value => setCuts(current => ({ ...current, [group.key]: value })), [0, ...AI_REDUCTION_TARGETS], '% cut')}</View>)}{!simulation.proposals.length && <Text style={s.hint}>Open Commitments & choices and confirm at least one expense subcategory as Flexible. Nothing is selected for cutting by default.</Text>}<Text style={s.hint}>Any gap stays visible. The app will not force cuts onto protected commitments to meet the target.</Text></View>}
    <Text style={s.footnote}>{analysis.warnings.join('\n')}</Text>
  </View>;
}

const baseS = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1DCCF', borderRadius: 23, padding: 18, marginBottom: 12 },
  eyebrow: { color: '#F04444', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#111A2A', fontFamily: 'serif', fontSize: 26, fontWeight: '800', marginTop: 6 },
  totals: { backgroundColor: '#F3EDDF', borderRadius: 17, padding: 14, marginTop: 15 },
  total: { color: '#111A2A', fontFamily: 'serif', fontSize: 27, fontWeight: '800', marginTop: 5 },
  hint: { color: '#7C8290', fontSize: 10, lineHeight: 16, marginTop: 4 },
  label: { color: '#7C8290', fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginTop: 14, marginBottom: 5 },
  picker: { backgroundColor: '#FFF9EA', borderWidth: 1, borderColor: '#E1DCCF', borderRadius: 13, marginTop: 5, overflow: 'hidden' },
  pickerText: { color: '#111A2A', fontSize: 12 },
  pulse: { paddingVertical: 14 },
  pulseValue: { color: '#111A2A', fontSize: 21, fontWeight: '800', marginTop: 7 },
  section: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#E7E1D5' },
  sectionTitle: { color: '#111A2A', fontSize: 14, fontWeight: '800' },
  details: { padding: 11, backgroundColor: '#FFF9EA', borderRadius: 15, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E7E1D5' },
  name: { color: '#111A2A', fontSize: 12, fontWeight: '800' },
  categoryName: { color: '#111A2A', fontSize: 14, fontWeight: '800' },
  subcategoryGroup: { marginLeft: 12, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#DED6C6', marginBottom: 12 },
  subcategoryLabel: { color: '#8A8272', fontSize: 8, fontWeight: '700', letterSpacing: 0.6, marginTop: 10 },
  subcategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E7E1D5' },
  subcategoryName: { color: '#485260', fontSize: 11, fontWeight: '600' },
  subcategoryHint: { color: '#7C8290', fontSize: 9, lineHeight: 14, marginTop: 3 },
  subcategoryAmount: { fontSize: 10, fontWeight: '600' },
  amount: { color: '#111A2A', fontSize: 11, fontWeight: '800' },
  charge: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E7E1D5' },
  classRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E7E1D5' },
  footnote: { color: '#8A8272', fontSize: 9, lineHeight: 15, marginTop: 7 },
});
