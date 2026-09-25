import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  LayoutAnimation,
  Modal,
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
import { fsUpsert } from '../firebase';
import { runLeanLogAi } from '../services/ai';
import { useLanguage } from '../context/LanguageContext';
import type { GymGoal, FitnessLevel, WorkoutPlan, WorkoutDay, GymSession, UserProfile, ActivityEntry } from '../types';
import {
  cancelRestNotification,
  clearWorkoutDraft,
  CoachDraftExercise,
  latestExercisePerformance,
  loadGymHistory,
  loadWorkoutDraft,
  offlineWorkoutCalories,
  progressionSuggestion,
  saveWorkoutDraft,
  scheduleRestFinished,
  workoutHistorySummary,
  WorkoutDraft,
} from '../services/workoutCoach';

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
const platesPerSide = (totalKg: number) => {
  let remaining = Math.max(0, (totalKg - 20) / 2);
  const plates: number[] = [];
  [20, 15, 10, 5, 2.5, 1.25].forEach((plate) => { while (remaining >= plate - 0.01) { plates.push(plate); remaining -= plate; } });
  return plates.length && remaining < 0.1 ? plates.join(' + ') : null;
};
const exercise = (name: string, weight = 0, reps = 10, restSeconds = 90) => ({ name, restSeconds, sets: Array.from({ length: 3 }, () => ({ reps, weight, done: false })) });
const offlinePlan = (equipment: string[]): WorkoutDay[] => {
  const has = (id: string) => equipment.includes(id) || equipment.includes('full_gym');
  const press = has('barbell') && has('bench') ? exercise('Bench Press', 20) : has('dumbbells') ? exercise('Dumbbell Press', 5) : exercise('Push-up', 0, 10, 60);
  const row = has('cables') ? exercise('Cable Row', 10) : has('dumbbells') ? exercise('One-arm Dumbbell Row', 5) : exercise('Prone Y-T-W Raise', 0, 12, 60);
  const squat = has('barbell') ? exercise('Barbell Squat', 20, 8, 120) : has('dumbbells') ? exercise('Goblet Squat', 5, 10) : exercise('Bodyweight Squat', 0, 15, 60);
  return [
    { label: 'Push Day', exercises: [press, has('dumbbells') ? exercise('Dumbbell Shoulder Press', 5) : exercise('Pike Push-up', 0, 8), has('pec_fly') ? exercise('Pec Fly', 10, 12, 60) : exercise('Incline Push-up', 0, 12, 60), exercise('Triceps Extension', has('dumbbells') ? 5 : 0, 12, 60)] },
    { label: 'Pull Day', exercises: [row, has('pullup') ? exercise('Assisted Pull-up', 0, 6, 120) : exercise('Reverse Snow Angel', 0, 12, 60), has('dumbbells') ? exercise('Dumbbell Curl', 5, 12, 60) : exercise('Isometric Towel Curl', 0, 12, 60), exercise('Rear Delt Raise', has('dumbbells') ? 3 : 0, 12, 60)] },
    { label: 'Leg Day', exercises: [squat, has('leg_press') ? exercise('Leg Press', 20, 10, 120) : exercise('Reverse Lunge', has('dumbbells') ? 5 : 0, 10), exercise('Romanian Deadlift', has('dumbbells') || has('barbell') ? 10 : 0, 10), exercise('Standing Calf Raise', 0, 15, 60)] },
    { label: 'Full Body & Core', exercises: [exercise('Plank', 0, 1, 60), exercise('Glute Bridge', 0, 15, 60), has('treadmill') ? exercise('Treadmill Walk', 0, 15, 30) : exercise('Mountain Climber', 0, 12, 45)] },
  ];
};

