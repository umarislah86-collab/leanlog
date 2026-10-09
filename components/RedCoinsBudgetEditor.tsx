import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { RedCoinsState } from '../services/redcoins';
import { budgetDay, parseBudgetDay, validTermBudget, type TermBudget } from '../services/redcoinsTermBudget';
import { targetBudgetChoices } from '../services/redcoinsBudgetSetup';
export type BudgetChoice = { cycle: number } | { period: TermBudget } | null;
export function RedCoinsBudgetEditor({target,state,close,save}:{target:{category:string;subcategory:string}|null;state:RedCoinsState;close:()=>void;save:(choice:BudgetChoice)=>Promise<void>}) {
  const [mode,setMode]=useState('cycle'),[amount,setAmount]=useState(''),[months,setMonths]=useState('2'),[start,setStart]=useState(''),[end,setEnd]=useState(''),[repeat,setRepeat]=useState(true),[carry,setCarry]=useState(false),[reserve,setReserve]=useState(false),[busy,setBusy]=useState(false);
  const choosePeriod=(b:TermBudget)=>{setMode(b.months ? 'months':'custom');setAmount(String(b.amount));setMonths(String(b.months || 2));setStart(b.startDay);setEnd(b.endDay);setRepeat(b.repeat);setCarry(b.carryForward);setReserve(b.reserve);};
  const choices=target ? targetBudgetChoices(state,target.category,target.subcategory):null;
  useEffect(()=>{if (!target) return;const c=targetBudgetChoices(state,target.category,target.subcategory);const date=new Date();date.setDate(1);setStart(budgetDay(date));setEnd(budgetDay(new Date(date.getFullYear(),date.getMonth()+2,0)));setMonths('2');setRepeat(true);setCarry(false);setReserve(false);setAmount(c.cycle ? String(c.cycle):'');setMode(target.subcategory ? 'cycle':'months');if (!c.cycle && c.periods.length === 1) choosePeriod(c.periods[0]);},[target]);
  const submit=async(remove=false)=>{
    if (!target || busy) return;let choice:BudgetChoice=null;
    if (!remove) {
      const value=Number(amount);if (!Number.isFinite(value) || value<=0) return Alert.alert('Check amount','Enter a positive budget, or use Remove budget.');
      if (mode==='cycle') choice={cycle:value};
      else {
        const count=Number(months);const date=parseBudgetDay(start);let last=end;
        if(mode==='months' && date && Number.isInteger(count) && count>=1 && count<=120){const boundary=new Date(date.getFullYear(),date.getMonth()+count,1);boundary.setDate(Math.min(date.getDate(),new Date(boundary.getFullYear(),boundary.getMonth()+1,0).getDate()));boundary.setDate(boundary.getDate()-1);last=budgetDay(boundary);}
        const b:TermBudget={id:choices?.periods[0]?.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,category:target.category,subcategory:target.subcategory || undefined,amount:value,startDay:start,endDay:last,months:mode==='months' ? count:undefined,repeat,carryForward:repeat && carry,reserve};
        if(!validTermBudget(b)) return Alert.alert('Check period','Use valid YYYY-MM-DD dates and an integer interval from 1 to 120 months.');choice={period:b};
      }
    }
    const count=(choices?.cycle ? 1:0)+(choices?.periods.length || 0);
    if(count && !await new Promise<boolean>(resolve=>Alert.alert(remove?'Remove budget?':'Replace existing setup?',`This target has ${count} saved budget setting(s). ${remove?'Remove all settings':'Replace all settings with the one selected here'} for this target only? Transactions and cash balances stay unchanged.`,[{text:'Cancel',style:'cancel',onPress:()=>resolve(false)},{text:remove?'Remove':'Replace',onPress:()=>resolve(true)}],{cancelable:true,onDismiss:()=>resolve(false)}))) return;
    setBusy(true);try{await save(choice);close();}catch(e){Alert.alert('Could not save',String(e));}finally{setBusy(false);}
  };
  const field=(label:string,value:string,onChange:(v:string)=>void,numeric=false)=><View><Text style={s.meta}>{label}</Text><TextInput style={s.input} value={value} onChangeText={onChange} keyboardType={numeric?'decimal-pad':'default'} /></View>;
  return <Modal visible={!!target} transparent animationType="fade" onRequestClose={()=>!busy && close()}><KeyboardAvoidingView style={s.overlay} behavior={Platform.OS==='ios'?'padding':'height'}><Pressable style={StyleSheet.absoluteFill} onPress={()=>!busy && close()}/><View style={s.sheet}><ScrollView keyboardShouldPersistTaps="handled"><Text style={s.title}>{target?.subcategory || target?.category}</Text><Text style={s.meta}>{target?.category} · one saved budget for this target</Text>
    {choices?.conflict && <View style={s.warning}><Text style={s.name}>Existing settings overlap</Text><Text style={s.meta}>Nothing is automatically migrated. Choose which setup to keep below, then Save to confirm replacement.</Text>{choices.cycle>0 && <TouchableOpacity style={s.option} onPress={()=>{setMode('cycle');setAmount(String(choices.cycle));}}><Text>Use cycle · RM {choices.cycle.toFixed(2)}</Text></TouchableOpacity>}{choices.periods.map(b=><TouchableOpacity key={b.id} style={s.option} onPress={()=>choosePeriod(b)}><Text>Use RM {b.amount.toFixed(2)} · {b.startDay} — {b.endDay}</Text></TouchableOpacity>)}</View>}
    {field('TOTAL LIMIT · RM',amount,setAmount,true)}
    <Text style={s.meta}>PERIOD</Text>{[['cycle','Salary cycle'],['months','Every N months'],['custom','Custom date range']].filter(([key])=>key!=='cycle'||!!target?.subcategory).map(([key,label])=><TouchableOpacity key={key} style={s.option} onPress={()=>setMode(key)}><Text style={s.name}>{mode===key?'● ':'○ '}{label}</Text></TouchableOpacity>)}
    {mode!=='cycle' && <>{mode==='months' && field('MONTHS · 1–120',months,setMonths,true)}{field('START · YYYY-MM-DD',start,setStart)}{mode==='custom' && field('END · YYYY-MM-DD (INCLUSIVE)',end,setEnd)}{[['Repeat automatically',repeat,setRepeat],['Carry net unused budget forward',carry,setCarry],['Show monthly reserve suggestion',reserve,setReserve]].map(([label,value,setter])=><View key={String(label)} style={s.row}><Text style={{flex:1}}>{String(label)}</Text><Switch value={value as boolean} onValueChange={setter as (v:boolean)=>void}/></View>)}</>}
    <Text style={s.meta}>{mode==='cycle'?'Cycle allocation uses the salary-cycle pool.':'Period limit uses its own dates. Monthly-equivalent allocation is a planning estimate (custom: 30.44-day month); actual payments still count in their real salary cycle. Reserve is informational, never a second expense.'}</Text>
    <TouchableOpacity disabled={busy} style={s.button} onPress={()=>submit()}><Text style={{color:'#fff'}}>SAVE BUDGET</Text></TouchableOpacity><TouchableOpacity disabled={busy} style={s.option} onPress={()=>submit(true)}><Text style={{color:'#EF4444'}}>REMOVE BUDGET</Text></TouchableOpacity><TouchableOpacity disabled={busy} style={s.option} onPress={close}><Text>CANCEL</Text></TouchableOpacity>
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}
const s=StyleSheet.create({overlay:{flex:1,justifyContent:'center',backgroundColor:'#0008',padding:20},sheet:{maxHeight:'90%',backgroundColor:'#FFF9EA',borderRadius:24,padding:20},title:{fontSize:23,fontWeight:'700',color:'#111827'},name:{fontSize:13,fontWeight:'600',color:'#111827'},meta:{fontSize:11,lineHeight:18,color:'#737A85',marginVertical:8},input:{padding:12,backgroundColor:'#fff',borderWidth:1,borderColor:'#E4DFD3',borderRadius:12,color:'#111827'},option:{paddingVertical:12},row:{flexDirection:'row',alignItems:'center',gap:10,marginVertical:8},button:{backgroundColor:'#111827',padding:16,borderRadius:14,alignItems:'center',marginTop:12},warning:{padding:12,borderRadius:12,backgroundColor:'#F2E7CB'}});
