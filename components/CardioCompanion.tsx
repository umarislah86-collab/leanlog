import { ThemeScrollView as ScrollView, ThemeTouchableOpacity as TouchableOpacity, ThemeView as View, ThemeSafeAreaView as SafeAreaView } from './ThemeSurfaces';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, StyleSheet, Switch } from 'react-native';

import { useIsFocused } from '@react-navigation/native';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { ThemeText as Text, ThemeTextInput as TextInput } from './ThemePrimitives';
import { useTheme, useThemeStyles } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { cardioCalorieNote, cardioCalories, cardioClock, cardioGoalProgress, cardioNames, cardioPace, cardioPhase, defaultCardioConfig, elapsedCardioMs, validateCardioConfig, type CardioConfig, type CardioSession } from '../services/cardioCore';
import { loadCardioHistory, loadCardioSession } from '../services/cardioStore';
import { controlCardio, currentCardioWeight, discardCardio, manualCardio, setCardioDistance, recoverCardioTracking, resetForegroundCardioAnchor, saveCardioActivity, speakCardio, startCardio } from '../services/cardioRuntime';
import { cardioAppearance, readableTextOn } from '../services/cardioAppearance';
import { refreshLeanLogWidget } from '../services/widget';

function CardioKeepAwake() { useKeepAwake('leanlog-cardio', { suppressDeactivateWarnings: true }); return null; }
type Preset = { name: string; config: CardioConfig };
export function CardioCompanion({ gymActive, openRequest }: { gymActive: boolean; openRequest?: number }) {
  const themedStyles = useThemeStyles(base);
  const { themed, palette } = useTheme();
  const semantic=cardioAppearance(palette);
  const s=Object.fromEntries(Object.entries(themedStyles).map(([key,value])=>[key,{...value,...semantic[key as keyof typeof semantic]}])) as unknown as typeof themedStyles;
  const accentInk={color:readableTextOn(palette.mint)};
  const finishFill=themed('#FF6542','backgroundColor');
  const { lang } = useLanguage();
  const bm = lang === 'bm', focused = useIsFocused();
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false);
  const [session, setSession] = useState<CardioSession | null>(null), [detail, setDetail] = useState<CardioSession | null>(null);
  const [history, setHistory] = useState<CardioSession[]>([]), [presets, setPresets] = useState<Preset[]>([]);
  const [config, setConfig] = useState<CardioConfig>(defaultCardioConfig), [weight, setWeight] = useState(0);
  const [target, setTarget] = useState('30'), [walk, setWalk] = useState('120'), [effort, setEffort] = useState('60'), [rounds, setRounds] = useState('10');
  const [manual, setManual] = useState(false), [minutes, setMinutes] = useState('30'), [distance, setDistance] = useState('');
  const [now, setNow] = useState(Date.now()), [foreground, setForeground] = useState(AppState.currentState === 'active');
  const lock = useRef(false), phaseRef = useRef(''), goalRef = useRef('');
  const read = useCallback(async () => { const current = await loadCardioSession(); setSession(current); setNow(Date.now()); }, []);
  useEffect(() => { void read().catch(console.warn); }, [read]);
  useEffect(() => { if (focused) void read().catch(console.warn); }, [focused, read]);
  useEffect(() => { if (openRequest) { setDetail(null); setVisible(true); } }, [openRequest]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state === 'active') { void recoverCardioTracking().then(read).catch(console.warn); }
      else void resetForegroundCardioAnchor().catch(console.warn);
    });
    if (AppState.currentState === 'active') void recoverCardioTracking().catch(console.warn);
    return () => listener.remove();
  }, [read]);
  useEffect(() => {
    if (!foreground || (!visible && session?.status !== 'running' && session?.status !== 'paused')) return;
    let alive = true, reading = false;
    const timer = setInterval(async () => {
      setNow(Date.now());
      if (reading) return;
      reading = true;
      try { const current = await loadCardioSession(); if (alive) setSession(current); } catch (error) { console.warn(error); } finally { reading = false; }
    }, 1000);
    return () => { alive = false; clearInterval(timer); };
  }, [visible, session?.status, foreground]);
  useEffect(() => {
    if (!visible) return;
    void Promise.all([loadCardioHistory(), currentCardioWeight(), AsyncStorage.getItem('cardio_presets_v1')]).then(([rows, kg, saved]) => {
      setHistory(rows); setWeight(kg); if (saved) setPresets(JSON.parse(saved));
    }).catch(error => Alert.alert('Cardio Companion', String(error)));
  }, [visible, session?.status]);
  useEffect(() => {
    if (!session || session.status !== 'running' || !foreground) return;
    const phase = cardioPhase(session, now), key = `${session.id}:${phase.key}`;
    if (phaseRef.current && phaseRef.current !== key) speakCardio(session, phase.done ? 'Intervals complete. Continue or finish when ready.' : `${cardioNames[phase.mode]}. Round ${phase.round} of ${session.config.intervals?.rounds}.`);
    phaseRef.current = key;
    if (session.config.goal === 'time' && cardioGoalProgress(session, now) === 1 && goalRef.current !== session.id) {
      goalRef.current = session.id; speakCardio(session, 'Time target reached. Finish when ready.');
    }
  }, [session, now, foreground]);
  const run = async (work: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await work(); await read(); } catch (error) { Alert.alert('Cardio Companion', error instanceof Error ? error.message : String(error)); await read().catch(console.warn); }
    finally { lock.current = false; setBusy(false); }
  };
  const setup = (): CardioConfig => ({ ...config, mode:'auto', target: Number(target), intervals: config.intervals ? { walkSeconds: Number(walk), effortSeconds: Number(effort), rounds: Number(rounds) } : null });
  const open = () => { setDetail(null); setVisible(true); void read().catch(console.warn); };
  const start = () => { if (gymActive && !manual) { Alert.alert('Workout in progress', 'Finish your strength session before starting cardio.'); return; }
    void run(async () => {
      const next = manual ? await manualCardio(setup(), Number(minutes), distance.trim() ? Number(distance) : 0) : await startCardio(setup());
      phaseRef.current = next ? `${next.id}:${cardioPhase(next).key}` : '';
      if (next?.status === 'running') speakCardio(next, `${cardioNames[cardioPhase(next).mode]}. Let's begin.`);
    });
  };
  const finish = () => Alert.alert(bm ? 'Tamatkan sesi?' : 'Finish session?', bm ? 'Semak ringkasan sebelum simpan ke Activity.' : 'Review your summary before saving to Activity.', [
    { text: bm ? 'Sambung' : 'Keep going', style: 'cancel' }, { text: 'Finish', onPress: () => { void run(() => controlCardio('finish', session?.id)); } },
  ]);
  const discard = () => Alert.alert('Discard session?', 'This unsaved session will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => { void run(() => discardCardio()); } }]);
  const savePreset = () => { void run(async () => {
    const selected = setup();
    validateCardioConfig(selected);
    const name = `Auto pace · ${selected.intervals ? `${selected.intervals.walkSeconds}/${selected.intervals.effortSeconds}s ×${selected.intervals.rounds}` : selected.goal === 'free' ? 'Free' : `${selected.target} ${selected.goal === 'time' ? 'min' : 'km'}`}`;
    const rows = [{ name, config: selected }, ...presets.filter(p => p.name !== name)].slice(0, 8);
    await AsyncStorage.setItem('cardio_presets_v1', JSON.stringify(rows)); setPresets(rows);
  }); };
  const live = session?.status === 'running' || session?.status === 'paused';
  const selected = detail || session;
  const elapsed = selected ? elapsedCardioMs(selected, now) / 1000 : 0;
  const progress = selected ? cardioGoalProgress(selected, now) : null;
  const phase = selected ? cardioPhase(selected, now) : null;
  const currentPace = selected?.lastFix && now - selected.lastFix.timestamp < 20000 && selected.speedMps > 0 ? 1000 / selected.speedMps : null;
  const averagePace = selected && selected.distanceM >= 20 ? elapsed / (selected.distanceM / 1000) : null;
  const summary = selected?.status === 'finished' || selected?.status === 'saved';
  const icon = (name: React.ComponentProps<typeof Ionicons>['name'], size = 20, accent = false) => <Ionicons name={name} size={size} color={accent ? accentInk.color : palette.text} />;
  const toggle = (label: string, value: boolean, onValueChange: (value: boolean) => void, hint?: string) => <View style={s.toggle}><View style={{ flex: 1 }}><Text style={s.toggleTitle}>{label}</Text>{hint && <Text style={s.hint}>{hint}</Text>}</View><Switch value={value} onValueChange={onValueChange} trackColor={{ true: themed('#8FD6B4','backgroundColor'), false: '#888' }} /></View>;
  const field = (label: string, value: string, setter: (value: string) => void, placeholder?: string) => <View style={{ flex: 1 }}><Text style={s.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={setter} keyboardType="decimal-pad" style={s.input} placeholder={placeholder} /></View>;
  return <>
    <TouchableOpacity style={s.launcher} onPress={open} accessibilityLabel="Open Cardio Companion">
      <View style={s.launchIcon}>{icon(live ? 'pulse-outline' : 'walk-outline', 23, true)}</View>
      <View style={{ flex: 1 }}><Text style={s.launchTitle}>{live ? `${cardioNames[session!.config.mode]} · ${session!.status === 'paused' ? 'Paused' : cardioClock(elapsedCardioMs(session!,now) / 1000)}` : 'Cardio companion'}</Text><Text style={s.hint}>{live ? 'Tap to return to your session' : 'Brisk walk · Jog · Run / No AI needed'}</Text></View>
      {icon('arrow-forward',19)}
    </TouchableOpacity>
    <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!busy) setVisible(false); }}>
      <SafeAreaView style={s.safe}>
        {visible && foreground && focused && session?.status === 'running' && session.config.keepAwake && <CardioKeepAwake />}
        <View style={s.header}><View style={{ flex:1 }}><Text style={s.eyebrow}>COACH / CARDIO</Text><Text style={s.title}>Your own pace.</Text></View><TouchableOpacity accessibilityLabel="Close Cardio Companion" style={s.close} onPress={() => setVisible(false)}>{icon('close')}</TouchableOpacity></View>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {selected && (live || summary || detail) ? <>
            <View style={s.hero}>
              <View style={s.heroTop}><Text style={s.heroLabel}>{cardioNames[selected.config.mode].toUpperCase()}</Text><Text style={s.heroBadge}>{summary ? 'SESSION COMPLETE' : selected.status === 'paused' ? 'PAUSED' : 'LIVE'}</Text></View>
              <Text style={s.timer}>{cardioClock(elapsed)}</Text><Text style={s.heroHint}>ACTIVE TIME</Text>
              <View style={s.heroMetrics}><View style={s.heroMetric}><Text style={s.heroNumber}>{selected.config.gps || selected.manual && selected.distanceM > 0 ? (selected.distanceM / 1000).toFixed(2) : '—'}</Text><Text style={s.heroHint}>KM</Text></View><View style={s.heroMetric}><Text style={s.heroNumber}>{cardioPace(summary ? averagePace : currentPace)}</Text><Text style={s.heroHint}>{summary ? 'AVG PACE / KM' : 'PACE / KM'}</Text></View><View style={s.heroMetric}><Text style={s.heroNumber}>{selected.calorieVersion===2 && selected.distanceM<=0 ? '—' : cardioCalories(selected, now)}</Text><Text style={s.heroHint}>{selected.calorieVersion===2?'EST. ACTIVE KCAL':'EST. TOTAL KCAL'}</Text></View></View>
              {progress !== null && <><View style={s.progressTrack}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View><Text style={s.goalText}>{progress === 1 ? 'Target reached · Finish when ready' : `${selected.config.target} ${selected.config.goal === 'time' ? 'min' : 'km'} target · ${Math.round(progress * 100)}%`}</Text></>}
            </View>
            {selected.config.intervals && phase && !summary && <View style={s.phaseCard}><View style={{ flex:1 }}><Text style={[s.eyebrow,accentInk]}>{phase.done ? 'INTERVALS COMPLETE' : `ROUND ${phase.round} / ${selected.config.intervals.rounds}`}</Text><Text style={s.phaseName}>{phase.done ? 'Free pace' : cardioNames[phase.mode]}</Text></View><Text style={s.phaseTime}>{phase.done ? '✓' : cardioClock(phase.remaining)}</Text></View>}
            <View style={s.row}><View style={[s.card,{flex:1}]}><Text style={s.fieldLabel}>AVERAGE PACE</Text><Text style={s.stat}>{cardioPace(averagePace)}<Text style={s.hint}> /km</Text></Text></View><View style={[s.card,{flex:1}]}><Text style={s.fieldLabel}>BODY WEIGHT</Text><Text style={s.stat}>{selected.weightKg}<Text style={s.hint}> kg</Text></Text></View></View>
            <Text style={s.hint}>{selected.manual ? 'Manually entered session' : selected.tracking === 'background' ? 'GPS continues with screen off. Pause or Finish stops tracking.' : selected.tracking === 'foreground' ? 'GPS while app is open. Background distance is not recorded in this mode.' : 'Timer only · Distance and pace are not measured.'}</Text>
            {selected.config.gps && selected.status === 'running' && !selected.lastFix && <Text style={s.notice}>Waiting for a clear GPS fix… timer continues.</Text>}
            {!!selected.gpsError && <Text style={s.notice}>GPS: {selected.gpsError}</Text>}
            <Text style={s.hint}>{cardioCalorieNote(selected,now)}</Text>
            {!detail && selected.status==='finished' && selected.calorieVersion===2 && !selected.config.gps && !selected.manual && <View style={s.card}>{field('TREADMILL / WATCH DISTANCE (KM)',distance,setDistance,'Required')}<TouchableOpacity disabled={busy} style={s.secondary} onPress={()=>{void run(()=>setCardioDistance(selected.id,Number(distance)));}}><Text style={s.secondaryText}>Apply distance</Text></TouchableOpacity></View>}
            {selected.splits.length > 0 && <View style={s.card}><Text style={s.eyebrow}>KILOMETRE SPLITS</Text>{selected.splits.map(split => <View key={split.km} style={s.split}><Text style={s.toggleTitle}>KM {split.km}</Text><Text style={s.toggleTitle}>{cardioPace(split.seconds)} /km</Text></View>)}</View>}
            {!detail && live && <View style={s.row}><TouchableOpacity disabled={busy} style={[s.secondary,{flex:1}]} onPress={() => { void run(() => controlCardio(selected.status === 'paused' ? 'resume' : 'pause', selected.id)); }}>{icon(selected.status === 'paused' ? 'play' : 'pause')}<Text style={s.secondaryText}>{selected.status === 'paused' ? 'Resume' : 'Pause'}</Text></TouchableOpacity><TouchableOpacity disabled={busy} style={[s.primary,{flex:1,backgroundColor:themed('#FF6542','backgroundColor')}]} onPress={finish}><Text style={[s.primaryText,{color:readableTextOn(finishFill)}]}>Finish</Text></TouchableOpacity></View>}
            {!detail && selected.status === 'finished' && <TouchableOpacity disabled={busy} style={s.primary} onPress={() => { void run(async () => { await saveCardioActivity(selected.id); await refreshLeanLogWidget().catch(console.warn); }); }}><Text style={s.primaryText}>{busy ? 'Saving…' : bm ? 'Simpan ke Activity' : 'Save to Activity'}</Text></TouchableOpacity>}
            {!detail && selected.status === 'saved' && <><Text style={s.saved}>Saved to Activity · No AI used</Text><TouchableOpacity style={s.primary} disabled={busy} onPress={() => { void run(() => discardCardio()); }}><Text style={s.primaryText}>New session</Text></TouchableOpacity></>}
            {!detail && selected.status !== 'saved' && <TouchableOpacity disabled={busy} onPress={discard} style={s.textButton}><Text style={s.hint}>Discard session</Text></TouchableOpacity>}
            {detail && <TouchableOpacity style={s.secondary} onPress={() => setDetail(null)}><Text style={s.secondaryText}>Back to companion</Text></TouchableOpacity>}
          </> : <>
            <View style={s.segment}>{[false,true].map(value => <TouchableOpacity key={String(value)} style={[s.segmentButton,manual === value && s.segmentOn]} onPress={() => setManual(value)}><Text style={s.toggleTitle}>{value ? 'Quick log' : 'Start session'}</Text></TouchableOpacity>)}</View>
            <View style={s.card}><Text style={s.eyebrow}>AUTO PACE</Text><Text style={s.hint}>Walk, jog or run freely. Calories use recorded pace, distance, active time and your weight. No activity mode to choose.</Text></View>
            {manual ? <View style={s.card}><Text style={s.eyebrow}>ALREADY FINISHED?</Text><Text style={s.hint}>Enter your session. Review calories before saving.</Text><View style={[s.row,{marginTop:14}]}>{field('DURATION / MIN',minutes,setMinutes)}{field('DISTANCE / KM',distance,setDistance,'Required')}</View></View> : <>
              <View style={s.card}><Text style={s.eyebrow}>TODAY’S TARGET</Text><View style={s.segment}>{(['free','time','distance'] as const).map(goal => <TouchableOpacity key={goal} style={[s.segmentButton,config.goal === goal && s.segmentOn]} onPress={() => {setConfig(c=>({...c,goal,gps:goal === 'distance' ? true : c.gps}));setTarget(goal === 'distance' ? '3' : '30');}}><Text style={s.toggleTitle}>{goal === 'free' ? 'Free' : goal === 'time' ? 'Time' : 'Distance'}</Text></TouchableOpacity>)}</View>{config.goal !== 'free' && field(config.goal === 'time' ? 'MINUTES' : 'KILOMETRES',target,setTarget)}</View>
              <View style={s.card}>{toggle('GPS tracking',config.gps,gps => setConfig(c=>({...c,gps,goal:!gps && c.goal === 'distance' ? 'free' : c.goal})), 'Choose Timer only for treadmill or indoor sessions.')}
                {config.gps && <Text style={s.hint}>Allow precise location. For screen-off tracking, choose “Allow all the time” when Android asks.</Text>}
                {toggle('Voice cues',config.voice,voice=>setConfig(c=>({...c,voice})), 'Spoken while open; notification chime with screen off.')}
                {toggle('Vibration',config.vibrate,vibrate=>setConfig(c=>({...c,vibrate})))}
                {toggle('Keep screen on',config.keepAwake,keepAwake=>setConfig(c=>({...c,keepAwake})))}</View>
              {<View style={s.card}>{toggle('Walk–jog intervals',!!config.intervals,on=>setConfig(c=>({...c,intervals:on ? {walkSeconds:120,effortSeconds:60,rounds:10} : null})), 'Alternate easy and effort phases. Calories still follow measured pace.')}{config.intervals && <View style={s.row}>{field('WALK / SEC',walk,setWalk)}{field('EFFORT / SEC',effort,setEffort)}{field('ROUNDS',rounds,setRounds)}</View>}</View>}
              <TouchableOpacity style={s.textButton} onPress={savePreset} disabled={busy}><Text style={s.secondaryText}>Save these settings as a preset</Text></TouchableOpacity>
            </>}
            <View style={s.weightNote}>{icon('scale-outline',17)}<Text style={s.hint}>{weight > 0 ? `${weight} kg · Latest logged weight` : 'Set your body weight in Profile to estimate calories'}</Text></View>
            <TouchableOpacity disabled={busy || weight <= 0} style={[s.primary,(busy || weight <= 0) && {opacity:0.5}]} onPress={start}>{busy ? <ActivityIndicator color={themed('#101A2B','onAccent')} /> : icon(manual ? 'checkmark-circle-outline' : 'play',20,true)}<Text style={s.primaryText}>{manual ? 'Review activity' : 'Start session'}</Text></TouchableOpacity>
            {presets.length > 0 && !manual && <View style={s.card}><Text style={s.eyebrow}>YOUR PRESETS</Text>{presets.map(p=><TouchableOpacity key={p.name} style={s.preset} onPress={()=>{setConfig(p.config);setTarget(String(p.config.target));if(p.config.intervals){setWalk(String(p.config.intervals.walkSeconds));setEffort(String(p.config.intervals.effortSeconds));setRounds(String(p.config.intervals.rounds));}}} onLongPress={()=>Alert.alert('Remove preset?',p.name,[{text:'Cancel'},{text:'Remove',onPress:()=>{const next=presets.filter(row=>row.name!==p.name);void AsyncStorage.setItem('cardio_presets_v1',JSON.stringify(next)).then(()=>setPresets(next));}}])}><Text style={s.toggleTitle}>{p.name}</Text>{icon('arrow-forward',16)}</TouchableOpacity>)}</View>}
          </>}
          {!detail && history.length > 0 && <View style={s.card}><Text style={s.eyebrow}>RECENT SESSIONS</Text>{history.slice(0,8).map(row=><TouchableOpacity key={row.id} style={s.preset} onPress={()=>setDetail(row)}><View><Text style={s.toggleTitle}>{cardioNames[row.config.mode]} · {cardioClock(elapsedCardioMs(row)/1000)}</Text><Text style={s.hint}>{new Date(row.startedAt).toLocaleDateString()} · {row.distanceM > 0 ? `${(row.distanceM/1000).toFixed(2)} km · ` : ''}{cardioCalories(row)} est. kcal</Text></View>{icon('chevron-forward',17)}</TouchableOpacity>)}</View>}
          {busy && <Text style={[s.hint,{textAlign:'center'}]}>Updating session…</Text>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}
