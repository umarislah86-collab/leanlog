import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { runLeanLogAi } from '../services/ai';
import { fsUpsert } from '../firebase';
import { useLanguage } from '../context/LanguageContext';
import type { GymGoal, FitnessLevel, WorkoutPlan, WorkoutDay, GymSession, UserProfile, ActivityEntry } from '../types';

const GYM_SETUP_KEY = 'gym_setup';
const GYM_PLAN_KEY = 'gym_plan';
export const GYM_SESSIONS_KEY = 'gym_sessions';

const EQUIPMENT_LIST = [
  { id: 'bodyweight', bm: 'Berat Badan Sendiri', en: 'Bodyweight' },
  { id: 'dumbbells',  bm: 'Dumbbell',            en: 'Dumbbells' },
  { id: 'barbell',    bm: 'Barbell + Rack',       en: 'Barbell + Rack' },
  { id: 'bench',      bm: 'Bangku (Bench)',        en: 'Bench' },
  { id: 'cables',     bm: 'Cable Machine',         en: 'Cable Machine' },
  { id: 'pec_fly',    bm: 'Pec Fly Machine',       en: 'Pec Fly Machine' },
  { id: 'leg_press',  bm: 'Leg Press / Extension', en: 'Leg Press / Extension' },
  { id: 'pullup',     bm: 'Pull-up Bar',            en: 'Pull-up Bar' },
  { id: 'treadmill',  bm: 'Treadmill / Cardio',    en: 'Treadmill / Cardio' },
  { id: 'full_gym',   bm: 'Full Gym Access',       en: 'Full Gym Access' },
];

const DURATION_KEYWORDS = ['treadmill', 'cardio', 'plank', 'run', 'jog', 'walk', 'cycle', 'bike', 'elliptical', 'row', 'skip', 'jump rope', 'farmer', 'hold', 'carry', 'lari', 'berjalan', 'basikal'];
const isDurationEx = (name: string) => DURATION_KEYWORDS.some(k => name.toLowerCase().includes(k));
const formatTimer = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

interface SessionSet { reps: string; weight: string; done: boolean; }
interface SessionExercise { name: string; restSeconds: number; sets: SessionSet[]; }