interface SessionSet { reps: string; weight: string; done: boolean; warmup?: boolean; rpe?: number; }
interface SessionExercise { name: string; restSeconds: number; notes?: string; sets: SessionSet[]; }

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
  const [history, setHistory] = useState<GymSession[]>([]);
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingDay, setPendingDay] = useState<{ day: WorkoutDay; index: number } | null>(null);
  const [energy, setEnergy] = useState(3);
  const [soreness, setSoreness] = useState(2);
  const [sleepMinutes, setSleepMinutes] = useState(0);

  // Session
  const [sessionDayLabel, setSessionDayLabel] = useState('');
  const [sessionDayIndex, setSessionDayIndex] = useState(0);
  const [sessionModified, setSessionModified] = useState(false);
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([]);
  const [sessionStart, setSessionStart] = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionReadiness, setSessionReadiness] = useState<{ energy: number; soreness: number; sleepMinutes: number } | undefined>();
  const [addExName, setAddExName] = useState('');
  const [estimatingKcal, setEstimatingKcal] = useState(false);

  // Rest timer
  const [restRemaining, setRestRemaining] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restNotificationRef = useRef<string | null>(null);

  // Duration timers (for cardio/plank/treadmill sets)
  const [durationTimers, setDurationTimers] = useState<Record<string, { remaining: number; running: boolean }>>({});
  const timerRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    loadData();
    return () => {
      if (restRef.current) clearInterval(restRef.current);
      Object.values(timerRefs.current).forEach(clearInterval);
      cancelRestNotification(restNotificationRef.current);
    };
  }, []);

  useEffect(() => {
    if (view !== 'session' || !sessionStart) return;
    const update = () => setSessionElapsed(Math.max(0, Math.floor((Date.now() - sessionStart) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [view, sessionStart]);

  useEffect(() => {
    if (view !== 'session' || !sessionStart || !sessionExercises.length) return;
    const timer = setTimeout(() => saveWorkoutDraft({
      dayLabel: sessionDayLabel, dayIndex: sessionDayIndex, modified: sessionModified,
      exercises: sessionExercises, startedAt: sessionStart, readiness: sessionReadiness,
    }), 180);
    return () => clearTimeout(timer);
  }, [view, sessionDayLabel, sessionDayIndex, sessionModified, sessionExercises, sessionStart, sessionReadiness]);

  const loadData = async () => {
    const [planStr, setupStr, savedHistory, savedDraft, healthRaw] = await Promise.all([
      AsyncStorage.getItem(GYM_PLAN_KEY),
      AsyncStorage.getItem(GYM_SETUP_KEY),
      loadGymHistory(),
      loadWorkoutDraft(),
      AsyncStorage.getItem('widget_health_snapshot'),
    ]);
    setHistory(savedHistory);
    setDraft(savedDraft);
    if (healthRaw) setSleepMinutes(Number(JSON.parse(healthRaw).sleepMinutes) || 0);
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
      if (!Array.isArray(data.days) || data.days.length < 3 || data.days.some((day: any) => !day.label || !Array.isArray(day.exercises))) throw new Error('INVALID_PLAN');

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
      const plan: WorkoutPlan = { id: Date.now().toString(), createdAt: new Date().toLocaleDateString('ms-MY'), goal, level, equipment: selectedEquipment, days: offlinePlan(selectedEquipment) };
      await Promise.all([
        AsyncStorage.setItem(GYM_PLAN_KEY, JSON.stringify(plan)),
        AsyncStorage.setItem(GYM_SETUP_KEY, JSON.stringify({ goal, level, equipment: selectedEquipment })),
      ]);
      setGymPlan(plan);
      setView('plan');
      Alert.alert('Offline plan ready', lang === 'en' ? 'AI was unavailable, so LeanLog built a safe equipment-matched starter plan offline.' : 'AI tidak tersedia, jadi LeanLog bina starter plan offline berdasarkan equipment anda.');
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
    setPendingDay({ day, index: dayIdx });
    setEnergy(3);
    setSoreness(2);
  };

  const beginSession = () => {
    if (!pendingDay) return;
    const { day, index: dayIdx } = pendingDay;
    clearWorkoutDraft();
    setDraft(null);
    setSessionDayLabel(day.label);
    setSessionDayIndex(dayIdx);
    setSessionModified(false);
    setAddExName('');
    setSessionExercises(day.exercises.map(ex => {
      const previous = latestExercisePerformance(history, ex.name);
      return {
        name: ex.name,
        restSeconds: ex.restSeconds ?? 90,
        notes: '',
        sets: ex.sets.map((s, index) => ({
          reps: String(previous?.sets[index]?.reps ?? s.reps),
          weight: String(previous?.sets[index]?.weight ?? s.weight),
          done: false,
          warmup: false,
        })),
      };
    }));
    setSessionStart(Date.now());
    setSessionReadiness({ energy, soreness, sleepMinutes });
    if (restRef.current) clearInterval(restRef.current);
    setRestRemaining(0);
    Object.values(timerRefs.current).forEach(clearInterval);
    timerRefs.current = {};
    setDurationTimers({});
    setPendingDay(null);
    setView('session');
  };

  const resumeDraft = (saved: WorkoutDraft) => {
    setSessionDayLabel(saved.dayLabel);
    setSessionDayIndex(saved.dayIndex);
    setSessionModified(saved.modified);
    setSessionExercises(saved.exercises);
    setSessionStart(saved.startedAt);
    setSessionReadiness(saved.readiness);
    setView('session');
  };

  const discardDraft = () => Alert.alert('Discard workout?', 'Completed sets in this draft will be removed.', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: async () => { await clearWorkoutDraft(); setDraft(null); } },
  ]);

  const pauseSession = async () => {
    const saved: WorkoutDraft = { dayLabel: sessionDayLabel, dayIndex: sessionDayIndex, modified: sessionModified, exercises: sessionExercises, startedAt: sessionStart, readiness: sessionReadiness };
    await saveWorkoutDraft(saved);
    setDraft(saved);
    skipRest();
    setView('plan');
  };

  const updateSet = (exIdx: number, si: number, field: 'reps' | 'weight', val: string) =>
    setSessionExercises(prev => prev.map((ex, ei) => ei !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((s, sj) => sj !== si ? s : { ...s, [field]: val }),
    }));

  const tickSet = (exIdx: number, si: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const wasDone = sessionExercises[exIdx].sets[si].done;
    setSessionExercises(prev => prev.map((ex, ei) => ei !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((s, sj) => sj !== si ? s : { ...s, done: !s.done }),
    }));
    if (!wasDone) startRest(sessionExercises[exIdx].restSeconds ?? 90);
  };

  const startRest = async (seconds: number) => {
    if (restRef.current) clearInterval(restRef.current);
    await cancelRestNotification(restNotificationRef.current);
    restNotificationRef.current = await scheduleRestFinished(seconds);
    setRestRemaining(seconds);
    restRef.current = setInterval(() => {
      setRestRemaining(prev => {
        if (prev <= 1) { clearInterval(restRef.current!); restRef.current = null; Vibration.vibrate([0, 300, 130, 300]); restNotificationRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const skipRest = () => {
    if (restRef.current) { clearInterval(restRef.current); restRef.current = null; }
    cancelRestNotification(restNotificationRef.current);
    restNotificationRef.current = null;
    setRestRemaining(0);
  };

  const extendRest = async () => {
    const next = restRemaining + 30;
    if (restRef.current) clearInterval(restRef.current);
    await cancelRestNotification(restNotificationRef.current);
    startRest(next);
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSessionExercises(prev => prev.filter((_, i) => i !== exIdx));
    setSessionModified(true);
  };

  const addSet = (exIdx: number, warmup = false) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSessionExercises(prev => prev.map((exercise, index) => index !== exIdx ? exercise : {
      ...exercise,
      sets: [...exercise.sets, { reps: warmup ? '8' : (exercise.sets.at(-1)?.reps || '10'), weight: warmup ? '0' : (exercise.sets.at(-1)?.weight || '0'), done: false, warmup }],
    }));
    setSessionModified(true);
  };

  const updateRpe = (exIdx: number, si: number, value: string) => setSessionExercises(prev => prev.map((exercise, index) => index !== exIdx ? exercise : {
    ...exercise,
    sets: exercise.sets.map((set, setIndex) => setIndex === si ? { ...set, rpe: Math.max(1, Math.min(10, Number(value) || 0)) || undefined } : set),
  }));

  const removeSet = (exIdx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSessionExercises(prev => prev.map((exercise, index) => index !== exIdx || exercise.sets.length <= 1 ? exercise : { ...exercise, sets: exercise.sets.slice(0, -1) }));
    setSessionModified(true);
  };

  const moveExercise = (exIdx: number, direction: -1 | 1) => {
    const target = exIdx + direction;
    if (target < 0 || target >= sessionExercises.length) return;
    setSessionExercises(prev => {
      const next = [...prev];
      [next[exIdx], next[target]] = [next[target], next[exIdx]];
      return next;
    });
    setSessionModified(true);
  };

  const updateExerciseNote = (exIdx: number, notes: string) => setSessionExercises(prev => prev.map((exercise, index) => index === exIdx ? { ...exercise, notes } : exercise));
  const updateExerciseName = (exIdx: number, name: string) => {
    setSessionExercises(prev => prev.map((exercise, index) => index === exIdx ? { ...exercise, name } : exercise));
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
          sets: ex.sets.map(s => ({ reps: parseInt(s.reps) || 10, weight: parseFloat(s.weight) || 0, done: false, warmup: s.warmup, rpe: s.rpe })),
          restSeconds: ex.restSeconds,
        })),
      }),
    };
    await AsyncStorage.setItem(GYM_PLAN_KEY, JSON.stringify(updatedPlan));
    setGymPlan(updatedPlan);
  };

  const finishSession = async () => {
    if (!sessionExercises.some((exercise) => exercise.sets.some((set) => set.done))) {
      Alert.alert('Nothing completed yet', 'Tick at least one set before finishing the session.');
      return;
    }
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
        notes: ex.notes,
        sets: ex.sets.map(s => ({ reps: parseInt(s.reps) || 0, weight: parseFloat(s.weight) || 0, done: s.done, warmup: s.warmup, rpe: s.rpe })),
      })),
      durationMin,
      startedAt: new Date(sessionStart).toISOString(),
      endedAt: now.toISOString(),
      source: 'coach',
      readiness: sessionReadiness,
    };
    try {
      const existing = await AsyncStorage.getItem(GYM_SESSIONS_KEY);
      const all: GymSession[] = existing ? JSON.parse(existing) : [];
      all.push(session);
      await AsyncStorage.setItem(GYM_SESSIONS_KEY, JSON.stringify(all));
      fsUpsert('gymSessions', session.id, session).catch(() => {});
    } catch {}

    const kcal = await offlineWorkoutCalories(durationMin, sessionExercises as CoachDraftExercise[]);
    session.caloriesBurned = kcal;
    try {
      const existing = await AsyncStorage.getItem(GYM_SESSIONS_KEY);
      const all: GymSession[] = existing ? JSON.parse(existing) : [];
      const index = all.findIndex((item) => item.id === session.id);
      if (index >= 0) all[index] = session;
      await AsyncStorage.setItem(GYM_SESSIONS_KEY, JSON.stringify(all));
      fsUpsert('gymSessions', session.id, session).catch(() => {});
    } catch {}
    setEstimatingKcal(false);
    skipRest();
    Object.values(timerRefs.current).forEach(clearInterval);
    timerRefs.current = {};
    setDurationTimers({});

    const done = () => {
      clearWorkoutDraft();
      setDraft(null);
      setHistory(prev => [session, ...prev]);
      setView('plan');
      Alert.alert('✅', t('gymSessionSaved'));
    };
    const newPrs = session.exercises.filter((exercise) => {
      const previous = latestExercisePerformance(history, exercise.name);
      const bestNow = exercise.sets.filter((set) => set.done && set.weight > 0).reduce((best, set) => Math.max(best, set.weight * (1 + set.reps / 30)), 0);
      return bestNow > (previous?.estimated1RM || 0) && bestNow > 0;
    }).length;

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
        ? `Offline estimate: ~${kcal} kcal burned.${newPrs ? `\n🏆 ${newPrs} estimated strength PR${newPrs === 1 ? '' : 's'}!` : ''}\nHealth Connect can replace calories with watch data later.\n\nLog as today's activity?`
        : `Anggaran offline: ~${kcal} kcal dibakar.${newPrs ? `\n🏆 ${newPrs} rekod kekuatan baru!` : ''}\nHealth Connect boleh gantikan kalori dengan data jam nanti.\n\nLog sebagai aktiviti hari ini?`,
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
    const lastSession = history[0];
    const lastIndex = lastSession ? gymPlan.days.findIndex((day) => day.label === lastSession.planDayLabel) : -1;
    const recommendedIndex = lastIndex >= 0 ? (lastIndex + 1) % gymPlan.days.length : 0;
    const recommended = gymPlan.days[recommendedIndex];
    const report = workoutHistorySummary(history);
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.planHdrRow}>
          <Text style={styles.pageHeader}>{t('gymPlanTitle')}</Text>
          <TouchableOpacity onPress={resetPlan} style={styles.resetBtn}>
            <Text style={styles.resetBtnTxt}>↺ {t('gymReset')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.planMeta}>{gymPlan.level} · {gymPlan.goal} · {gymPlan.createdAt}</Text>

        {draft && (
          <View style={styles.resumeCard}>
            <Text style={styles.resumeEyebrow}>WORKOUT IN PROGRESS</Text>
            <Text style={styles.resumeTitle}>{draft.dayLabel}</Text>
            <Text style={styles.resumeMeta}>{draft.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.done).length, 0)}/{draft.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)} sets · started {new Intl.DateTimeFormat('en-MY', { hour: '2-digit', minute: '2-digit' }).format(new Date(draft.startedAt))}</Text>
            <View style={styles.resumeActions}><TouchableOpacity style={styles.resumeButton} onPress={() => resumeDraft(draft)}><Text style={styles.resumeButtonText}>RESUME</Text></TouchableOpacity><TouchableOpacity onPress={discardDraft}><Text style={styles.discardDraft}>Discard</Text></TouchableOpacity></View>
          </View>
        )}

        <View style={styles.todayWorkoutCard}>
          <View style={styles.todayWorkoutTop}><Text style={styles.todayWorkoutEyebrow}>TODAY'S RECOMMENDATION</Text><Ionicons name="sparkles" size={18} color="#E5B84B" /></View>
          <Text style={styles.todayWorkoutTitle}>{recommended.label}</Text>
          <Text style={styles.todayWorkoutMeta}>{recommended.exercises.length} exercises · ±{recommended.exercises.length * 12} min{lastSession ? ` · last: ${lastSession.planDayLabel}` : ''}</Text>
          <Text style={styles.todayWorkoutCoach}>{sleepMinutes > 0 && sleepMinutes < 360 ? 'Sleep was low. Keep the weights steady and leave one rep in reserve.' : 'Continue your rotation. Beat one small number—not your whole body.'}</Text>
          <TouchableOpacity style={styles.todayStartButton} onPress={() => startSession(recommended, recommendedIndex)}><Text style={styles.todayStartText}>START {recommended.label.toUpperCase()} →</Text></TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.trainingReportCard} onPress={() => setShowHistory(true)}>
          <View><Text style={styles.trainingReportEyebrow}>LAST 30 DAYS</Text><Text style={styles.trainingReportTitle}>{report.sessions} sessions · {Math.floor(report.minutes / 60)}h {report.minutes % 60}m</Text></View>
          <View style={{ alignItems: 'flex-end' }}><Text style={styles.trainingReportVolume}>{Math.round(report.volume).toLocaleString()}kg</Text><Text style={styles.trainingReportLabel}>training volume →</Text></View>
        </TouchableOpacity>

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
                      {latestExercisePerformance(history, ex.name) && <Text style={styles.lastPerformance}>LAST · {latestExercisePerformance(history, ex.name)!.sets.map((set) => `${set.weight}kg×${set.reps}`).join(' · ')}</Text>}
                      {progressionSuggestion(history, ex.name) && <Text style={styles.progressionHint}>↗ {progressionSuggestion(history, ex.name)!.label}</Text>}
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

  const totalSessionSets = sessionExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const completedSessionSets = sessionExercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.done).length, 0);
  const sessionProgress = totalSessionSets ? Math.round((completedSessionSets / totalSessionSets) * 100) : 0;

  // ── SESSION VIEW ────────────────────────────────────────────────────────────
  const renderSession = () => (
    <View style={{ flex: 1 }}>
      {restRemaining > 0 && (
        <View style={styles.restBanner}>
          <Text style={styles.restTxt}>⏱  {t('gymRestTimer')}: {restRemaining}s</Text>
          <View style={styles.restActions}><TouchableOpacity onPress={extendRest}><Text style={styles.extendRest}>+30s</Text></TouchableOpacity><TouchableOpacity onPress={skipRest}><Text style={styles.skipTxt}>{t('gymSkipRest')}</Text></TouchableOpacity></View>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.sessionHero}>
          <View style={styles.sessionHeroTop}><View><Text style={styles.sessionEyebrow}>LIVE SESSION</Text><Text style={styles.sessionHeroTitle}>{sessionDayLabel}</Text></View><Text style={styles.sessionClock}>{formatTimer(sessionElapsed)}</Text></View>
          <View style={styles.sessionProgressTrack}><View style={[styles.sessionProgressFill, { width: `${sessionProgress}%` }]} /></View>
          <View style={styles.sessionProgressMeta}><Text style={styles.sessionProgressText}>{completedSessionSets}/{totalSessionSets} sets complete</Text><Text style={styles.sessionProgressText}>{sessionProgress}%</Text></View>
          {sessionReadiness && <Text style={styles.readinessSummary}>Energy {sessionReadiness.energy}/5 · Soreness {sessionReadiness.soreness}/5 · Sleep {Math.floor(sessionReadiness.sleepMinutes / 60)}h {sessionReadiness.sleepMinutes % 60}m</Text>}
          <TouchableOpacity style={styles.pauseSessionButton} onPress={pauseSession}><Ionicons name="pause-circle-outline" size={15} color="#E7BB51" /><Text style={styles.pauseSessionText}>PAUSE & KEEP DRAFT</Text></TouchableOpacity>
        </View>
        {sessionExercises.map((ex, exIdx) => (
          <View key={exIdx} style={styles.sesExCard}>
            <View style={styles.sesExHeader}>
              <View style={styles.sesExNameRow}>
                <TextInput style={styles.sesExNameInput} value={ex.name} onChangeText={value => updateExerciseName(exIdx, value)} selectTextOnFocus />
                <TouchableOpacity onPress={() => openYouTube(ex.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => removeExercise(exIdx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={20} color="#FF6542" />
              </TouchableOpacity>
            </View>
            <View style={styles.exerciseQuickRow}>
              <Text style={styles.sesExMeta}>{t('gymRestTimer')}: {ex.restSeconds}s</Text>
              <TouchableOpacity onPress={() => moveExercise(exIdx, -1)}><Ionicons name="arrow-up" size={15} color="#68758A" /></TouchableOpacity>
              <TouchableOpacity onPress={() => moveExercise(exIdx, 1)}><Ionicons name="arrow-down" size={15} color="#68758A" /></TouchableOpacity>
            </View>
            {latestExercisePerformance(history, ex.name) && <Text style={styles.sessionLastLine}>LAST · {latestExercisePerformance(history, ex.name)!.sets.map((set) => `${set.weight}×${set.reps}`).join(' · ')} · e1RM {latestExercisePerformance(history, ex.name)!.estimated1RM}kg</Text>}
            {progressionSuggestion(history, ex.name) && <Text style={styles.sessionSuggestion}>TODAY · {progressionSuggestion(history, ex.name)!.label}</Text>}
            {/barbell|bench press|squat|deadlift/i.test(ex.name) && platesPerSide(Number(ex.sets[0]?.weight)) && <Text style={styles.plateHint}>PLATES / SIDE · {platesPerSide(Number(ex.sets[0]?.weight))} kg + 20kg bar</Text>}
            {ex.sets.map((s, si) => {
              const isDur = isDurationEx(ex.name);
              const timer = durationTimers[tKey(exIdx, si)];
              return isDur ? (
                <View key={si} style={[styles.setRow, s.warmup && styles.warmupRow, s.done && styles.setRowDone]}>
                  <Text style={styles.setIdx}>{s.warmup ? 'W' : si + 1}</Text>
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
                <View key={si} style={[styles.setRow, s.warmup && styles.warmupRow, s.done && styles.setRowDone]}>
                  <Text style={styles.setIdx}>{s.warmup ? 'W' : si + 1}</Text>
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
                  <TextInput style={styles.rpeInput} value={s.rpe ? String(s.rpe) : ''} onChangeText={v => updateRpe(exIdx, si, v)} keyboardType="numeric" placeholder="RPE" placeholderTextColor="#68758A" editable={!s.done} />
                  <TouchableOpacity style={[styles.doneBtn, s.done && styles.doneBtnOn]} onPress={() => tickSet(exIdx, si)}>
                    <Text style={[styles.doneTxt, s.done && styles.doneTxtOn]}>{s.done ? '✓' : '○'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <View style={styles.setActions}><TouchableOpacity onPress={() => removeSet(exIdx)}><Text style={styles.setActionText}>− SET</Text></TouchableOpacity><TouchableOpacity onPress={() => addSet(exIdx, true)}><Text style={styles.setActionText}>＋ WARM-UP</Text></TouchableOpacity><TouchableOpacity onPress={() => addSet(exIdx)}><Text style={styles.setActionPrimary}>＋ WORK SET</Text></TouchableOpacity></View>
            <TextInput style={styles.exerciseNoteInput} value={ex.notes || ''} onChangeText={value => updateExerciseNote(exIdx, value)} placeholder="Exercise note · grip, form, pain, setup..." placeholderTextColor="#8A93A1" />
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

      <Modal visible={!!pendingDay} transparent animationType="fade" onRequestClose={() => setPendingDay(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.readinessModal}>
            <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>READINESS CHECK</Text><Text style={styles.modalTitle}>How are we training?</Text></View><TouchableOpacity onPress={() => setPendingDay(null)}><Ionicons name="close" size={23} color="#101A2B" /></TouchableOpacity></View>
            <View style={styles.sleepSignal}><Ionicons name="moon-outline" size={20} color="#5C5AA3" /><View><Text style={styles.sleepSignalValue}>{Math.floor(sleepMinutes / 60)}h {sleepMinutes % 60}m sleep</Text><Text style={styles.sleepSignalHint}>{sleepMinutes > 0 && sleepMinutes < 360 ? 'Low recovery signal · keep one rep in reserve' : 'Recovery signal from Health Connect'}</Text></View></View>
            <Text style={styles.readinessLabel}>ENERGY · {energy}/5</Text>
            <View style={styles.scoreRow}>{[1,2,3,4,5].map(score => <TouchableOpacity key={score} style={[styles.scoreButton, energy === score && styles.scoreButtonActive]} onPress={() => setEnergy(score)}><Text style={[styles.scoreText, energy === score && styles.scoreTextActive]}>{score}</Text></TouchableOpacity>)}</View>
            <Text style={styles.readinessLabel}>SORENESS · {soreness}/5</Text>
            <View style={styles.scoreRow}>{[1,2,3,4,5].map(score => <TouchableOpacity key={score} style={[styles.scoreButton, soreness === score && styles.scoreButtonActive]} onPress={() => setSoreness(score)}><Text style={[styles.scoreText, soreness === score && styles.scoreTextActive]}>{score}</Text></TouchableOpacity>)}</View>
            <Text style={styles.readinessAdvice}>{energy <= 2 || soreness >= 4 || (sleepMinutes > 0 && sleepMinutes < 360) ? 'Today: maintain weight, reduce one work set if form drops.' : 'Today: normal session. Chase clean reps, not chaos.'}</Text>
            <TouchableOpacity style={styles.beginButton} onPress={beginSession}><Text style={styles.beginButtonText}>BEGIN {pendingDay?.day.label.toUpperCase()}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showHistory} transparent animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <View style={styles.historyOverlay}>
          <View style={styles.historySheet}>
            <View style={styles.historyHandle} />
            <View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>TRAINING REPORT</Text><Text style={styles.modalTitle}>Proof you showed up.</Text></View><TouchableOpacity onPress={() => setShowHistory(false)}><Ionicons name="close" size={23} color="#101A2B" /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
              <View style={styles.reportStats}>
                <View style={styles.reportStat}><Text style={styles.reportStatValue}>{workoutHistorySummary(history).sessions}</Text><Text style={styles.reportStatLabel}>sessions / 30d</Text></View>
                <View style={styles.reportStat}><Text style={styles.reportStatValue}>{workoutHistorySummary(history).minutes}</Text><Text style={styles.reportStatLabel}>minutes</Text></View>
                <View style={styles.reportStat}><Text style={styles.reportStatValue}>{Math.round(workoutHistorySummary(history).volume / 1000)}k</Text><Text style={styles.reportStatLabel}>kg volume</Text></View>
              </View>
              <Text style={styles.reportSectionTitle}>EXERCISE TRENDS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exerciseTrendRow}>
                {[...new Set(history.flatMap(session => session.exercises.map(exercise => exercise.name)))].slice(0, 8).map(name => {
                  const performance = latestExercisePerformance(history, name);
                  return <View key={name} style={styles.exerciseTrendCard}><Text style={styles.exerciseTrendName} numberOfLines={1}>{name}</Text><Text style={styles.exerciseTrendValue}>{performance?.estimated1RM || 0}kg</Text><Text style={styles.exerciseTrendLabel}>estimated 1RM</Text><Text style={styles.exerciseTrendLast} numberOfLines={1}>{performance?.sets.map(set => `${set.weight}×${set.reps}`).join(' · ') || 'No work sets'}</Text></View>;
                })}
              </ScrollView>
              <Text style={styles.reportSectionTitle}>RECENT SESSIONS</Text>
              {history.length ? history.slice(0, 12).map(session => {
                const done = session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter(set => set.done).length, 0);
                const volume = session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter(set => set.done && !set.warmup).reduce((setSum, set) => setSum + set.weight * set.reps, 0), 0);
                return <View key={session.id} style={styles.historyRow}><View style={styles.historyDateBadge}><Text style={styles.historyDateText}>{session.date.split('/')[0]}</Text></View><View style={{ flex: 1 }}><Text style={styles.historyName}>{session.planDayLabel}</Text><Text style={styles.historyMeta}>{session.date} · {session.durationMin} min · {done} sets</Text><Text style={styles.historyExercises} numberOfLines={1}>{session.exercises.map(exercise => exercise.name).join(' · ')}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={styles.historyVolume}>{Math.round(volume).toLocaleString()}kg</Text><Text style={styles.historySource}>{session.source === 'health-merged' ? '⌚ MERGED' : 'COACH'}</Text></View></View>;
              }) : <Text style={styles.emptyHistory}>Finish your first Coach session and the report will grow here.</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  resumeCard: { backgroundColor: '#17243A', borderRadius: 23, padding: 17, marginBottom: 13, borderWidth: 1, borderColor: '#2D405D' },
  resumeEyebrow: { color: '#91DCBB', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  resumeTitle: { color: '#FFFDF7', fontFamily: 'serif', fontSize: 23, fontWeight: '800', marginTop: 5 },
  resumeMeta: { color: '#94A1B4', fontSize: 10, marginTop: 3 },
  resumeActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 13 },
  resumeButton: { backgroundColor: '#91DCBB', borderRadius: 12, paddingHorizontal: 19, paddingVertical: 10 },
  resumeButtonText: { color: '#101A2B', fontSize: 10, fontWeight: '900' },
  discardDraft: { color: '#FF6542', fontSize: 10, fontWeight: '800' },
  todayWorkoutCard: { backgroundColor: '#FFFDF7', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: '#E2D9C9', marginBottom: 12 },
  todayWorkoutTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayWorkoutEyebrow: { color: '#C95370', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  todayWorkoutTitle: { color: '#101A2B', fontFamily: 'serif', fontSize: 30, fontWeight: '800', marginTop: 9 },
  todayWorkoutMeta: { color: '#737A84', fontSize: 11, marginTop: 2 },
  todayWorkoutCoach: { color: '#4D586A', fontSize: 11, lineHeight: 17, backgroundColor: '#F2E9D8', borderRadius: 13, padding: 11, marginTop: 13 },
  todayStartButton: { backgroundColor: '#FF6542', borderRadius: 15, padding: 14, alignItems: 'center', marginTop: 12 },
  todayStartText: { color: '#FFFDF7', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  trainingReportCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E7BB51', borderRadius: 20, padding: 15, marginBottom: 15 },
  trainingReportEyebrow: { color: 'rgba(16,26,43,0.6)', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  trainingReportTitle: { color: '#101A2B', fontSize: 13, fontWeight: '900', marginTop: 4 },
  trainingReportVolume: { color: '#101A2B', fontFamily: 'serif', fontSize: 19, fontWeight: '900' },
  trainingReportLabel: { color: 'rgba(16,26,43,0.58)', fontSize: 7 },

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
  lastPerformance: { color: '#53627A', fontSize: 9, fontWeight: '700', marginTop: 5 },
  progressionHint: { color: '#C95370', fontSize: 9, fontWeight: '900', marginTop: 3 },
  startBtn: { backgroundColor: G, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
  startBtnTxt: { color: '#FFFDF7', fontWeight: 'bold', fontSize: 14 },

  restBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E7BB51', padding: 12, paddingHorizontal: 16 },
  restTxt: { color: '#101A2B', fontSize: 16, fontWeight: 'bold' },
  restActions: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  extendRest: { color: '#101A2B', fontSize: 12, fontWeight: '900' },
  skipTxt: { color: '#7B351F', fontSize: 12, fontWeight: '900', padding: 4 },
  sessionHero: { backgroundColor: '#17243A', borderRadius: 25, padding: 17, marginBottom: 14 },
  sessionHeroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sessionEyebrow: { color: '#91DCBB', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  sessionHeroTitle: { color: '#FFFDF7', fontFamily: 'serif', fontSize: 28, fontWeight: '800', marginTop: 5 },
  sessionClock: { color: '#E7BB51', fontSize: 22, fontWeight: '900' },
  sessionProgressTrack: { height: 7, borderRadius: 4, backgroundColor: '#2A3A53', overflow: 'hidden', marginTop: 15 },
  sessionProgressFill: { height: '100%', backgroundColor: '#FF6542', borderRadius: 4 },
  sessionProgressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  sessionProgressText: { color: '#94A1B4', fontSize: 8, fontWeight: '800' },
  readinessSummary: { color: '#91DCBB', fontSize: 8, marginTop: 9 },
  pauseSessionButton: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginTop: 8 },
  pauseSessionText: { color: '#E7BB51', fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },

  sesExCard: { backgroundColor: '#FFFDF7', borderRadius: 24, padding: 17, marginBottom: 13, borderWidth: 1, borderColor: '#E2D9C9' },
  sesExHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sesExNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sesExName: { color: '#101A2B', fontSize: 16, fontWeight: '900' },
  sesExNameInput: { flex: 1, color: '#101A2B', fontSize: 16, fontWeight: '900', paddingVertical: 2 },
  exerciseQuickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 },
  sessionLastLine: { color: '#667389', fontSize: 8, marginBottom: 3 },
  sessionSuggestion: { color: '#C95370', fontSize: 9, fontWeight: '900', marginBottom: 11 },
  plateHint: { color: '#5C5AA3', backgroundColor: '#E8E8FF', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6, fontSize: 8, fontWeight: '900', marginBottom: 9, alignSelf: 'flex-start' },

  addExRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 8 },
  addExInput: { flex: 1, backgroundColor: '#FFFDF7', color: '#101A2B', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, borderWidth: 1, borderColor: '#D9CFBF' },
  addExBtn: { backgroundColor: G, borderRadius: 14, width: 46, alignItems: 'center', justifyContent: 'center' },
  sesExMeta: { color: '#8D97A8', fontSize: 11, marginBottom: 12 },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#17243A' },
  warmupRow: { backgroundColor: '#34314F' },
  setRowDone: { backgroundColor: '#D8EFE4', opacity: 1 },
  setIdx: { color: '#91DCBB', fontSize: 12, fontWeight: '900', width: 18, textAlign: 'center' },
  setInput: { backgroundColor: '#24334C', color: '#FFFDF7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6, width: 52, textAlign: 'center', fontSize: 14, borderWidth: 1, borderColor: '#344560' },
  setUnit: { color: '#7D8799', fontSize: 12 },
  rpeInput: { backgroundColor: '#24334C', color: '#FFFDF7', borderRadius: 8, width: 43, paddingVertical: 6, textAlign: 'center', fontSize: 10 },
  doneBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#24334C', borderWidth: 2, borderColor: '#657086', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  doneBtnOn: { backgroundColor: '#91DCBB', borderColor: '#91DCBB' },
  doneTxt: { color: '#7D8799', fontSize: 16, fontWeight: 'bold' },
  doneTxtOn: { color: '#101A2B' },
  setActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14, marginTop: 3 },
  setActionText: { color: '#68758A', fontSize: 8, fontWeight: '900' },
  setActionPrimary: { color: '#FF6542', fontSize: 8, fontWeight: '900' },
  exerciseNoteInput: { color: '#101A2B', backgroundColor: '#F3EBDC', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8, fontSize: 10, marginTop: 10 },

  finishBtn: { backgroundColor: '#FF6542', borderRadius: 17, padding: 17, alignItems: 'center', marginTop: 10 },
  finishTxt: { color: '#FFFDF7', fontSize: 16, fontWeight: 'bold' },

  timerBtn: { backgroundColor: '#1565C0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6 },
  timerBtnTxt: { color: '#90CAF9', fontSize: 13, fontWeight: '600' },
  timerCountTxt: { color: '#8D9BFF', fontSize: 15, fontWeight: 'bold', marginLeft: 8, minWidth: 44 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(8,14,24,0.72)' },
  readinessModal: { backgroundColor: '#FFFDF7', borderRadius: 28, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalEyebrow: { color: '#C95370', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  modalTitle: { color: '#101A2B', fontFamily: 'serif', fontSize: 25, fontWeight: '800', marginTop: 5 },
  sleepSignal: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#E8E8FF', borderRadius: 15, padding: 12, marginTop: 17 },
  sleepSignalValue: { color: '#101A2B', fontSize: 12, fontWeight: '900' },
  sleepSignalHint: { color: '#676792', fontSize: 8, marginTop: 2 },
  readinessLabel: { color: '#737A84', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 17, marginBottom: 7 },
  scoreRow: { flexDirection: 'row', gap: 7 },
  scoreButton: { flex: 1, height: 39, borderRadius: 12, borderWidth: 1, borderColor: '#D9CFBF', alignItems: 'center', justifyContent: 'center' },
  scoreButtonActive: { backgroundColor: '#17243A', borderColor: '#17243A' },
  scoreText: { color: '#737A84', fontWeight: '900' },
  scoreTextActive: { color: '#91DCBB' },
  readinessAdvice: { color: '#4D586A', backgroundColor: '#F2E9D8', borderRadius: 13, padding: 11, fontSize: 10, lineHeight: 15, marginTop: 16 },
  beginButton: { backgroundColor: '#FF6542', borderRadius: 15, padding: 14, alignItems: 'center', marginTop: 13 },
  beginButtonText: { color: '#FFFDF7', fontSize: 11, fontWeight: '900' },
  historyOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,14,24,0.72)' },
  historySheet: { maxHeight: '90%', backgroundColor: '#F7F0E1', borderTopLeftRadius: 31, borderTopRightRadius: 31, paddingHorizontal: 18, paddingBottom: 10 },
  historyHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#CEC3B2', alignSelf: 'center', marginTop: 10, marginBottom: 14 },
  reportStats: { flexDirection: 'row', gap: 8, marginTop: 17, marginBottom: 10 },
  reportStat: { flex: 1, backgroundColor: '#17243A', borderRadius: 17, padding: 12 },
  reportStatValue: { color: '#FFFDF7', fontFamily: 'serif', fontSize: 22, fontWeight: '900' },
  reportStatLabel: { color: '#91DCBB', fontSize: 7, marginTop: 3 },
  reportSectionTitle: { color: '#737A84', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 15, marginBottom: 8 },
  exerciseTrendRow: { gap: 8, paddingRight: 10 },
  exerciseTrendCard: { width: 145, backgroundColor: '#FFFDF7', borderRadius: 17, padding: 12, borderWidth: 1, borderColor: '#E2D9C9' },
  exerciseTrendName: { color: '#101A2B', fontSize: 10, fontWeight: '900' },
  exerciseTrendValue: { color: '#FF6542', fontFamily: 'serif', fontSize: 24, fontWeight: '900', marginTop: 6 },
  exerciseTrendLabel: { color: '#737A84', fontSize: 7 },
  exerciseTrendLast: { color: '#5C5AA3', fontSize: 7, marginTop: 7 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFDF7', borderRadius: 17, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#E2D9C9' },
  historyDateBadge: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFE0D6', alignItems: 'center', justifyContent: 'center' },
  historyDateText: { color: '#C95370', fontSize: 15, fontWeight: '900' },
  historyName: { color: '#101A2B', fontSize: 12, fontWeight: '900' },
  historyMeta: { color: '#737A84', fontSize: 8, marginTop: 2 },
  historyExercises: { color: '#9299A4', fontSize: 7, marginTop: 3 },
  historyVolume: { color: '#101A2B', fontSize: 11, fontWeight: '900' },
  historySource: { color: '#5C5AA3', fontSize: 6, fontWeight: '900', marginTop: 3 },
  emptyHistory: { color: '#737A84', fontSize: 11, textAlign: 'center', padding: 30 },
});
