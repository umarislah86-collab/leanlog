import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { RedCoinsCategory, RedCoinsState } from '../services/redcoins';
import { budgetDay, parseBudgetDay, termBudgetSummary, validTermBudget, type TermBudget } from '../services/redcoinsTermBudget';

const money = (v: number) => `RM ${v.toFixed(2)}`;
export function RedCoinsTermBudgets({ state, categories, save }: { state: RedCoinsState; categories: RedCoinsCategory[]; save: (budgets: TermBudget[]) => Promise<void> }) {
  const [draft, setDraft] = useState<TermBudget | null>(null), [amount, setAmount] = useState(''), [busy, setBusy] = useState(false);
  const edit = (budget?: TermBudget) => {
    const start = new Date(); start.setDate(1);
    setDraft(budget ? { ...budget } : { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, category: categories[0]?.name || '', amount: 0, startDay: budgetDay(start), endDay: budgetDay(new Date(start.getFullYear(),start.getMonth()+2,0)), months: 2, repeat: true, carryForward: false, reserve: false });
    setAmount(budget ? String(budget.amount) : '');
  };
  const field = (label: string, value: string, change: (v: string) => void, numeric = false) => <View style={{marginVertical:8}}><Text style={s.meta}>{label}</Text><TextInput style={s.input} value={value} onChangeText={change} keyboardType={numeric ? 'decimal-pad' : 'default'} /></View>;
  const submit = async (remove = false) => {
    if (!draft || busy) return;
    const next = { ...draft, amount: Number(amount) };
    if (next.months) {
      const start = parseBudgetDay(next.startDay);
      if (start) {
        const boundary = new Date(start.getFullYear(),start.getMonth()+next.months,1);
        boundary.setDate(Math.min(start.getDate(),new Date(boundary.getFullYear(),boundary.getMonth()+1,0).getDate()));
        boundary.setDate(boundary.getDate()-1); next.endDay = budgetDay(boundary);
      }
    }
    if (!remove && !validTermBudget(next)) return Alert.alert('Check budget', 'Choose a category, positive amount and valid YYYY-MM-DD dates (end must be on or after start).');
    if (!remove && !categories.some(c => c.name === next.category && (!next.subcategory || c.subcategories.includes(next.subcategory)))) return Alert.alert('Choose category', 'This category or subcategory no longer exists.');
    setBusy(true);
    try { await save([...(state.termBudgets || []).filter(b => b.id !== next.id), ...(remove ? [] : [next])]); setDraft(null); }
    catch (error) { Alert.alert('Could not save', String(error)); } finally { setBusy(false); }
  };
  return <View style={s.card}>
    <View style={s.row}><View style={{flex:1}}><Text style={s.title}>Budgets beyond one cycle</Text><Text style={s.meta}>Independent limits · no automatic expense or cash deduction</Text></View><TouchableOpacity onPress={() => edit()}><Text style={s.action}>+ BUDGET</Text></TouchableOpacity></View>
    {!(state.termBudgets || []).length && <Text style={s.meta}>Plan a two-month service, annual bill or one-off date range.</Text>}
    {(state.termBudgets || []).map(b => {
      if (!validTermBudget(b)) return null;
      const total = termBudgetSummary(b,state.entries);
      const exists = categories.some(c => c.name === b.category && (!b.subcategory || c.subcategories.includes(b.subcategory)));
      return <TouchableOpacity key={b.id} style={s.budget} onPress={() => edit(b)}><Text style={s.name}>{b.subcategory ? `${b.category} / ${b.subcategory}` : b.category}</Text>
        <Text style={s.meta}>{total.startDay} — {total.endDay} · {total.status} · {b.repeat ? 'Repeats' : 'Once'}</Text>
        {!exists && <Text style={{color:'#EF4444'}}>Category removed or renamed — edit this budget.</Text>}
        <View style={s.track}><View style={{height:5,width:`${Math.min(100,total.spent/total.limit*100)}%`,backgroundColor:total.remaining < 0 ? '#EF4444' : '#399778'}} /></View>
        <Text style={s.name}>{money(total.spent)} / {money(total.limit)} · {money(total.remaining)} left</Text>
        {total.carry > 0 && <Text style={s.meta}>Includes {money(total.carry)} carried forward</Text>}
        {b.reserve && <Text style={s.meta}>Suggested reserve: {money(total.monthlyReserve)} / month{!b.months ? ' (average)' : ''} · not an expense</Text>}
      </TouchableOpacity>;
    })}
    <Modal visible={!!draft} transparent animationType="fade" onRequestClose={() => !busy && setDraft(null)}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => !busy && setDraft(null)} accessibilityLabel="Close budget editor" />
        {draft && <View style={s.editor}><ScrollView keyboardShouldPersistTaps="handled"><Text style={s.title}>Budget period</Text>
          <Text style={s.meta}>CATEGORY · choose one</Text>
          {categories.map(c => <TouchableOpacity key={c.id} style={s.option} onPress={() => setDraft({...draft, category:c.name,subcategory:undefined})}><Text style={s.name}>{draft.category === c.name ? '● ' : '○ '}{c.name}</Text></TouchableOpacity>)}
          <Text style={s.meta}>SUBCATEGORY · optional</Text>
          {[undefined,...(categories.find(c => c.name === draft.category)?.subcategories || [])].map(sub => <TouchableOpacity key={sub || 'all'} style={s.option} onPress={() => setDraft({...draft,subcategory:sub})}><Text>{draft.subcategory === sub ? '● ' : '○ '}{sub || 'Whole category'}</Text></TouchableOpacity>)}
          {field('TOTAL LIMIT · RM',amount,setAmount,true)}
          <Text style={s.meta}>PERIOD</Text>
          {[1,2,3,6,12,0].map(months => <TouchableOpacity key={months} style={s.option} onPress={() => setDraft({...draft,months:months || undefined})}><Text>{(draft.months || 0) === months ? '● ' : '○ '}{months ? `${months} month${months > 1 ? 's' : ''}` : 'Custom date range'}</Text></TouchableOpacity>)}
          {draft.months && field('MONTHS · 1–120',String(draft.months),v => setDraft({...draft,months:Number(v) || undefined}),true)}
          {field('START · YYYY-MM-DD',draft.startDay,v => setDraft({...draft,startDay:v}))}
          {!draft.months && field('END · YYYY-MM-DD (INCLUSIVE)',draft.endDay,v => setDraft({...draft,endDay:v}))}
          {(['repeat','carryForward','reserve'] as const).map(key => <View key={key} style={s.row}><Text style={{flex:1}}>{key === 'repeat' ? 'Repeat automatically' : key === 'carryForward' ? 'Carry unused balance forward' : 'Show monthly reserve suggestion'}</Text><Switch value={draft[key]} disabled={key === 'carryForward' && !draft.repeat} onValueChange={value => setDraft({...draft,[key]:value})} /></View>)}
          <Text style={s.meta}>Custom repeats use the same number of calendar days. Carry-forward accumulates net unused budget; overspending reduces accumulated carry. Reserve is informational only, never deducted from cash or salary-cycle pool. Avoid overlapping category/subcategory limits unless intentional.</Text>
          <TouchableOpacity disabled={busy} style={s.button} onPress={() => submit()}><Text style={{color:'white'}}>SAVE BUDGET</Text></TouchableOpacity>
          {(state.termBudgets || []).some(b => b.id === draft.id) && <TouchableOpacity disabled={busy} style={s.option} onPress={() => Alert.alert('Delete budget?', 'Transactions are untouched.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:() => submit(true)}])}><Text style={{color:'#EF4444'}}>DELETE BUDGET</Text></TouchableOpacity>}
          <TouchableOpacity disabled={busy} style={s.option} onPress={() => setDraft(null)}><Text>CANCEL</Text></TouchableOpacity>
        </ScrollView></View>}
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
const s = StyleSheet.create({card:{backgroundColor:'#fff',borderRadius:24,padding:20,marginBottom:16},title:{fontSize:22,fontWeight:'700',color:'#111827'},meta:{fontSize:11,color:'#737A85',lineHeight:17,marginVertical:5},row:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:8},action:{fontSize:11,fontWeight:'700',color:'#399778'},name:{fontSize:13,fontWeight:'600',color:'#111827'},budget:{paddingVertical:15,borderTopWidth:1,borderColor:'#E4DFD3'},track:{height:5,backgroundColor:'#E4DFD3',borderRadius:5,overflow:'hidden',marginVertical:10},overlay:{flex:1,justifyContent:'center',backgroundColor:'#0008',padding:20},editor:{maxHeight:'90%',backgroundColor:'#FFF9EA',padding:20,borderRadius:24},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E4DFD3',borderRadius:12,padding:12,color:'#111827'},option:{paddingVertical:10},button:{backgroundColor:'#111827',padding:16,borderRadius:14,alignItems:'center',marginTop:15}});