const base = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F7F0E1'}, launcher:{marginHorizontal:18,marginTop:10,marginBottom:8,padding:14,borderRadius:20,borderWidth:1,borderColor:'#D9D0C0',backgroundColor:'#FFFDF7',flexDirection:'row',alignItems:'center',gap:12},
  launchIcon:{height:43,width:43,borderRadius:15,backgroundColor:'#8FD6B4',alignItems:'center',justifyContent:'center'},launchTitle:{fontSize:16,fontWeight:'800',color:'#101A2B'},
  header:{paddingHorizontal:20,paddingVertical:14,flexDirection:'row',alignItems:'center',gap:12},eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.7,color:'#16786E',marginBottom:9},title:{fontFamily:'serif',fontSize:32,fontWeight:'800',color:'#101A2B'},close:{padding:12,borderWidth:1,borderColor:'#D9D0C0',borderRadius:15},
  body:{padding:18,paddingBottom:30,gap:14},row:{flexDirection:'row',gap:10},card:{padding:16,borderRadius:21,backgroundColor:'#FFFDF7',borderWidth:1,borderColor:'#E2D9CA'},
  mode:{flex:1,paddingVertical:17,borderWidth:1,borderColor:'#D9D0C0',borderRadius:18,alignItems:'center',gap:8,backgroundColor:'#FFFDF7'},modeOn:{backgroundColor:'#8FD6B4',borderColor:'#16786E'},modeText:{fontSize:12,fontWeight:'800',color:'#101A2B'},
  segment:{flexDirection:'row',backgroundColor:'#EFE5D4',borderRadius:13,padding:4,marginBottom:12},segmentButton:{flex:1,alignItems:'center',paddingVertical:11,borderRadius:10},segmentOn:{backgroundColor:'#FFFDF7'},
  toggle:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10},toggleTitle:{fontSize:12,fontWeight:'700',color:'#101A2B'},hint:{fontSize:11,lineHeight:17,color:'#68758A'},fieldLabel:{fontSize:8,fontWeight:'800',letterSpacing:1,color:'#68758A',marginBottom:8},input:{borderRadius:12,backgroundColor:'#F0E8DB',padding:13,color:'#101A2B',fontSize:18,fontWeight:'700'},
  hero:{backgroundColor:'#101A2B',borderRadius:28,padding:23},heroTop:{flexDirection:'row',justifyContent:'space-between',gap:8},heroLabel:{fontSize:9,fontWeight:'800',letterSpacing:1.5,color:'#8FD6B4'},heroBadge:{fontSize:8,fontWeight:'800',letterSpacing:0.8,color:'#FFFDF7'},
  timer:{fontSize:58,fontWeight:'800',letterSpacing:-2,color:'#FFFDF7',textAlign:'center',marginTop:22},heroHint:{fontSize:8,fontWeight:'700',letterSpacing:1,color:'#AEB8CD',textAlign:'center',marginTop:4},heroMetrics:{flexDirection:'row',marginTop:24},heroMetric:{flex:1},heroNumber:{fontSize:25,fontWeight:'800',color:'#FFFDF7',textAlign:'center'},
  progressTrack:{height:5,borderRadius:3,backgroundColor:'#33415C',overflow:'hidden',marginTop:23},progressFill:{height:5,backgroundColor:'#8FD6B4',borderRadius:3},goalText:{fontSize:10,color:'#8FD6B4',textAlign:'center',marginTop:9},
  phaseCard:{padding:18,borderRadius:21,backgroundColor:'#8FD6B4',flexDirection:'row',alignItems:'center'},phaseName:{fontSize:23,fontWeight:'800',color:'#101A2B'},phaseTime:{fontSize:32,fontWeight:'800',color:'#101A2B'},stat:{fontSize:22,fontWeight:'800',color:'#101A2B'},
  primary:{minHeight:56,backgroundColor:'#8FD6B4',borderRadius:17,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},primaryText:{fontSize:14,fontWeight:'800',color:'#101A2B'},secondary:{minHeight:56,borderWidth:1,borderColor:'#D9D0C0',borderRadius:17,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:9},secondaryText:{fontSize:12,fontWeight:'800',color:'#101A2B'},
  textButton:{paddingVertical:12,alignItems:'center'},weightNote:{flexDirection:'row',gap:8,alignItems:'center'},notice:{fontSize:11,lineHeight:17,color:'#C95370'},saved:{fontSize:12,fontWeight:'800',color:'#16786E',textAlign:'center'},split:{flexDirection:'row',justifyContent:'space-between',paddingVertical:9},preset:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#E2D9CA'},
});
