import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { flushRedCoinsWrites, readSavedRedCoinsRaw } from '../services/redcoins';
import { subscribeRedCoinsChanges } from '../services/redcoinsEvents';
import { auditRedCoinsData, type DataAudit, type AuditTarget } from '../services/redcoinsDataAudit';

export function RedCoinsDataCheck() {
  const navigation = useNavigation<any>();
  const [open,setOpen] = useState(false), [busy,setBusy] = useState(false), [report,setReport] = useState<DataAudit | null>(null), [error,setError] = useState(''), [stale,setStale] = useState(false);
  const lock = useRef(false), generation = useRef(0);
  useEffect(() => subscribeRedCoinsChanges(({kind}) => { if (kind === 'state') { generation.current++; setStale(true); } }),[]);
  const run = async () => {
    if (lock.current) return;
    lock.current=true;setOpen(true);setBusy(true);setError('');setReport(null);
    try {
      // Do not call loadRedCoins: that can migrate/catch up schedules. Read only.
      await flushRedCoinsWrites();
      const version=generation.current;
      const raw=await readSavedRedCoinsRaw();
      if (!raw) { setError('No saved RedCoins data yet. Open RedCoins first, then run this check.'); return; }
      await new Promise(resolve => setTimeout(resolve,20));
      setReport(auditRedCoinsData(JSON.parse(raw)));setStale(version !== generation.current);
    } catch (e) { setError(`Could not complete the check. Nothing was changed.\n${e instanceof Error ? e.message : String(e)}`); }
    finally { lock.current=false;setBusy(false); }
  };
  const review = (target: AuditTarget) => { setOpen(false); navigation.navigate('RedCoins',{mode:undefined,section:target.section,auditTarget:{...target,requestId:`${Date.now()}-${Math.random()}`}}); };
  return <>
    <TouchableOpacity style={s.card} onPress={run}><Text style={s.title}>Check my data</Text><Text style={s.meta}>Read-only checks for broken references, possible duplicates, saved bank differences and overlapping budgets.</Text><Text style={s.action}>RUN CHECK →</Text></TouchableOpacity>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={s.screen}><View style={s.header}><Text style={s.title}>Check my data</Text><TouchableOpacity onPress={() => setOpen(false)}><Text style={s.action}>CLOSE</Text></TouchableOpacity></View>
        <ScrollView contentContainerStyle={{padding:20,paddingBottom:50}}>
          <Text style={s.meta}>No repairs, deletions, balance adjustments or FYDB reads are performed. Opening a result goes to the normal RedCoins screen where you can review it yourself.</Text>
          {busy && <ActivityIndicator color="#399778" style={{margin:30}} />}
          {!!error && <Text style={s.error}>{error}</Text>}
          {report && <>
            <View style={s.card}><Text style={s.title}>{report.total ? `${report.total} things to check` : 'No issues found by these checks'}</Text><Text style={s.meta}>{report.errors} structural issues · {report.reviews} review hints</Text><Text style={s.meta}>{report.entryCount} transactions · {report.accountCount} accounts{ '\n' }Checked {new Date(report.checkedAt).toLocaleString('en-MY')}</Text>
              <Text style={s.meta}>{report.bankChecks} saved bank comparisons checked; {report.unverifiedBalances} balances without a usable bank comparison. Ledger sums alone cannot prove a live balance without a verified opening balance. No issues does not guarantee bank reconciliation.</Text>
              <TouchableOpacity onPress={() => review({section:'accounts'})}><Text style={s.action}>OPEN ACCOUNTS / SEMAK →</Text></TouchableOpacity>
            </View>
            {stale && <Text style={s.error}>Data changed since this snapshot. Run again before making decisions.</Text>}
            {report.issues.map(issue => <TouchableOpacity key={issue.id} style={s.card} onPress={() => review(issue.target)}><Text style={[s.label,{color:issue.level === 'error' ? '#EF4444' : '#997123'}]}>{issue.level === 'error' ? 'CHECK STRUCTURE' : 'REVIEW · NOT PROOF OF AN ERROR'}</Text><Text style={s.name}>{issue.title}</Text><Text style={s.meta}>{issue.detail}</Text><Text style={s.action}>REVIEW →</Text></TouchableOpacity>)}
            {report.total > report.issues.length && <Text style={s.meta}>Showing first {report.issues.length} results of {report.total}. Review these, then rerun.</Text>}
          </>}
          {!busy && <TouchableOpacity style={s.button} onPress={run}><Text style={{color:'#fff',fontWeight:'700'}}>RUN AGAIN</Text></TouchableOpacity>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#FFF9EA'},header:{padding:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},card:{backgroundColor:'#fff',borderRadius:20,borderWidth:1,borderColor:'#E4DFD3',padding:18,marginBottom:12},title:{fontSize:21,fontWeight:'700',color:'#111827'},name:{fontSize:15,fontWeight:'700',color:'#111827',marginTop:5},meta:{fontSize:12,lineHeight:19,color:'#737A85',marginVertical:8},action:{fontSize:11,fontWeight:'700',color:'#399778'},label:{fontSize:9,fontWeight:'700',letterSpacing:1},error:{color:'#BD493B',fontSize:13,lineHeight:20,marginVertical:15},button:{backgroundColor:'#111827',padding:17,borderRadius:14,alignItems:'center'}});