export default function CoachScreen() {
  const { lang, t } = useLanguage();

  const [view, setView] = useState<'setup' | 'plan' | 'session'>('setup');

  // Setup
  const [goal, setGoal] = useState<GymGoal>('muscle');
  const [level, setLevel] = useState<FitnessLevel>('beginner');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(['bodyweight']);
  const [generating, setGenerating] = useState(false);

  // Plan
  const [gymPlan, setGymPlan] = useState<WorkoutPlan | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // Session
  const [sessionDayLabel, setSessionDayLabel] = useState('');
  const [sessionDayIndex, setSessionDayIndex] = useState(0);
  const [sessionModified, setSessionModified] = useState(false);
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([]);
  const [sessionStart, setSessionStart] = useState(0);
  const [addExName, setAddExName] = useState('');
  const [estimatingKcal, setEstimatingKcal] = useState(false);

  // Rest timer
  const [restRemaining, setRestRemaining] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Duration timers (for cardio/plank/treadmill sets)
  const [durationTimers, setDurationTimers] = useState<Record<string, { remaining: number; running: boolean }>>({});
  const timerRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    loadData();
    return () => {
      if (restRef.current) clearInterval(restRef.current);
      Object.values(timerRefs.current).forEach(clearInterval);
    };
  }, []);

  const loadData = async () => {
    const [planStr, setupStr] = await Promise.all([
      AsyncStorage.getItem(GYM_PLAN_KEY),
      AsyncStorage.getItem(GYM_SETUP_KEY),
    ]);
    if (planStr) { setGymPlan(JSON.parse(planStr)); setView('plan'); }
    if (setupStr) {
      const s = JSON.parse(setupStr);
      if (s.goal) setGoal(s.goal);
      if (s.level) setLevel(s.level);
      if (s.equipment) setSelectedEquipment(s.equipment);
    }
  };

  const toggleEquipment = (id: string) =>
    setSelectedEquipment(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);

  const generatePlan = async () => {
    if (selectedEquipment.length === 0) {
      Alert.alert(t('inputError'), lang === 'en' ? 'Select at least 1 equipment.' : 'Pilih sekurang-kurangnya 1 peralatan.');
      return;
    }
    setGenerating(true);
    try {
      const profileStr = await AsyncStorage.getItem('user_profile');
      const profile: UserProfile | null = profileStr ? JSON.parse(profileStr) : null;
      const eqNames = selectedEquipment.map(id => EQUIPMENT_LIST.find(e => e.id === id)?.en ?? id).join(', ');
      const goalLabel = goal === 'kurus' ? 'fat loss' : goal === 'muscle' ? 'muscle building' : 'maintenance';

      const prompt = `Generate a weekly gym workout plan for a ${level} level person, goal: ${goalLabel}.
Available equipment: ${eqNames}.
${profile ? `User: ${profile.gender === 'lelaki' ? 'male' : 'female'}, ${profile.weight}kg, ${profile.height}cm, ${profile.age}yo.` : ''}
Reply with JSON only (no markdown, no explanation):
{
  "days": [
    {
      "label": "Push Day",
      "exercises": [
        { "name": "Bench Press", "sets": [{"reps":10,"weight":60,"done":false},{"reps":10,"weight":60,"done":false},{"reps":10,"weight":60,"done":false}], "restSeconds": 90 }
      ]
    }
  ]
}
Rules: 3-4 workout days, 3-5 exercises per day, only exercises matching available equipment, bodyweight exercises use weight 0, restSeconds: 60 for isolation lifts, 90-120 for compound lifts.`;

      const output = await runLeanLogAi('workout_plan', [{ type: 'text', text: prompt }]);
      const match = output.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Bad response');
      const data = JSON.parse(match[0]);

      const plan: WorkoutPlan = {
        id: Date.now().toString(),
        createdAt: new Date().toLocaleDateString('ms-MY'),
        goal, level,
        equipment: selectedEquipment,
        days: data.days,
      };
      await Promise.all([
        AsyncStorage.setItem(GYM_PLAN_KEY, JSON.stringify(plan)),
        AsyncStorage.setItem(GYM_SETUP_KEY, JSON.stringify({ goal, level, equipment: selectedEquipment })),
      ]);
      setGymPlan(plan);
      setView('plan');
    } catch {
      Alert.alert(t('error'), lang === 'en' ? 'Failed to generate plan. Try again.' : 'Gagal jana plan. Cuba lagi.');
    } finally {
      setGenerating(false);
    }
  };

  const openYouTube = (exerciseName: string) => {
    const query = encodeURIComponent(`how to ${exerciseName} proper form`);
    Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
  };

  const resetPlan = () => {
    Alert.alert(t('gymReset'), t('gymResetConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('ok'), onPress: async () => {
        await AsyncStorage.removeItem(GYM_PLAN_KEY);
        setGymPlan(null); setExpandedDay(null); setView('setup');
      }},
    ]);
  };

  const startSession = (day: WorkoutDay, dayIdx: number) => {
    setSessionDayLabel(day.label);
    setSessionDayIndex(dayIdx);
    setSessionModified(false);
    setAddExName('');
    setSessionExercises(day.exercises.map(ex => ({
      name: ex.name,
      restSeconds: ex.restSeconds ?? 90,
      sets: ex.sets.map(s => ({ reps: String(s.reps), weight: String(s.weight), done: false })),
    })));
    setSessionStart(Date.now());
    if (restRef.current) clearInterval(restRef.current);
    setRestRemaining(0);
    Object.values(timerRefs.current).forEach(clearInterval);
    timerRefs.current = {};
    setDurationTimers({});
    setView('session');
  };

  const updateSet = (exIdx: number, si: number, field: 'reps' | 'weight', val: string) =>
    setSessionExercises(prev => prev.map((ex, ei) => ei !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((s, sj) => sj !== si ? s : { ...s, [field]: val }),
    }));

  const tickSet = (exIdx: number, si: number) => {
    const wasDone = sessionExercises[exIdx].sets[si].done;
    setSessionExercises(prev => prev.map((ex, ei) => ei !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((s, sj) => sj !== si ? s : { ...s, done: !s.done }),
    }));
    if (!wasDone) startRest(sessionExercises[exIdx].restSeconds ?? 90);
  };

  const startRest = (seconds: number) => {
    if (restRef.current) clearInterval(restRef.current);
    setRestRemaining(seconds);
    restRef.current = setInterval(() => {
      setRestRemaining(prev => {
        if (prev <= 1) { clearInterval(restRef.current!); restRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const skipRest = () => {
    if (restRef.current) { clearInterval(restRef.current); restRef.current = null; }
    setRestRemaining(0);
  };

  const tKey = (exIdx: number, si: number) => `${exIdx}_${si}`;

  const startDurationTimer = (exIdx: number, si: number) => {
    const key = tKey(exIdx, si);
    const durationSec = (parseInt(sessionExercises[exIdx].sets[si].reps) || 1) * 60;
    const existing = durationTimers[key];
    const remaining = (existing && existing.remaining > 0) ? existing.remaining : durationSec;
    if (timerRefs.current[key]) clearInterval(timerRefs.current[key]);
    setDurationTimers(prev => ({ ...prev, [key]: { remaining, running: true } }));
    timerRefs.current[key] = setInterval(() => {
      setDurationTimers(prev => {
        const cur = prev[key];
        if (!cur || cur.remaining <= 1) {
          clearInterval(timerRefs.current[key]);
          delete timerRefs.current[key];
          Vibration.vibrate([0, 400, 200, 400]);
          setTimeout(() => tickSet(exIdx, si), 50);
          return { ...prev, [key]: { remaining: 0, running: false } };
        }
        return { ...prev, [key]: { ...cur, remaining: cur.remaining - 1 } };
      });
    }, 1000);
  };

  const pauseDurationTimer = (exIdx: number, si: number) => {
    const key = tKey(exIdx, si);
    if (timerRefs.current[key]) { clearInterval(timerRefs.current[key]); delete timerRefs.current[key]; }
    setDurationTimers(prev => ({ ...prev, [key]: { ...prev[key], running: false } }));
  };

  const removeExercise = (exIdx: number) => {
    setSessionExercises(prev => prev.filter((_, i) => i !== exIdx));
    setSessionModified(true);
  };

  const addExercise = () => {
    const name = addExName.trim();
    if (!name) return;
    const sets: SessionSet[] = Array.from({ length: 3 }, () => ({ reps: '10', weight: '0', done: false }));
    setSessionExercises(prev => [...prev, { name, restSeconds: 90, sets }]);
    setSessionModified(true);
    setAddExName('');
  };

  const estimateKcal = async (durationMin: number): Promise<number> => {
    try {
      const profileStr = await AsyncStorage.getItem('user_profile');
      const profile: UserProfile | null = profileStr ? JSON.parse(profileStr) : null;
      const exSummary = sessionExercises
        .map(ex => `${ex.name}: ${ex.sets.filter(s => s.done).length}/${ex.sets.length} sets`)
        .join(', ');
      const prompt = `Estimate calories burned for this gym session.
Duration: ${durationMin} min. User: ${profile?.weight ?? 75}kg ${profile?.gender === 'lelaki' ? 'male' : 'female'}.
Exercises: ${exSummary}.
Reply with a single integer only.`;
      const output = await runLeanLogAi('gym_calories', [{ type: 'text', text: prompt }]);
      const n = parseInt(output.trim());
      return isNaN(n) ? 200 : n;
    } catch {
      return 200;
    }
  };

  const logActivityFromGym = async (kcal: number, durationMin: number): Promise<string> => {
    const now = new Date();
    const entry: ActivityEntry = {
      type: 'activity',
      id: `gym_${Date.now()}`,
      name: `💪 ${sessionDayLabel}`,
      duration: durationMin,
      caloriesBurned: kcal,
      time: now.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
      date: now.toLocaleDateString('ms-MY'),
    };
    const existing = await AsyncStorage.getItem('activity_entries');
    const all = existing ? JSON.parse(existing) : [];
    all.push(entry);
    await AsyncStorage.setItem('activity_entries', JSON.stringify(all));
    fsUpsert('activityEntries', entry.id, entry).catch(() => {});
    return entry.id;
  };

  const saveModifiedPlanDay = async () => {
    if (!gymPlan) return;
    const updatedPlan: WorkoutPlan = {
      ...gymPlan,
      days: gymPlan.days.map((d, i) => i !== sessionDayIndex ? d : {
        ...d,
        exercises: sessionExercises.map(ex => ({
          name: ex.name,
          sets: ex.sets.map(s => ({ reps: parseInt(s.reps) || 10, weight: parseFloat(s.weight) || 0, done: false })),
          restSeconds: ex.restSeconds,
        })),
      }),
    };
    await AsyncStorage.setItem(GYM_PLAN_KEY, JSON.stringify(updatedPlan));
    setGymPlan(updatedPlan);
  };

  const finishSession = async () => {
    setEstimatingKcal(true);
    const now = new Date();
    const durationMin = Math.max(1, Math.round((Date.now() - sessionStart) / 60000));
    const session: GymSession = {
      id: Date.now().toString(),
      date: now.toLocaleDateString('ms-MY'),
      time: now.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
      planDayLabel: sessionDayLabel,
      exercises: sessionExercises.map(ex => ({
        name: ex.name,
        sets: ex.sets.map(s => ({ reps: parseInt(s.reps) || 0, weight: parseFloat(s.weight) || 0, done: s.done })),
      })),
      durationMin,
    };
    try {
      const existing = await AsyncStorage.getItem(GYM_SESSIONS_KEY);
      const all: GymSession[] = existing ? JSON.parse(existing) : [];
      all.push(session);
      await AsyncStorage.setItem(GYM_SESSIONS_KEY, JSON.stringify(all));
      fsUpsert('gymSessions', session.id, session).catch(() => {});
    } catch {}

    const kcal = await estimateKcal(durationMin);
    setEstimatingKcal(false);
    skipRest();
    Object.values(timerRefs.current).forEach(clearInterval);
    timerRefs.current = {};
    setDurationTimers({});

    const done = () => {
      setView('plan');
      Alert.alert('✅', t('gymSessionSaved'));
    };

    const checkSaveModified = (didLog: boolean) => {
      if (!sessionModified) { done(); return; }
      Alert.alert(
        lang === 'en' ? '💾 Save Workout?' : '💾 Simpan Workout?',
        lang === 'en'
          ? 'Save this modified workout as the plan for this day going forward?'
          : 'Simpan workout yang diubah ini sebagai plan untuk hari ini minggu depan?',
        [
          { text: lang === 'en' ? 'No' : 'Tidak', style: 'cancel', onPress: done },
          { text: lang === 'en' ? 'Yes, Save' : 'Ya, Simpan', onPress: async () => { await saveModifiedPlanDay(); done(); } },
        ]
      );
    };

    Alert.alert(
      lang === 'en' ? '🏁 Session Done!' : '🏁 Sesi Tamat!',
      lang === 'en'
        ? `AI estimate: ~${kcal} kcal burned\n\nLog as today's activity?`
        : `Anggaran AI: ~${kcal} kcal dibakar\n\nLog sebagai aktiviti hari ini?`,
      [
        { text: lang === 'en' ? 'Skip' : 'Langkau', style: 'cancel', onPress: () => checkSaveModified(false) },
        { text: '✅ Log', onPress: async () => { const aId = await logActivityFromGym(kcal, durationMin); try { const raw = await AsyncStorage.getItem(GYM_SESSIONS_KEY); const all: GymSession[] = raw ? JSON.parse(raw) : []; const idx = all.findIndex(s => s.id === session.id); if (idx !== -1) { all[idx] = { ...all[idx], activityEntryId: aId }; await AsyncStorage.setItem(GYM_SESSIONS_KEY, JSON.stringify(all)); fsUpsert('gymSessions', session.id, { ...session, activityEntryId: aId }).catch(() => {}); } } catch {} checkSaveModified(true); } },
      ]
    );
  };

  // ── SETUP VIEW ──────────────────────────────────────────────────────────────
  const renderSetup = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageHeader}>{t('gymSetupTitle')}</Text>

      <Text style={styles.secLabel}>{t('gymGoalLabel')}</Text>
      {([
        { val: 'kurus' as GymGoal, label: t('gymGoalKurus'), emoji: '🔥' },
        { val: 'maintain' as GymGoal, label: t('gymGoalMaintain'), emoji: '⚖️' },
        { val: 'muscle' as GymGoal, label: t('gymGoalMuscle'), emoji: '💪' },
      ]).map(o => (
        <TouchableOpacity key={o.val} style={[styles.optBtn, goal === o.val && styles.optBtnOn]} onPress={() => setGoal(o.val)}>
          <Text style={[styles.optBtnTxt, goal === o.val && styles.optBtnTxtOn]}>{o.emoji}  {o.label}</Text>
          {goal === o.val && <Text style={styles.tick}>✓</Text>}
        </TouchableOpacity>
      ))}

      <Text style={[styles.secLabel, { marginTop: 20 }]}>{t('gymLevelLabel')}</Text>
      {([
        { val: 'beginner' as FitnessLevel, label: t('gymLevelBeginner') },
        { val: 'intermediate' as FitnessLevel, label: t('gymLevelIntermediate') },
        { val: 'advanced' as FitnessLevel, label: t('gymLevelAdvanced') },
      ]).map(o => (
        <TouchableOpacity key={o.val} style={[styles.optBtn, level === o.val && styles.optBtnOn]} onPress={() => setLevel(o.val)}>
          <Text style={[styles.optBtnTxt, level === o.val && styles.optBtnTxtOn]}>{o.label}</Text>
          {level === o.val && <Text style={styles.tick}>✓</Text>}
        </TouchableOpacity>
      ))}

      <Text style={[styles.secLabel, { marginTop: 20 }]}>{t('gymEquipmentLabel')}</Text>
      {EQUIPMENT_LIST.map(eq => {
        const on = selectedEquipment.includes(eq.id);
        const label = lang === 'en' ? eq.en : eq.bm;
        return (
          <TouchableOpacity key={eq.id} style={[styles.optBtn, on && styles.optBtnOn]} onPress={() => toggleEquipment(eq.id)}>
            <Text style={[styles.optBtnTxt, on && styles.optBtnTxtOn]}>{label}</Text>
            {on && <Text style={styles.tick}>✓</Text>}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={[styles.genBtn, generating && { opacity: 0.6 }]} onPress={generatePlan} disabled={generating}>
        {generating ? <ActivityIndicator color="#FFFDF7" /> : <Text style={styles.genBtnTxt}>⚡ {t('gymGeneratePlan')}</Text>}
      </TouchableOpacity>
      {generating && <Text style={styles.genHint}>{t('gymGenerating')}</Text>}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ── PLAN VIEW ───────────────────────────────────────────────────────────────
  const renderPlan = () => {
    if (!gymPlan) return null;
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.planHdrRow}>
          <Text style={styles.pageHeader}>{t('gymPlanTitle')}</Text>
          <TouchableOpacity onPress={resetPlan} style={styles.resetBtn}>
            <Text style={styles.resetBtnTxt}>↺ {t('gymReset')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.planMeta}>{gymPlan.level} · {gymPlan.goal} · {gymPlan.createdAt}</Text>

        {gymPlan.days.map((day, di) => {
          const open = expandedDay === di;
          return (
            <View key={di} style={styles.dayCard}>
              <TouchableOpacity style={styles.dayHdr} onPress={() => setExpandedDay(open ? null : di)}>
                <View>
                  <Text style={styles.dayTitle}>{day.label}</Text>
                  <Text style={styles.daySub}>{day.exercises.length} {t('gymExercises')}</Text>
                </View>
                <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {open && (
                <View style={styles.dayBody}>
                  {day.exercises.map((ex, ei) => (
                    <View key={ei} style={styles.exRow}>
                      <View style={styles.exNameRow}>
                        <Text style={styles.exName}>{ex.name}</Text>
                        <TouchableOpacity onPress={() => openYouTube(ex.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="logo-youtube" size={16} color="#FF0000" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.exMeta}>
                        {ex.sets.length} {t('gymSetsLabel')} × {ex.sets[0]?.reps} {t('gymRepsLabel')}  ·  {t('gymRestTimer')}: {ex.restSeconds}s
                      </Text>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.startBtn} onPress={() => startSession(day, di)}>
                    <Text style={styles.startBtnTxt}>▶  {t('gymStartSession')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  // ── SESSION VIEW ────────────────────────────────────────────────────────────
  const renderSession = () => (
    <View style={{ flex: 1 }}>
      {restRemaining > 0 && (
        <View style={styles.restBanner}>
          <Text style={styles.restTxt}>⏱  {t('gymRestTimer')}: {restRemaining}s</Text>
          <TouchableOpacity onPress={skipRest}><Text style={styles.skipTxt}>{t('gymSkipRest')}</Text></TouchableOpacity>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageHeader}>{sessionDayLabel}</Text>
        {sessionExercises.map((ex, exIdx) => (
          <View key={exIdx} style={styles.sesExCard}>
            <View style={styles.sesExHeader}>
              <View style={styles.sesExNameRow}>
                <Text style={styles.sesExName}>{ex.name}</Text>
                <TouchableOpacity onPress={() => openYouTube(ex.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => removeExercise(exIdx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color="#FF6542" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sesExMeta}>{t('gymRestTimer')}: {ex.restSeconds}s  ·  {t('gymBodyweight')}</Text>
            {ex.sets.map((s, si) => {
              const isDur = isDurationEx(ex.name);
              const timer = durationTimers[tKey(exIdx, si)];
              return isDur ? (
                <View key={si} style={[styles.setRow, s.done && styles.setRowDone]}>
                  <Text style={styles.setIdx}>{si + 1}</Text>
                  <TextInput
                    style={styles.setInput}
                    value={s.reps}
                    onChangeText={v => updateSet(exIdx, si, 'reps', v)}
                    keyboardType="numeric"
                    placeholder="10"
                    placeholderTextColor="#7D8799"
                    editable={!s.done && !(timer?.running)}
                  />
                  <Text style={styles.setUnit}>min</Text>
                  {!s.done && (
                    timer?.running ? (
                      <>
                        <Text style={styles.timerCountTxt}>{formatTimer(timer.remaining)}</Text>
                        <TouchableOpacity style={styles.timerBtn} onPress={() => pauseDurationTimer(exIdx, si)}>
                          <Text style={styles.timerBtnTxt}>⏸</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={styles.timerBtn} onPress={() => startDurationTimer(exIdx, si)}>
                        <Text style={styles.timerBtnTxt}>{timer?.remaining ? `▶ ${formatTimer(timer.remaining)}` : '▶ Start'}</Text>
                      </TouchableOpacity>
                    )
                  )}
                  <TouchableOpacity style={[styles.doneBtn, s.done && styles.doneBtnOn, { marginLeft: 'auto' }]} onPress={() => { if (timer?.running) pauseDurationTimer(exIdx, si); tickSet(exIdx, si); }}>
                    <Text style={[styles.doneTxt, s.done && styles.doneTxtOn]}>{s.done ? '✓' : '○'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View key={si} style={[styles.setRow, s.done && styles.setRowDone]}>
                  <Text style={styles.setIdx}>{si + 1}</Text>
                  <TextInput
                    style={styles.setInput}
                    value={s.weight}
                    onChangeText={v => updateSet(exIdx, si, 'weight', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#7D8799"
                    editable={!s.done}
                  />
                  <Text style={styles.setUnit}>kg</Text>
                  <TextInput
                    style={styles.setInput}
                    value={s.reps}
                    onChangeText={v => updateSet(exIdx, si, 'reps', v)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#7D8799"
                    editable={!s.done}
                  />
                  <Text style={styles.setUnit}>×</Text>
                  <TouchableOpacity style={[styles.doneBtn, s.done && styles.doneBtnOn]} onPress={() => tickSet(exIdx, si)}>
                    <Text style={[styles.doneTxt, s.done && styles.doneTxtOn]}>{s.done ? '✓' : '○'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
        <View style={styles.addExRow}>
          <TextInput
            style={styles.addExInput}
            value={addExName}
            onChangeText={setAddExName}
            placeholder={lang === 'en' ? 'Add exercise...' : 'Tambah latihan...'}
            placeholderTextColor="#7D8799"
            returnKeyType="done"
            onSubmitEditing={addExercise}
          />
          <TouchableOpacity style={styles.addExBtn} onPress={addExercise}>
            <Ionicons name="add" size={22} color="#FFFDF7" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.finishBtn, estimatingKcal && { opacity: 0.7 }]} onPress={finishSession} disabled={estimatingKcal}>
          {estimatingKcal
            ? <ActivityIndicator color="#FFFDF7" />
            : <Text style={styles.finishTxt}>🏁  {t('gymFinishSession')}</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {view === 'setup' && renderSetup()}
      {view === 'plan' && renderPlan()}
      {view === 'session' && renderSession()}
    </SafeAreaView>
  );
}

const G = '#FF6542';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F0E1' },
  scroll: { padding: 18, paddingBottom: 110 },
  pageHeader: { color: '#101A2B', fontSize: 32, lineHeight: 37, fontWeight: '800', fontFamily: 'serif', letterSpacing: -0.8, marginBottom: 18 },
  secLabel: { color: '#C95370', fontSize: 11, fontWeight: '900', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.5 },

  optBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFDF7', borderRadius: 19, padding: 17, marginBottom: 10,
    borderWidth: 1, borderColor: '#E2D9C9',
  },
  optBtnOn: { borderColor: G, backgroundColor: '#FFE6DC' },
  optBtnTxt: { color: '#263247', fontSize: 15, fontWeight: '700' },
  optBtnTxtOn: { color: G, fontWeight: '600' },
  tick: { color: G, fontSize: 16, fontWeight: 'bold' },

  genBtn: { backgroundColor: G, borderRadius: 18, padding: 17, alignItems: 'center', marginTop: 24 },
  genBtnTxt: { color: '#FFFDF7', fontSize: 16, fontWeight: 'bold' },
  genHint: { color: '#AAB3C2', fontSize: 13, textAlign: 'center', marginTop: 8 },

  planHdrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  planMeta: { color: '#737A84', fontSize: 12, marginBottom: 18 },
  resetBtn: { padding: 6 },
  resetBtnTxt: { color: '#FF7043', fontSize: 13 },

  dayCard: { backgroundColor: '#FFFDF7', borderRadius: 24, marginBottom: 14, borderWidth: 1, borderColor: '#E2D9C9', overflow: 'hidden', shadowColor: '#101A2B', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  dayHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  dayTitle: { color: '#101A2B', fontSize: 17, fontWeight: '900' },
  daySub: { color: '#737A84', fontSize: 12, marginTop: 3 },
  chevron: { color: '#7D8799', fontSize: 14 },
  dayBody: { padding: 14, paddingTop: 0 },
  exRow: { marginBottom: 10 },
  exNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  exName: { color: '#101A2B', fontSize: 14, fontWeight: '800' },
  exMeta: { color: '#8D97A8', fontSize: 12, marginTop: 2 },
  startBtn: { backgroundColor: G, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
  startBtnTxt: { color: '#FFFDF7', fontWeight: 'bold', fontSize: 14 },

  restBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e3a5f', padding: 12, paddingHorizontal: 16 },
  restTxt: { color: '#8D9BFF', fontSize: 16, fontWeight: 'bold' },
  skipTxt: { color: '#90CAF9', fontSize: 14, padding: 4 },

  sesExCard: { backgroundColor: '#FFFDF7', borderRadius: 24, padding: 17, marginBottom: 13, borderWidth: 1, borderColor: '#E2D9C9' },
  sesExHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sesExNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sesExName: { color: '#101A2B', fontSize: 16, fontWeight: '900' },

  addExRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 8 },
  addExInput: { flex: 1, backgroundColor: '#1a1a2e', color: '#FFFDF7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: '#26334A' },
  addExBtn: { backgroundColor: G, borderRadius: 8, width: 44, alignItems: 'center', justifyContent: 'center' },
  sesExMeta: { color: '#8D97A8', fontSize: 11, marginBottom: 12 },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#111' },
  setRowDone: { opacity: 0.5 },
  setIdx: { color: '#7D8799', fontSize: 13, width: 18, textAlign: 'center' },
  setInput: { backgroundColor: '#1a1a2e', color: '#FFFDF7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, width: 58, textAlign: 'center', fontSize: 15, borderWidth: 1, borderColor: '#26334A' },
  setUnit: { color: '#7D8799', fontSize: 12 },
  doneBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a2e', borderWidth: 2, borderColor: '#657086', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  doneBtnOn: { backgroundColor: G, borderColor: G },
  doneTxt: { color: '#7D8799', fontSize: 16, fontWeight: 'bold' },
  doneTxtOn: { color: '#FFFDF7' },

  finishBtn: { backgroundColor: '#388E3C', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  finishTxt: { color: '#FFFDF7', fontSize: 16, fontWeight: 'bold' },

  timerBtn: { backgroundColor: '#1565C0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6 },
  timerBtnTxt: { color: '#90CAF9', fontSize: 13, fontWeight: '600' },
  timerCountTxt: { color: '#8D9BFF', fontSize: 15, fontWeight: 'bold', marginLeft: 8, minWidth: 44 },
});
