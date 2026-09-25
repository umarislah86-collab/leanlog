import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, fsDelete, fsFetchAll, fsFetchSettings, fsUpsert } from '../firebase';
import { ActivityEntry, FoodEntry, GymSession } from '../types';
import { colors, radii, shadow } from '../theme';
import {
  BluecoinsSummary,
  chooseBluecoinsFolder,
  getBluecoinsFolder,
  refreshBluecoinsSummary,
  setCashRealityAccounts,
  setCashRealitySafetyBuffer,
  setBluecoinsMonthlyBudget,
  setBluecoinsPayday,
} from '../services/bluecoins';
import { connectHealth, HealthSnapshot, healthIsConnected, readHealthSnapshot, readRecentHealthWorkouts } from '../services/health';
import { AgendaEvent, calendarIsConnected, connectCalendar, readTodayAgenda } from '../services/agenda';
import { loadInsightData, PersonalStreaks, QuickNote, WeeklyReview } from '../services/insights';
import { refreshLeanLogWidget } from '../services/widget';
import { runLeanLogAi } from '../services/ai';
import { HabitCheckins, habitDateKey, habitReport, habitStreak, loadTinyHabits, saveTinyHabits, setHabitStatus, TinyHabit } from '../services/habits';
import {
  GuardCycle,
  GuardScope,
  GuardTone,
  notifySpendingGuardChanges,
  notifyCashRealityRisk,
  pinSpendingGuard,
  requestSpendingGuardNotifications,
  saveSpendingGuards,
  SpendingGuard,
  syncPinnedGuardSnapshot,
} from '../services/spendingGuards';

const todayKey = () => new Date().toLocaleDateString('ms-MY');
const money = (value: number) => `RM ${value.toFixed(2)}`;
type HealthSyncStatus = { syncedAt: string; detected: number; imported: number; latest: ActivityEntry | null };

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const displayName = () => {
  const user = auth.currentUser;
  const raw = user?.displayName || user?.email?.split('@')[0] || 'bro';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export default function HomeScreen({ navigation }: any) {
  const [refreshing, setRefreshing] = useState(false);
  const [bluecoinsLoading, setBluecoinsLoading] = useState(false);
  const [bluecoinsConnected, setBluecoinsConnected] = useState(false);
  const [bluecoins, setBluecoins] = useState<BluecoinsSummary | null>(null);
  const [showBudgetCoach, setShowBudgetCoach] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [paydayInput, setPaydayInput] = useState('25');
  const [safetyBufferInput, setSafetyBufferInput] = useState('0');
  const [expandedBudgetCategory, setExpandedBudgetCategory] = useState<string | null>(null);
  const [selectedGuardId, setSelectedGuardId] = useState<string | null>(null);
  const [pinnedGuardId, setPinnedGuardId] = useState<string | null>(null);
  const [showGuardEditor, setShowGuardEditor] = useState(false);
  const [editingGuardId, setEditingGuardId] = useState<string | null>(null);
  const [guardName, setGuardName] = useState('');
  const [guardScope, setGuardScope] = useState<GuardScope>('account');
  const [guardTarget, setGuardTarget] = useState('');
  const [guardLimit, setGuardLimit] = useState('');
  const [guardCycle, setGuardCycle] = useState<GuardCycle>('salary');
  const [guardTone, setGuardTone] = useState<GuardTone>('karen');
  const [consumed, setConsumed] = useState(0);
  const [burned, setBurned] = useState(0);
  const [protein, setProtein] = useState(0);
  const [goal, setGoal] = useState(2000);
  const [healthConnected, setHealthConnected] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [healthSync, setHealthSync] = useState<HealthSyncStatus | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [agenda, setAgenda] = useState<AgendaEvent[]>([]);
  const [weekly, setWeekly] = useState<WeeklyReview | null>(null);
  const [streaks, setStreaks] = useState<PersonalStreaks | null>(null);
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [aiReview, setAiReview] = useState('');
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [tinyHabits, setTinyHabits] = useState<TinyHabit[]>([]);
  const [habitCheckins, setHabitCheckins] = useState<HabitCheckins>({});
  const [showHabitCreator, setShowHabitCreator] = useState(false);
  const [showHabitReport, setShowHabitReport] = useState(false);
  const [editingHabit, setEditingHabit] = useState<TinyHabit | null>(null);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitEmoji, setNewHabitEmoji] = useState('✨');
  const [newHabitDays, setNewHabitDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const loadLeanLog = useCallback(async () => {
    const [foodRaw, activityRaw, goalRaw] = await Promise.all([
      AsyncStorage.getItem('calorie_entries'),
      AsyncStorage.getItem('activity_entries'),
      AsyncStorage.getItem('calorie_goal'),
    ]);
    let food: FoodEntry[] = foodRaw ? JSON.parse(foodRaw) : [];
    let activities: ActivityEntry[] = activityRaw ? JSON.parse(activityRaw) : [];
    let resolvedGoal = goalRaw ? Number(goalRaw) : 2000;
    if (!food.length || !activities.length || !goalRaw) {
      const [cloudFood, cloudActivities, cloudSettings] = await Promise.all([
        !food.length ? fsFetchAll<FoodEntry>('foodEntries').catch(() => []) : Promise.resolve([]),
        !activities.length ? fsFetchAll<ActivityEntry>('activityEntries').catch(() => []) : Promise.resolve([]),
        !goalRaw ? fsFetchSettings().catch(() => null) : Promise.resolve(null),
      ]);
      if (!food.length && cloudFood.length) {
        food = cloudFood;
        await AsyncStorage.setItem('calorie_entries', JSON.stringify(food));
      }
      if (!activities.length && cloudActivities.length) {
        activities = cloudActivities;
        await AsyncStorage.setItem('activity_entries', JSON.stringify(activities));
      }
      if (!goalRaw && cloudSettings?.goal) {
        resolvedGoal = cloudSettings.goal;
        await AsyncStorage.setItem('calorie_goal', String(resolvedGoal));
      }
    }
    const today = todayKey();
    const todayFood = food.filter((entry) => entry.date === today);
    const todayActivities = activities.filter((entry) => entry.date === today);
    setConsumed(todayFood.reduce((sum, entry) => sum + entry.calories, 0));
    setBurned(todayActivities.reduce((sum, entry) => sum + entry.caloriesBurned, 0));
    setProtein(Math.round(todayFood.reduce(
      (sum, entry) => sum + entry.items.reduce((itemSum, item) => itemSum + (item.protein || 0), 0),
      0,
    )));
    setGoal(resolvedGoal);
  }, []);

  const loadBluecoins = useCallback(async (quiet = false) => {
    const folder = await getBluecoinsFolder();
    setBluecoinsConnected(!!folder);
    if (!folder) return;
    if (!quiet) setBluecoinsLoading(true);
    try {
      const summary = await refreshBluecoinsSummary(folder);
      setBluecoins(summary);
      await notifySpendingGuardChanges(summary.spendingGuards);
      await notifyCashRealityRisk(summary.cashReality, summary.sourceDate);
      const pinned = await syncPinnedGuardSnapshot(summary.spendingGuards, summary.sourceDate);
      setPinnedGuardId(pinned);
      await refreshLeanLogWidget();
    } catch (error: any) {
      if (!quiet) Alert.alert('Bluecoins', error?.message === 'NO_BLUECOINS_BACKUP'
        ? 'No .fydb backup was found in that folder.'
        : 'LeanLog could not read the latest Bluecoins backup.');
    } finally {
      setBluecoinsLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async (showResult = false) => {
    if (showResult) setHealthLoading(true);
    const connected = await healthIsConnected();
    setHealthConnected(connected);
    if (!connected) {
      if (showResult) Alert.alert('Health Connect', 'Connect Health Connect first so LeanLog can read Mi Fitness workouts.');
      setHealthLoading(false);
      return;
    }
    try {
      const snapshot = await readHealthSnapshot();
      setHealth(snapshot);
      await AsyncStorage.setItem('widget_health_snapshot', JSON.stringify(snapshot));
      const workouts = await readRecentHealthWorkouts();
      const raw = await AsyncStorage.getItem('activity_entries');
      const existing: ActivityEntry[] = raw ? JSON.parse(raw) : [];
      const existingIds = new Set(existing.map((entry) => entry.id));
      const gymRaw = await AsyncStorage.getItem('gym_sessions');
      const gymSessions: GymSession[] = gymRaw ? JSON.parse(gymRaw) : [];
      const mergedActivities = new Map(existing.map((entry) => [entry.id, entry]));
      let imported = 0;
      let mergedWithCoach = 0;
      const matchedGymIds = new Set<string>();
      if (workouts.length) {
        workouts.forEach((entry) => {
          const isGymLike = /strength|weight|gym|workout|resistance/i.test(entry.name);
          const gym = isGymLike ? gymSessions.find((session) => !matchedGymIds.has(session.id) && session.date === entry.date && Math.abs(session.durationMin - entry.duration) <= 20) : undefined;
          if (gym) {
            matchedGymIds.add(gym.id);
            const activityId = gym.activityEntryId || entry.id;
            const linked: ActivityEntry = { ...entry, id: activityId, name: `💪 ${gym.planDayLabel}` };
            if (entry.id !== activityId) {
              mergedActivities.delete(entry.id);
              fsDelete('activityEntries', entry.id).catch(() => {});
            }
            mergedActivities.set(activityId, linked);
            gym.activityEntryId = activityId;
            gym.source = 'health-merged';
            gym.caloriesBurned = entry.caloriesBurned;
            mergedWithCoach += 1;
            return;
          }
          if (!existingIds.has(entry.id)) imported += 1;
          mergedActivities.set(entry.id, entry);
        });
        const merged = [...mergedActivities.values()];
        await AsyncStorage.setItem('activity_entries', JSON.stringify(merged));
        await AsyncStorage.setItem('gym_sessions', JSON.stringify(gymSessions));
        await Promise.all(merged.filter((entry) => workouts.some((workout) => workout.id === entry.id) || entry.name.startsWith('💪')).map((entry) => fsUpsert('activityEntries', entry.id, entry)));
        await Promise.all(gymSessions.filter((session) => session.source === 'health-merged').map((session) => fsUpsert('gymSessions', session.id, session)));
        const today = todayKey();
        setBurned(merged.filter((entry) => entry.date === today).reduce((sum, entry) => sum + entry.caloriesBurned, 0));
      }
      const status: HealthSyncStatus = { syncedAt: new Date().toISOString(), detected: workouts.length, imported, latest: workouts[0] || null };
      setHealthSync(status);
      await AsyncStorage.setItem('health_workout_sync_status_v1', JSON.stringify(status));
      await refreshLeanLogWidget();
      if (showResult) Alert.alert(
        'Health synced ✓',
        imported > 0
          ? `${imported} new workout${imported === 1 ? '' : 's'} imported. ${workouts.length - imported} existing workout${workouts.length - imported === 1 ? '' : 's'} already up to date.`
          + (mergedWithCoach ? ` ${mergedWithCoach} matched with Coach session${mergedWithCoach === 1 ? '' : 's'}—no double count.` : '')
          : workouts.length > 0
            ? `No standalone workouts to add. ${workouts.length} recent workout${workouts.length === 1 ? '' : 's'} checked.${mergedWithCoach ? ` ${mergedWithCoach} matched with Coach—no double count.` : ' Everything is up to date.'}`
            : 'No workouts were found in Health Connect for the last 7 days.',
      );
    } catch (error: any) {
      if (showResult) Alert.alert('Health sync failed', error?.message || 'LeanLog could not read workouts from Health Connect.');
    } finally {
      if (showResult) setHealthLoading(false);
    }
  }, []);

  const loadAgenda = useCallback(async () => {
    const connected = await calendarIsConnected();
    setCalendarConnected(connected);
    if (!connected) return;
    try {
      const items = await readTodayAgenda();
      setAgenda(items);
      await AsyncStorage.setItem('widget_agenda_snapshot', JSON.stringify(items));
    } catch {}
  }, []);

  const loadInsights = useCallback(async () => {
    const data = await loadInsightData();
    setWeekly(data.weekly);
    setStreaks(data.streaks);
    setNotes(data.notes);
  }, []);

  const loadHabits = useCallback(async () => {
    const data = await loadTinyHabits();
    setTinyHabits(data.habits);
    setHabitCheckins(data.checkins);
  }, []);

  useFocusEffect(useCallback(() => {
    loadLeanLog();
    loadBluecoins(true);
    loadHealth();
    loadAgenda();
    loadInsights();
    loadHabits();
    refreshLeanLogWidget();
  }, [loadLeanLog, loadBluecoins, loadHealth, loadAgenda, loadInsights, loadHabits]));

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLeanLog(), loadBluecoins(true), loadHealth(), loadAgenda(), loadInsights(), loadHabits()]);
    await refreshLeanLogWidget();
    setRefreshing(false);
  };

  const handleConnectHealth = async () => {
    setHealthLoading(true);
    try {
      const connected = await connectHealth();
      setHealthConnected(connected);
      if (connected) await loadHealth(true);
    } catch (error: any) {
      Alert.alert('Health Connect', error?.message === 'HEALTH_CONNECT_UNAVAILABLE'
        ? 'Health Connect is not available on this device.'
        : 'Permission was not granted. You can connect later from this dashboard.');
    } finally {
      setHealthLoading(false);
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarLoading(true);
    try {
      const connected = await connectCalendar();
      setCalendarConnected(connected);
      if (connected) {
        const items = await readTodayAgenda();
        setAgenda(items);
        if (!items.length) Alert.alert('Calendar connected', 'Access is working. There are no events scheduled for today.');
      } else {
        Alert.alert('Calendar permission needed', 'Allow calendar access in Android Settings to show today’s agenda.');
      }
    } catch (error: any) {
      Alert.alert('Calendar', `Could not read your phone calendar. ${error?.message || ''}`.trim());
    } finally {
      setCalendarLoading(false);
    }
  };

  const connectBluecoins = async () => {
    const uri = await chooseBluecoinsFolder();
    if (!uri) return;
    setBluecoinsConnected(true);
    setBluecoinsLoading(true);
    try {
      setBluecoins(await refreshBluecoinsSummary(uri));
    } catch (error: any) {
      Alert.alert('Folder connected', error?.message === 'NO_BLUECOINS_BACKUP'
        ? 'This folder has no .fydb backup. Select the Bluecoins AutoBackups folder.'
        : 'The folder was connected, but the newest backup could not be read.');
    } finally {
      setBluecoinsLoading(false);
    }
  };

  const explainWeek = async () => {
    if (!weekly || aiReviewLoading) return;
    setAiReviewLoading(true);
    try {
      const prompt = `Anda ialah coach LeanLog. Tulis ulasan mingguan maksimum 90 patah perkataan dalam Bahasa Malaysia, nada mesra dan terus terang. Jangan beri diagnosis perubatan. Data: purata kalori ${weekly.eatenAverage}, sasaran ${goal}, hari log ${weekly.loggedDays}/7, workout ${weekly.workoutCount}, perubahan berat ${weekly.weightChange ?? 'tiada data'} kg. Pemerhatian lokal: ${weekly.observations.join(' ')}`;
      setAiReview(await runLeanLogAi('weekly_review', prompt));
    } catch {
      Alert.alert('AI review', 'Could not generate the optional AI explanation. Your offline weekly review still works.');
    } finally {
      setAiReviewLoading(false);
    }
  };

  const openBudgetCoach = () => {
    if (!bluecoins) return;
    setBudgetInput(bluecoins.monthly.budget.toFixed(0));
    setPaydayInput(String(bluecoins.monthly.payday));
    setSafetyBufferInput(String(bluecoins.cashReality.safetyBuffer));
    setExpandedBudgetCategory(null);
    setShowBudgetCoach(true);
  };

  const savePayday = async () => {
    const payday = Number(paydayInput);
    if (!Number.isInteger(payday) || payday < 1 || payday > 28) {
      Alert.alert('Salary day', 'Choose a salary day from 1 to 28. This keeps every monthly cycle valid.');
      return;
    }
    await setBluecoinsPayday(payday);
    await loadBluecoins(false);
  };

  const checkHabit = async (habit: TinyHabit) => {
    const current = habitCheckins[habitDateKey()]?.[habit.id];
    setHabitCheckins(await setHabitStatus(habit.id, current === 'done' ? undefined : 'done'));
  };

  const skipHabit = async (habit: TinyHabit) => {
    setHabitCheckins(await setHabitStatus(habit.id, 'skip'));
  };

  const addTinyHabit = async () => {
    const name = newHabitName.trim();
    if (!name) return Alert.alert('Tiny Habit', 'Give this habit a short name.');
    if (!newHabitDays.length) return Alert.alert('Tiny Habit', 'Choose at least one active day.');
    const updatedHabit = { id: editingHabit?.id || `habit_${Date.now()}`, name, emoji: newHabitEmoji.trim() || '✨', color: editingHabit?.color || colors.mint, activeDays: [...newHabitDays].sort() };
    const next = editingHabit ? tinyHabits.map((habit) => habit.id === editingHabit.id ? updatedHabit : habit) : [...tinyHabits, updatedHabit];
    await saveTinyHabits(next);
    setTinyHabits(next);
    setNewHabitName('');
    setNewHabitEmoji('✨');
    setNewHabitDays([0, 1, 2, 3, 4, 5, 6]);
    setEditingHabit(null);
    setShowHabitCreator(false);
  };

  const manualHealthSync = () => loadHealth(true);

  const openHabitCreator = (habit?: TinyHabit) => {
    setEditingHabit(habit || null);
    setNewHabitName(habit?.name || '');
    setNewHabitEmoji(habit?.emoji || '✨');
    setNewHabitDays(habit?.activeDays || [0, 1, 2, 3, 4, 5, 6]);
    setShowHabitCreator(true);
  };

  const deleteHabit = (habit: TinyHabit) => Alert.alert('Delete habit?', `Remove “${habit.name}” and its report history?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      const next = tinyHabits.filter((item) => item.id !== habit.id);
      await saveTinyHabits(next);
      setTinyHabits(next);
    } },
  ]);

  const cycleDate = (value: string) => new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));

  const saveMonthlyBudget = async () => {
    const budget = Number(budgetInput);
    if (!Number.isFinite(budget) || budget <= 0) {
      Alert.alert('Monthly budget', 'Enter a valid budget above RM 0.');
      return;
    }
    await setBluecoinsMonthlyBudget(budget);
    await loadBluecoins(false);
    setShowBudgetCoach(false);
  };

  const toggleCashAccount = async (name: string) => {
    if (!bluecoins) return;
    const selected = bluecoins.cashReality.selectedAccounts.includes(name)
      ? bluecoins.cashReality.selectedAccounts.filter((account) => account !== name)
      : [...bluecoins.cashReality.selectedAccounts, name];
    if (!selected.length) return Alert.alert('Cash Reality', 'Keep at least one spendable bank account selected.');
    await setCashRealityAccounts(selected);
    await loadBluecoins(false);
  };

  const saveSafetyBuffer = async () => {
    const amount = Number(safetyBufferInput);
    if (!Number.isFinite(amount) || amount < 0) return Alert.alert('Safety buffer', 'Enter RM 0 or a positive amount.');
    await setCashRealitySafetyBuffer(amount);
    await loadBluecoins(false);
  };

  const guardTargets = bluecoins ? (
    guardScope === 'account' ? bluecoins.guardOptions.accounts
      : guardScope === 'category' ? bluecoins.guardOptions.categories
        : bluecoins.guardOptions.subcategories
  ) : [];

  const openGuardEditor = (guard?: SpendingGuard) => {
    const scope = guard?.scope || 'account';
    const options = bluecoins ? (scope === 'account' ? bluecoins.guardOptions.accounts : scope === 'category' ? bluecoins.guardOptions.categories : bluecoins.guardOptions.subcategories) : [];
    setEditingGuardId(guard?.id || null);
    setGuardName(guard?.name || '');
    setGuardScope(scope);
    setGuardTarget(guard?.target || options[0] || '');
    setGuardLimit(guard ? String(guard.limit) : '');
    setGuardCycle(guard?.cycle || 'salary');
    setGuardTone(guard?.tone || 'karen');
    setShowGuardEditor(true);
  };

  const changeGuardScope = (scope: GuardScope) => {
    setGuardScope(scope);
    const options = bluecoins ? (scope === 'account' ? bluecoins.guardOptions.accounts : scope === 'category' ? bluecoins.guardOptions.categories : bluecoins.guardOptions.subcategories) : [];
    setGuardTarget(options[0] || '');
  };

  const saveGuard = async () => {
    if (!bluecoins || !guardTarget || !Number.isFinite(Number(guardLimit)) || Number(guardLimit) <= 0) {
      Alert.alert('Spending Guard', 'Choose what to watch and enter a valid limit.');
      return;
    }
    const guard: SpendingGuard = {
      id: editingGuardId || `guard_${Date.now()}`,
      name: guardName.trim() || guardTarget,
      scope: guardScope,
      target: guardTarget,
      limit: Number(guardLimit),
      cycle: guardCycle,
      thresholds: [50, 70, 85, 100],
      tone: guardTone,
      enabled: true,
    };
    const next = editingGuardId
      ? bluecoins.spendingGuards.map((item) => item.id === editingGuardId ? guard : item)
      : [...bluecoins.spendingGuards, guard];
    await saveSpendingGuards(next);
    await requestSpendingGuardNotifications();
    setShowGuardEditor(false);
    await loadBluecoins(false);
  };

  const toggleGuard = async (guard: SpendingGuard) => {
    if (!bluecoins) return;
    await saveSpendingGuards(bluecoins.spendingGuards.map((item) => item.id === guard.id ? { ...item, enabled: !item.enabled } : item));
    setSelectedGuardId(null);
    await loadBluecoins(false);
  };

  const makeGuardTopPriority = async (guard: SpendingGuard) => {
    await pinSpendingGuard(guard.id);
    setPinnedGuardId(guard.id);
    if (bluecoins) await syncPinnedGuardSnapshot(bluecoins.spendingGuards, bluecoins.sourceDate);
    await refreshLeanLogWidget();
    Alert.alert('Top priority set', `${guard.name} will stay visible on your Android widget.`);
  };

  const deleteGuard = (guard: SpendingGuard) => Alert.alert('Remove Spending Guard?', `Stop watching “${guard.name}”?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      if (!bluecoins) return;
      await saveSpendingGuards(bluecoins.spendingGuards.filter((item) => item.id !== guard.id));
      setSelectedGuardId(null);
      await loadBluecoins(false);
    } },
  ]);

  const remaining = goal - consumed;
  const progress = Math.max(0, Math.min(1, consumed / Math.max(goal, 1)));
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('en-MY', {
    weekday: 'short', day: '2-digit', month: 'short',
  }).format(new Date()).toUpperCase(), []);
  const primaryGuard = bluecoins?.spendingGuards.find((guard) => guard.enabled);
  const selectedGuard = bluecoins?.spendingGuards.find((guard) => guard.id === selectedGuardId);
  const backupAgeDays = bluecoins ? Math.max(0, Math.floor((Date.now() - new Date(`${bluecoins.sourceDate}T23:59:59`).getTime()) / 86400000)) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.coral} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>LeanLog</Text>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
          <View style={styles.brandMarkWrap} accessibilityLabel="LeanLog logo">
            <Image source={require('../assets/brand-mark.png')} style={styles.brandMark} />
          </View>
        </View>

        <Text style={styles.greeting}>{greeting()},{'\n'}{displayName()}</Text>
        <Text style={styles.mantra}>Keep the rhythm, not the pressure.</Text>

        <TouchableOpacity style={styles.nutritionCard} onPress={() => navigation.navigate('Log')} activeOpacity={0.9}>
          <View style={styles.cardHeadingRow}>
            <Text style={styles.cardEyebrow}>CALORIE BALANCE</Text>
            <Ionicons name="arrow-forward" size={19} color={colors.text} />
          </View>
          <View style={styles.nutritionStats}>
            <Metric value={consumed.toLocaleString()} label="eaten" />
            <View style={styles.metricRule} />
            <Metric value={remaining.toLocaleString()} label="left" />
            <View style={styles.metricRule} />
            <Metric value={`${protein}g`} label="protein" />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.goalText}>{goal.toLocaleString()} kcal goal · {burned} burned</Text>
        </TouchableOpacity>

        <View style={styles.briefCard}>
          <View style={styles.cardHeadingRow}>
            <Text style={styles.briefEyebrow}>DAILY BRIEFING</Text>
            <Text style={styles.briefDate}>TODAY</Text>
          </View>
          <Text style={styles.briefTitle}>{remaining > 0 ? `${remaining.toLocaleString()} kcal to shape your day.` : 'Your calorie target is covered.'}</Text>
          <View style={styles.briefChips}>
            <View style={[styles.briefChip, { backgroundColor: '#DDF5E9' }]}><Text style={styles.briefChipText}>👟 {health?.steps.toLocaleString() || '—'} steps</Text></View>
            <View style={[styles.briefChip, { backgroundColor: '#EEF0FF' }]}><Text style={styles.briefChipText}>🌙 {health ? `${Math.floor(health.sleepMinutes / 60)}h ${health.sleepMinutes % 60}m` : '—'} sleep</Text></View>
            <View style={[styles.briefChip, { backgroundColor: '#E8E8FF' }]}><Text style={styles.briefChipText}>📅 {agenda.length} event{agenda.length === 1 ? '' : 's'}</Text></View>
            <View style={[styles.briefChip, { backgroundColor: '#F6E4AC' }]}><Text style={styles.briefChipText}>💳 {bluecoins ? money(bluecoins.total) : '—'} / 7d</Text></View>
            <View style={[styles.briefChip, { backgroundColor: '#FFE6DC' }]}><Text style={styles.briefChipText}>🔥 {streaks?.logging || 0}d log</Text></View>
          </View>
          <Text style={styles.briefFocus}>{notes[0] ? `Note to self: ${notes[0].text}` : (protein < Math.round(goal * 0.25 / 4) ? 'Focus: build your next meal around protein.' : 'Focus: keep the rhythm; protein is on track.')}</Text>
        </View>

        <View style={styles.habitsCard}>
          <View style={styles.cardHeadingRow}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowHabitReport(true)}><Text style={styles.habitsEyebrow}>TINY HABITS · VIEW REPORT</Text><Text style={styles.habitsTitle}>Small wins, counted.</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => openHabitCreator()}><Text style={styles.habitsMeta}>＋ ADD · {tinyHabits.length}</Text></TouchableOpacity>
          </View>
          <View style={styles.habitsGrid}>
            {tinyHabits.filter((habit) => habit.activeDays.includes(new Date().getDay())).map((habit) => {
              const status = habitCheckins[habitDateKey()]?.[habit.id];
              const streak = habitStreak(habit, habitCheckins);
              return (
                <TouchableOpacity
                  key={habit.id}
                  style={[styles.habitTile, status === 'done' && { backgroundColor: habit.color }, status === 'skip' && styles.habitTileSkipped]}
                  onPress={() => checkHabit(habit)}
                  onLongPress={() => skipHabit(habit)}
                  delayLongPress={450}
                  activeOpacity={0.75}
                >
                  <Text style={styles.habitEmoji}>{status === 'done' ? '✓' : status === 'skip' ? '—' : habit.emoji}</Text>
                  <Text style={styles.habitName}>{habit.name}</Text>
                  <Text style={styles.habitStreak}>{streak ? `🔥 ${streak} day` : status === 'skip' ? 'honest skip' : 'start today'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.habitsHint}>A skip protects honesty—not perfection. It does not add to or destroy your streak.</Text>
        </View>

        <View style={styles.healthStrip}>
          <HealthMetric icon="footsteps-outline" value={health ? health.steps.toLocaleString() : '—'} label="steps" color={colors.mint} />
          <View style={styles.healthRule} />
          <HealthMetric icon="moon-outline" value={health ? `${Math.floor(health.sleepMinutes / 60)}h ${health.sleepMinutes % 60}m` : '—'} label="sleep" color={colors.cornflower} />
          <View style={styles.healthRule} />
          <HealthMetric icon="heart-outline" value={health?.averageBpm ? String(health.averageBpm) : '—'} label="bpm" color={colors.coral} />
        </View>
        {healthConnected && (
          <View style={styles.healthSyncCard}>
            <View style={styles.healthSyncHeader}>
              <View style={styles.healthSyncStatusDot} />
              <Text style={styles.healthSyncEyebrow}>HEALTH CONNECT · {health?.sourceLabel || 'CONNECTED'}</Text>
              <Text style={styles.healthSyncTime}>{healthSync ? new Intl.DateTimeFormat('en-MY', { hour: '2-digit', minute: '2-digit' }).format(new Date(healthSync.syncedAt)) : '—'}</Text>
            </View>
            {healthSync?.latest ? (
              <View style={styles.healthWorkoutRow}>
                <View style={styles.healthWorkoutIcon}><Ionicons name="barbell-outline" size={19} color={colors.cornflower} /></View>
                <View style={{ flex: 1 }}><Text style={styles.healthWorkoutName}>{healthSync.latest.name}</Text><Text style={styles.healthWorkoutMeta}>{healthSync.latest.date} · {healthSync.latest.duration} min · {healthSync.latest.caloriesBurned} kcal</Text></View>
                <View style={styles.healthImportedBadge}><Text style={styles.healthImportedText}>{healthSync.imported ? `+${healthSync.imported} NEW` : 'UP TO DATE'}</Text></View>
              </View>
            ) : (
              <Text style={styles.healthNoWorkout}>No workout detected in the last 7 days.</Text>
            )}
            <Text style={styles.healthDetected}>{healthSync?.detected || 0} recent workout{healthSync?.detected === 1 ? '' : 's'} found · imported activities appear in Log</Text>
          </View>
        )}
        <TouchableOpacity style={styles.connectHealth} onPress={healthConnected ? manualHealthSync : handleConnectHealth} disabled={healthLoading}>
          {healthLoading
            ? <ActivityIndicator size="small" color={colors.mint} />
            : <Ionicons name={healthConnected ? 'refresh-circle-outline' : 'add-circle-outline'} size={17} color={colors.mint} />}
          <Text style={styles.connectHealthText}>{healthConnected ? 'Sync workouts now' : 'Connect Mi Fitness via Health Connect'}</Text>
        </TouchableOpacity>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Your day</Text>
          <Text style={styles.sectionHint}>One view, less noise</Text>
        </View>

        <View style={styles.dashboardStack}>
          <TouchableOpacity style={styles.dayCard} activeOpacity={0.9} onPress={calendarConnected ? loadAgenda : handleConnectCalendar}>
            <Text style={styles.smallCardTitle}>AGENDA</Text>
            {calendarLoading ? <ActivityIndicator color={colors.cornflower} style={{ marginTop: 34 }} /> : agenda.length ? (
              <View style={styles.agendaList}>
                {agenda.map((event) => (
                  <View key={event.id} style={styles.agendaItem}>
                    <Text style={styles.agendaTime}>{event.allDay ? 'ALL DAY' : new Intl.DateTimeFormat('en-MY', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.startDate))}</Text>
                    <Text style={styles.agendaTitle} numberOfLines={2}>{event.title}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <View style={styles.emptyAgendaIcon}>
                  <Ionicons name="calendar-outline" size={24} color={colors.cornflower} />
                </View>
                <Text style={styles.emptyTitle}>{calendarConnected ? 'Clear day' : 'Connect Calendar'}</Text>
                <Text style={styles.emptyBody}>{calendarConnected ? 'Nothing scheduled today.' : 'Your phone calendar will appear here.'}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.moneyCard} onPress={bluecoinsConnected && bluecoins ? openBudgetCoach : connectBluecoins} activeOpacity={0.9}>
            <View style={styles.moneyTop}>
              <Text style={styles.moneyEyebrow}>LAST 7 DAYS</Text>
              <Ionicons name="wallet-outline" size={22} color={colors.text} />
            </View>
            {bluecoinsLoading ? (
              <ActivityIndicator color={colors.text} style={{ marginTop: 28 }} />
            ) : bluecoins ? (
              <>
                <View style={styles.moneySummaryRow}>
                  <View>
                    <Text style={styles.moneyValue}>{money(bluecoins.total)}</Text>
                    <Text style={styles.moneySub}>{money(bluecoins.average)} / day · {bluecoins.transactionCount} transactions</Text>
                  </View>
                  {bluecoins.changePercent !== null && (
                    <View style={styles.changeBadge}>
                      <Text style={styles.changeText}>{bluecoins.changePercent > 0 ? '↑' : '↓'} {Math.abs(bluecoins.changePercent).toFixed(0)}%</Text>
                      <Text style={styles.changeLabel}>vs previous 7 days</Text>
                    </View>
                  )}
                </View>
                <View style={styles.dailyChart}>
                  {bluecoins.days.map((day) => {
                    const max = Math.max(...bluecoins.days.map((item) => item.spent), 1);
                    return (
                      <View key={day.date} style={styles.dayBarColumn}>
                        <Text style={styles.dayAmount}>{day.spent ? day.spent.toFixed(0) : '0'}</Text>
                        <View style={[styles.dayBar, { height: 12 + (day.spent / max) * 42 }]} />
                        <Text style={styles.dayLabel}>{new Intl.DateTimeFormat('en-MY', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.categoryHeading}>TOP CATEGORIES</Text>
                <View style={styles.categoryList}>
                  {bluecoins.topCategories.map((category, index) => (
                    <View key={category.name} style={styles.categoryRow}>
                      <View style={[styles.categoryDot, { backgroundColor: [colors.coral, colors.cornflower, colors.mint][index] }]} />
                      <Text style={styles.categoryName} numberOfLines={1}>{category.name}</Text>
                      <Text style={styles.categoryAmount}>{money(category.amount)}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.connectMoney}>Connect{`\n`}Bluecoins</Text>
                <Text style={styles.moneySub}>Select AutoBackups folder once.</Text>
              </>
            )}
          </TouchableOpacity>

          {bluecoins && (
            <TouchableOpacity style={[styles.realityCard, bluecoins.cashReality.trueSpendable < 0 && styles.realityCardDanger]} onPress={openBudgetCoach} activeOpacity={0.88}>
              <View style={styles.realityTopRow}>
                <View><Text style={styles.realityEyebrow}>CASH REALITY</Text><Text style={styles.realityTitle}>What is actually yours.</Text></View>
                <Ionicons name="eye-outline" size={22} color={colors.mint} />
              </View>
              <Text style={[styles.realityValue, bluecoins.cashReality.trueSpendable < 0 && { color: colors.coral }]}>{money(bluecoins.cashReality.trueSpendable)}</Text>
              <Text style={styles.realityValueLabel}>TRUE SPENDABLE</Text>
              <View style={styles.realityEquation}>
                <View style={styles.realityEquationItem}><Text style={styles.realityEquationValue}>{money(bluecoins.cashReality.liquidBalance)}</Text><Text style={styles.realityEquationLabel}>selected banks</Text></View>
                <Text style={styles.realityOperator}>−</Text>
                <View style={styles.realityEquationItem}><Text style={[styles.realityEquationValue, { color: colors.coral }]}>{money(bluecoins.cashReality.cardOutstanding)}</Text><Text style={styles.realityEquationLabel}>card reserved</Text></View>
                {bluecoins.cashReality.safetyBuffer > 0 && <><Text style={styles.realityOperator}>−</Text><View style={styles.realityEquationItem}><Text style={styles.realityEquationValue}>{money(bluecoins.cashReality.safetyBuffer)}</Text><Text style={styles.realityEquationLabel}>safety buffer</Text></View></>}
              </View>
              <Text style={styles.realityCoach}>{bluecoins.cashReality.trueSpendable < 0 ? `Bank balance nampak ada, tapi card debt belum fully covered.` : `${bluecoins.cashReality.coveragePercent.toFixed(0)}% card-debt coverage · repayments won't be double-counted.`}</Text>
            </TouchableOpacity>
          )}

          {primaryGuard && (
            <TouchableOpacity style={[styles.guardCard, primaryGuard.level === 'breached' && styles.guardCardBreached]} onPress={() => setSelectedGuardId(primaryGuard.id)} activeOpacity={0.88}>
              <View style={styles.guardTopRow}>
                <View>
                  <Text style={styles.guardEyebrow}>SPENDING GUARD · {primaryGuard.level.replace('-', ' ').toUpperCase()}</Text>
                  <Text style={styles.guardTitle}>{primaryGuard.name}</Text>
                </View>
                <View style={[styles.guardPercentBadge, primaryGuard.level === 'breached' && styles.guardPercentBadgeDanger]}>
                  <Text style={styles.guardPercent}>{primaryGuard.percent.toFixed(0)}%</Text>
                </View>
              </View>
              <View style={styles.guardAmountRow}>
                <Text style={styles.guardSpent}>{money(primaryGuard.spent)}</Text>
                <Text style={styles.guardLimit}> / {money(primaryGuard.limit)}</Text>
              </View>
              <View style={styles.guardTrack}><View style={[styles.guardFill, { width: `${Math.min(100, primaryGuard.percent)}%` }, primaryGuard.percent >= 85 && styles.guardFillDanger]} /></View>
              <View style={styles.guardFooter}>
                <Text style={styles.guardRemaining}>{primaryGuard.remaining >= 0 ? `${money(primaryGuard.remaining)} left` : `${money(Math.abs(primaryGuard.remaining))} over limit`}</Text>
                <Text style={styles.guardCycle}>{primaryGuard.cycle === 'salary' ? 'SALARY CYCLE' : 'CALENDAR MONTH'} · VIEW DETAILS →</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {bluecoins && (
          <View style={styles.syncRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.mint} />
            <Text style={[styles.syncText, backupAgeDays > 0 && { color: colors.coral }]}>Bluecoins · {bluecoins.sourceName} · {backupAgeDays > 0 ? `data is ${backupAgeDays}d old` : 'latest backup loaded'}</Text>
          </View>
        )}

        {streaks && (
          <View style={styles.insightSection}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Your streaks</Text>
              <Text style={styles.sectionHint}>Calculated offline</Text>
            </View>
            <View style={styles.streakGrid}>
              <StreakCard emoji="✍️" value={streaks.logging} label="logging" color={colors.coral} />
              <StreakCard emoji="🎯" value={streaks.calorieTarget} label="on target" color={colors.mustard} />
              <StreakCard emoji="🏃" value={streaks.movement} label="movement" color={colors.cornflower} />
              <StreakCard emoji="💪" value={streaks.protein} label="protein" color={colors.mint} />
            </View>
          </View>
        )}

        {weekly && (
          <View style={styles.weeklyCard}>
            <Text style={styles.weeklyEyebrow}>THIS WEEK · OFFLINE REVIEW</Text>
            <Text style={styles.weeklyTitle}>{weekly.headline}</Text>
            <View style={styles.weeklyNumbers}>
              <Metric value={weekly.eatenAverage.toLocaleString()} label="avg kcal" />
              <View style={styles.metricRule} />
              <Metric value={`${weekly.loggedDays}/7`} label="days logged" />
              <View style={styles.metricRule} />
              <Metric value={String(weekly.workoutCount)} label="movement" />
            </View>
            {weekly.observations.slice(0, 3).map((line) => <Text key={line} style={styles.observation}>• {line}</Text>)}
            {!!aiReview && <Text style={styles.aiReview}>{aiReview}</Text>}
            <TouchableOpacity style={styles.aiButton} onPress={explainWeek} disabled={aiReviewLoading}>
              {aiReviewLoading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.aiButtonText}>✨ {aiReview ? 'Refresh AI explanation' : 'Explain my week with AI'}</Text>}
            </TouchableOpacity>
            <Text style={styles.tokenHint}>Only this button uses an API token.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showBudgetCoach} transparent animationType="slide" onRequestClose={() => setShowBudgetCoach(false)}>
        <View style={styles.budgetOverlay}>
          <View style={styles.budgetSheet}>
            <View style={styles.budgetHandle} />
            <View style={styles.budgetHeader}>
              <View>
                <Text style={styles.budgetEyebrow}>BLUECOINS · BUDGET COACH</Text>
                <Text style={styles.budgetTitle}>Spend with intention.</Text>
              </View>
              <TouchableOpacity style={styles.budgetClose} onPress={() => setShowBudgetCoach(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            {bluecoins && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={styles.budgetHero}>
                  <Text style={styles.budgetHeroLabel}>SAFE TO SPEND TODAY</Text>
                  <Text style={styles.budgetHeroValue}>{money(bluecoins.monthly.safeToday)}</Text>
                  <Text style={styles.budgetHeroSub}>{money(bluecoins.monthly.remaining)} left from {money(bluecoins.monthly.budget)}</Text>
                  <Text style={styles.budgetCycleLabel}>SALARY CYCLE · {cycleDate(bluecoins.monthly.cycleStart)} — {cycleDate(bluecoins.monthly.cycleEnd)}</Text>
                  <View style={styles.budgetTrack}><View style={[styles.budgetFill, { width: `${Math.min(100, (bluecoins.monthly.spent / Math.max(bluecoins.monthly.budget, 1)) * 100)}%` }]} /></View>
                </View>

                <View style={styles.budgetStats}>
                  <BudgetStat value={money(bluecoins.monthly.spent)} label="spent this cycle" />
                  <BudgetStat value={money(bluecoins.monthly.projected)} label="projected payday" />
                  <BudgetStat value={String(bluecoins.monthly.noSpendDays)} label="no-spend days" />
                </View>

                <Text style={styles.budgetSectionTitle}>CASH REALITY · BANK MINUS CARD DEBT</Text>
                <View style={[styles.realityPanel, bluecoins.cashReality.trueSpendable < 0 && styles.realityPanelDanger]}>
                  <Text style={styles.realityPanelLabel}>TRUE SPENDABLE NOW</Text>
                  <Text style={[styles.realityPanelValue, bluecoins.cashReality.trueSpendable < 0 && { color: colors.coral }]}>{money(bluecoins.cashReality.trueSpendable)}</Text>
                  <Text style={styles.realityPanelFormula}>{money(bluecoins.cashReality.liquidBalance)} selected cash − {money(bluecoins.cashReality.cardOutstanding)} unpaid cards{bluecoins.cashReality.safetyBuffer > 0 ? ` − ${money(bluecoins.cashReality.safetyBuffer)} buffer` : ''}</Text>
                  {bluecoins.cashReality.creditCards.map((card) => (
                    <View key={card.name} style={styles.realityCardDebtRow}>
                      <View style={{ flex: 1 }}><Text style={styles.realityDebtName}>💳 {card.name}</Text><Text style={styles.realityDebtMeta}>Cutoff day {card.cutOffDay || '—'} · due day {card.dueDay || '—'}</Text></View>
                      <Text style={styles.realityDebtAmount}>{money(card.outstanding)} owed</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.realityPickerHint}>WHICH BALANCES COUNT AS SPENDABLE CASH?</Text>
                <View style={styles.realityAccountWrap}>
                  {bluecoins.cashReality.cashAccounts.map((account) => (
                    <TouchableOpacity key={account.name} style={[styles.realityAccountChip, account.selected && styles.realityAccountChipActive]} onPress={() => toggleCashAccount(account.name)}>
                      <Ionicons name={account.selected ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={account.selected ? colors.ink : colors.muted} />
                      <Text style={[styles.realityAccountText, account.selected && styles.realityAccountTextActive]}>{account.name} · {money(account.balance)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.realityPickerHint}>SAFETY BUFFER</Text>
                <View style={styles.budgetEditRow}>
                  <Text style={styles.currencyPrefix}>RM</Text>
                  <TextInput style={styles.budgetInput} value={safetyBufferInput} onChangeText={setSafetyBufferInput} keyboardType="decimal-pad" />
                  <TouchableOpacity style={styles.budgetSave} onPress={saveSafetyBuffer}><Text style={styles.budgetSaveText}>Reserve</Text></TouchableOpacity>
                </View>
                <Text style={styles.suggestedHint}>Card purchases reduce true spendable immediately. Paying the card later is settlement—not a second expense.</Text>

                <Text style={styles.budgetSectionTitle}>COACH NOTES</Text>
                {bluecoins.monthly.alerts.map((alert, index) => (
                  <View key={alert} style={styles.coachNote}><View style={[styles.coachDot, { backgroundColor: [colors.coral, colors.mustard, colors.mint][index % 3] }]} /><Text style={styles.coachNoteText}>{alert}</Text></View>
                ))}

                <Text style={styles.budgetSectionTitle}>TOP CATEGORIES · THIS SALARY CYCLE</Text>
                {bluecoins.monthly.topCategories.map((category, index) => (
                  <View key={category.name}>
                    <TouchableOpacity style={styles.budgetCategoryRow} onPress={() => setExpandedBudgetCategory(expandedBudgetCategory === category.name ? null : category.name)} activeOpacity={0.72}>
                      <Text style={styles.budgetCategoryRank}>{String(index + 1).padStart(2, '0')}</Text>
                      <View style={{ flex: 1 }}><Text style={styles.budgetCategoryName}>{category.name}</Text><View style={styles.categoryTrack}><View style={[styles.categoryFill, { width: `${Math.min(100, category.share)}%` }]} /></View></View>
                      <View style={{ alignItems: 'flex-end' }}><Text style={styles.budgetCategoryAmount}>{money(category.amount)}</Text><Text style={styles.budgetCategoryShare}>{category.share.toFixed(0)}% · {expandedBudgetCategory === category.name ? 'HIDE' : 'DETAILS'}</Text></View>
                    </TouchableOpacity>
                    {expandedBudgetCategory === category.name && (
                      <View style={styles.subcategoryPanel}>
                        {category.subcategories.map((subcategory, subIndex) => (
                          <View key={`${category.name}-${subcategory.name}`} style={styles.subcategoryRow}>
                            <View style={[styles.subcategoryDot, { backgroundColor: [colors.coral, colors.cornflower, colors.mustard, colors.mint][subIndex % 4] }]} />
                            <View style={{ flex: 1 }}><Text style={styles.subcategoryName}>{subcategory.name}</Text><Text style={styles.subcategoryShare}>{subcategory.share.toFixed(0)}% of {category.name}</Text></View>
                            <Text style={styles.subcategoryAmount}>{money(subcategory.amount)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}

                <View style={styles.guardSectionHeader}>
                  <Text style={[styles.budgetSectionTitle, { marginBottom: 0 }]}>SPENDING GUARDS</Text>
                  <TouchableOpacity style={styles.guardAddButton} onPress={() => openGuardEditor()}><Ionicons name="add" size={16} color={colors.ink} /><Text style={styles.guardAddText}>NEW GUARD</Text></TouchableOpacity>
                </View>
                {bluecoins.spendingGuards.length ? bluecoins.spendingGuards.map((guard) => (
                  <TouchableOpacity key={guard.id} style={styles.guardListRow} onPress={() => setSelectedGuardId(guard.id)} onLongPress={() => openGuardEditor(guard)} activeOpacity={0.75}>
                    <View style={[styles.guardStatusDot, { backgroundColor: !guard.enabled ? '#AAA' : guard.percent >= 100 ? colors.coral : guard.percent >= 70 ? colors.mustard : colors.mint }]} />
                    <View style={{ flex: 1 }}><View style={styles.guardListTitleRow}><Text style={styles.guardListName}>{guard.name}</Text>{pinnedGuardId === guard.id && <View style={styles.pinnedPill}><Ionicons name="pin" size={9} color={colors.ink} /><Text style={styles.pinnedPillText}>WIDGET</Text></View>}</View><Text style={styles.guardListMeta}>{guard.scope} · {guard.cycle} · long-press to edit</Text></View>
                    <View style={{ alignItems: 'flex-end' }}><Text style={styles.guardListAmount}>{guard.enabled ? money(guard.spent) : 'PAUSED'}</Text><Text style={styles.guardListPercent}>{guard.percent.toFixed(0)}% of {money(guard.limit)}</Text></View>
                  </TouchableOpacity>
                )) : <Text style={styles.guardEmpty}>No guards yet. Add one for an account or category you want LeanLog to watch.</Text>}

                <Text style={styles.budgetSectionTitle}>SALARY CYCLE</Text>
                <View style={styles.paydayRow}>
                  <View style={{ flex: 1 }}><Text style={styles.paydayTitle}>DXC payday</Text><Text style={styles.paydayHint}>Cycle runs payday → day before next payday</Text></View>
                  <Text style={styles.paydayPrefix}>DAY</Text>
                  <TextInput style={styles.paydayInput} value={paydayInput} onChangeText={setPaydayInput} keyboardType="number-pad" maxLength={2} />
                  <TouchableOpacity style={styles.paydaySave} onPress={savePayday}><Text style={styles.paydaySaveText}>Apply</Text></TouchableOpacity>
                </View>

                <Text style={styles.budgetSectionTitle}>MONTHLY BUDGET</Text>
                <View style={styles.budgetEditRow}>
                  <Text style={styles.currencyPrefix}>RM</Text>
                  <TextInput style={styles.budgetInput} value={budgetInput} onChangeText={setBudgetInput} keyboardType="decimal-pad" />
                  <TouchableOpacity style={styles.budgetSave} onPress={saveMonthlyBudget}><Text style={styles.budgetSaveText}>Save</Text></TouchableOpacity>
                </View>
                {bluecoins.monthly.budgetIsSuggested && <Text style={styles.suggestedHint}>This is a suggested budget based on available spending history. Set your own anytime.</Text>}
                <TouchableOpacity style={styles.refreshBudget} onPress={() => loadBluecoins(false)}><Ionicons name="refresh" size={17} color={colors.cornflower} /><Text style={styles.refreshBudgetText}>Refresh newest .fydb backup</Text></TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedGuard} transparent animationType="slide" onRequestClose={() => setSelectedGuardId(null)}>
        <View style={styles.budgetOverlay}>
          <View style={styles.guardDetailSheet}>
            <View style={styles.budgetHandle} />
            {selectedGuard && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
                <View style={styles.budgetHeader}>
                  <View><Text style={styles.budgetEyebrow}>SPENDING GUARD</Text><Text style={styles.budgetTitle}>{selectedGuard.name}</Text></View>
                  <TouchableOpacity style={styles.budgetClose} onPress={() => setSelectedGuardId(null)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
                </View>
                <View style={[styles.guardDetailHero, selectedGuard.level === 'breached' && styles.guardDetailHeroDanger]}>
                  <Text style={styles.guardDetailStatus}>{selectedGuard.level.replace('-', ' ').toUpperCase()}</Text>
                  <Text style={styles.guardDetailValue}>{money(selectedGuard.spent)}</Text>
                  <Text style={styles.guardDetailLimit}>of {money(selectedGuard.limit)} · {selectedGuard.percent.toFixed(0)}%</Text>
                  <View style={styles.guardDarkTrack}><View style={[styles.guardFill, { width: `${Math.min(100, selectedGuard.percent)}%` }, selectedGuard.percent >= 85 && styles.guardFillDanger]} /></View>
                  <Text style={styles.guardDetailMessage}>{selectedGuard.remaining >= 0 ? `${money(selectedGuard.remaining)} still available` : `${money(Math.abs(selectedGuard.remaining))} beyond your limit`}</Text>
                </View>
                <View style={styles.budgetStats}>
                  <BudgetStat value={money(selectedGuard.projected)} label="projected cycle total" />
                  <BudgetStat value={cycleDate(selectedGuard.cycleEnd)} label="cycle ends" />
                  <BudgetStat value={String(selectedGuard.transactions.length)} label="recent charges shown" />
                </View>
                <Text style={styles.budgetSectionTitle}>WHERE IT WENT</Text>
                {selectedGuard.breakdown.map((item, index) => (
                  <View key={item.name} style={styles.guardBreakdownRow}>
                    <Text style={styles.budgetCategoryRank}>{String(index + 1).padStart(2, '0')}</Text>
                    <View style={{ flex: 1 }}><Text style={styles.guardBreakdownName}>{item.name}</Text><View style={styles.categoryTrack}><View style={[styles.categoryFill, { width: `${item.share}%` }]} /></View></View>
                    <Text style={styles.guardBreakdownAmount}>{money(item.amount)}</Text>
                  </View>
                ))}
                <Text style={styles.budgetSectionTitle}>LATEST CHARGES</Text>
                {selectedGuard.transactions.map((tx, index) => (
                  <View key={`${tx.date}-${tx.amount}-${index}`} style={styles.guardTransaction}>
                    <View style={{ flex: 1 }}><Text style={styles.guardTransactionName}>{tx.subcategory}</Text><Text style={styles.guardTransactionMeta}>{cycleDate(tx.date)} · {tx.category}{tx.note ? ` · ${tx.note}` : ''}</Text></View>
                    <Text style={styles.guardTransactionAmount}>{money(tx.amount)}</Text>
                  </View>
                ))}
                <Text style={styles.guardFreshness}>Based on {bluecoins?.sourceName}. Refresh follows the newest Bluecoins backup—not live card activity.</Text>
                <View style={styles.guardDetailActions}>
                  <TouchableOpacity style={styles.guardEditButton} onPress={() => { setSelectedGuardId(null); openGuardEditor(selectedGuard); }}><Text style={styles.guardEditText}>EDIT GUARD</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.guardPinButton, pinnedGuardId === selectedGuard.id && styles.guardPinButtonActive]} onPress={() => makeGuardTopPriority(selectedGuard)}><Ionicons name="pin" size={17} color={pinnedGuardId === selectedGuard.id ? colors.ink : colors.oat} /></TouchableOpacity>
                  <TouchableOpacity style={styles.guardPauseButton} onPress={() => toggleGuard(selectedGuard)}><Ionicons name={selectedGuard.enabled ? 'pause' : 'play'} size={17} color={colors.text} /></TouchableOpacity>
                  <TouchableOpacity style={styles.guardDeleteButton} onPress={() => deleteGuard(selectedGuard)}><Ionicons name="trash-outline" size={18} color={colors.coral} /></TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showGuardEditor} transparent animationType="fade" onRequestClose={() => setShowGuardEditor(false)}>
        <View style={styles.habitModalOverlay}>
          <ScrollView style={styles.guardEditor} contentContainerStyle={styles.guardEditorContent} showsVerticalScrollIndicator={false}>
            <View style={styles.cardHeadingRow}><View><Text style={styles.habitModalEyebrow}>SPENDING GUARD</Text><Text style={styles.habitModalTitle}>{editingGuardId ? 'Edit your limit.' : 'Watch the leak.'}</Text></View><TouchableOpacity style={styles.budgetClose} onPress={() => setShowGuardEditor(false)}><Ionicons name="close" size={21} color={colors.text} /></TouchableOpacity></View>
            <Text style={styles.guardFieldLabel}>WATCH</Text>
            <View style={styles.guardChoiceRow}>{(['account', 'category', 'subcategory'] as GuardScope[]).map((scope) => <TouchableOpacity key={scope} style={[styles.guardChoice, guardScope === scope && styles.guardChoiceActive]} onPress={() => changeGuardScope(scope)}><Text style={[styles.guardChoiceText, guardScope === scope && styles.guardChoiceTextActive]}>{scope.toUpperCase()}</Text></TouchableOpacity>)}</View>
            <View style={styles.guardPickerWrap}><Picker selectedValue={guardTarget} onValueChange={(value) => setGuardTarget(String(value))} style={styles.guardPicker}>{guardTargets.map((target) => <Picker.Item key={target} label={target} value={target} />)}</Picker></View>
            <Text style={styles.guardFieldLabel}>DISPLAY NAME · OPTIONAL</Text>
            <TextInput style={styles.guardTextInput} value={guardName} onChangeText={setGuardName} placeholder={guardTarget || 'My guard'} placeholderTextColor="#8B8B8B" />
            <Text style={styles.guardFieldLabel}>LIMIT</Text>
            <View style={styles.budgetEditRow}><Text style={styles.currencyPrefix}>RM</Text><TextInput style={styles.budgetInput} value={guardLimit} onChangeText={setGuardLimit} keyboardType="decimal-pad" placeholder="1400" placeholderTextColor="#8B8B8B" /></View>
            <Text style={styles.guardFieldLabel}>RESET CYCLE</Text>
            <View style={styles.guardChoiceRow}>{(['salary', 'calendar'] as GuardCycle[]).map((cycle) => <TouchableOpacity key={cycle} style={[styles.guardChoice, guardCycle === cycle && styles.guardChoiceActive]} onPress={() => setGuardCycle(cycle)}><Text style={[styles.guardChoiceText, guardCycle === cycle && styles.guardChoiceTextActive]}>{cycle === 'salary' ? 'PAYDAY → PAYDAY' : 'CALENDAR MONTH'}</Text></TouchableOpacity>)}</View>
            <Text style={styles.guardFieldLabel}>COACH TONE</Text>
            <View style={styles.guardChoiceRow}>{(['normal', 'firm', 'karen'] as GuardTone[]).map((tone) => <TouchableOpacity key={tone} style={[styles.guardChoice, guardTone === tone && styles.guardChoiceActive]} onPress={() => setGuardTone(tone)}><Text style={[styles.guardChoiceText, guardTone === tone && styles.guardChoiceTextActive]}>{tone.toUpperCase()}</Text></TouchableOpacity>)}</View>
            <Text style={styles.guardThresholdHint}>Alerts fire once at 50%, 70%, 85% and 100%, then every additional RM100 over limit.</Text>
            <TouchableOpacity style={styles.guardSaveButton} onPress={saveGuard}><Text style={styles.guardSaveText}>SAVE SPENDING GUARD</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showHabitReport} transparent animationType="slide" onRequestClose={() => setShowHabitReport(false)}>
        <View style={styles.budgetOverlay}>
          <View style={styles.habitReportSheet}>
            <View style={styles.budgetHandle} />
            <View style={styles.cardHeadingRow}>
              <View><Text style={styles.habitModalEyebrow}>LAST 30 DAYS</Text><Text style={styles.habitReportTitle}>Your habit rhythm.</Text></View>
              <TouchableOpacity style={styles.budgetClose} onPress={() => setShowHabitReport(false)}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {tinyHabits.map((habit) => {
                const report = habitReport(habit, habitCheckins);
                return (
                  <View key={habit.id} style={styles.habitReportRow}>
                    <Text style={styles.habitReportEmoji}>{habit.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.habitReportName}>{habit.name}</Text>
                      <Text style={styles.habitReportMeta}>🔥 {habitStreak(habit, habitCheckins)} streak · {report.done} done · {report.skipped} skipped</Text>
                      <View style={styles.habitReportTrack}><View style={[styles.habitReportFill, { width: `${report.completion}%`, backgroundColor: habit.color }]} /></View>
                    </View>
                    <View style={styles.habitReportScore}><Text style={styles.habitReportPercent}>{report.completion}%</Text><TouchableOpacity onPress={() => { setShowHabitReport(false); openHabitCreator(habit); }}><Text style={styles.habitEdit}>EDIT</Text></TouchableOpacity><TouchableOpacity onPress={() => deleteHabit(habit)}><Text style={styles.habitDelete}>DELETE</Text></TouchableOpacity></View>
                  </View>
                );
              })}
              {!tinyHabits.length && <Text style={styles.habitsHint}>No habits yet. Add one small promise to yourself.</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showHabitCreator} transparent animationType="fade" onRequestClose={() => setShowHabitCreator(false)}>
        <View style={styles.habitModalOverlay}>
          <View style={styles.habitModal}>
            <Text style={styles.habitModalEyebrow}>{editingHabit ? 'EDIT TINY HABIT' : 'NEW TINY HABIT'}</Text>
            <Text style={styles.habitModalTitle}>{editingHabit ? 'Keep it realistic.' : 'Make it almost too easy.'}</Text>
            <View style={styles.habitInputRow}>
              <TextInput style={styles.emojiInput} value={newHabitEmoji} onChangeText={setNewHabitEmoji} maxLength={2} />
              <TextInput style={styles.habitInput} value={newHabitName} onChangeText={setNewHabitName} placeholder="e.g. Stretch 5 min" placeholderTextColor="#8993A5" maxLength={28} />
            </View>
            <Text style={styles.habitDaysLabel}>ACTIVE DAYS</Text>
            <View style={styles.habitDaysRow}>
              {[{ d: 1, l: 'M' }, { d: 2, l: 'T' }, { d: 3, l: 'W' }, { d: 4, l: 'T' }, { d: 5, l: 'F' }, { d: 6, l: 'S' }, { d: 0, l: 'S' }].map(({ d, l }) => {
                const active = newHabitDays.includes(d);
                return <TouchableOpacity key={d} style={[styles.habitDay, active && styles.habitDayActive]} onPress={() => setNewHabitDays(active ? newHabitDays.filter((day) => day !== d) : [...newHabitDays, d])}><Text style={[styles.habitDayText, active && styles.habitDayTextActive]}>{l}</Text></TouchableOpacity>;
              })}
            </View>
            <View style={styles.habitModalActions}>
              <TouchableOpacity style={styles.habitCancel} onPress={() => { setShowHabitCreator(false); setEditingHabit(null); }}><Text style={styles.habitCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.habitCreate} onPress={addTinyHabit}><Text style={styles.habitCreateText}>{editingHabit ? 'Save changes' : 'Create habit'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function HealthMetric({ icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
  return (
    <View style={styles.healthMetric}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.healthValue}>{value}</Text>
      <Text style={styles.healthLabel}>{label}</Text>
    </View>
  );
}

function StreakCard({ emoji, value, label, color }: { emoji: string; value: number; label: string; color: string }) {
  return <View style={[styles.streakCard, { borderTopColor: color }]}><Text style={styles.streakEmoji}>{emoji}</Text><Text style={styles.streakValue}>{value}</Text><Text style={styles.streakLabel}>day {label}</Text></View>;
}

function BudgetStat({ value, label }: { value: string; label: string }) {
  return <View style={styles.budgetStat}><Text style={styles.budgetStatValue}>{value}</Text><Text style={styles.budgetStatLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { paddingHorizontal: 18, paddingBottom: 36 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  brand: { color: colors.oat, fontSize: 22, fontWeight: '800', letterSpacing: 0.4 },
  date: { color: colors.mint, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 12 },
  brandMarkWrap: { width: 46, height: 46, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: colors.oat },
  brandMark: { width: '100%', height: '100%' },
  greeting: { color: colors.oat, fontFamily: 'serif', fontSize: 39, lineHeight: 43, fontWeight: '700', marginTop: 20 },
  mantra: { color: '#AAB5C7', fontSize: 14, marginTop: 10, marginBottom: 22 },
  nutritionCard: { backgroundColor: colors.oat, borderRadius: radii.large, padding: 18, ...shadow },
  cardHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  nutritionStats: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  metric: { flex: 1 },
  metricValue: { color: colors.text, fontFamily: 'serif', fontSize: 29, fontWeight: '800' },
  metricLabel: { color: colors.text, fontSize: 12, marginTop: 1 },
  metricRule: { width: 1, height: 44, backgroundColor: colors.line, marginHorizontal: 10 },
  progressTrack: { height: 12, borderRadius: 6, backgroundColor: '#DCD3C1', overflow: 'hidden', marginTop: 20 },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: colors.coral },
  goalText: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 7 },
  briefCard: { backgroundColor: colors.paper, borderRadius: radii.large, padding: 18, marginTop: 14 },
  briefEyebrow: { color: colors.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  briefDate: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  briefTitle: { color: colors.text, fontFamily: 'serif', fontSize: 23, lineHeight: 28, fontWeight: '800', marginTop: 12 },
  briefChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 15 },
  briefChip: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  briefChipText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  briefFocus: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 13 },
  habitsCard: { backgroundColor: colors.ink, borderRadius: radii.large, padding: 17, marginTop: 12 },
  habitsEyebrow: { color: colors.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  habitsTitle: { color: colors.oat, fontFamily: 'serif', fontSize: 21, fontWeight: '800', marginTop: 4 },
  habitsMeta: { color: '#718096', fontSize: 7, fontWeight: '900', letterSpacing: 0.8, textAlign: 'right' },
  habitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  habitTile: { width: '48.5%', minHeight: 102, backgroundColor: colors.inkSoft, borderRadius: 18, padding: 12, justifyContent: 'space-between', borderWidth: 1, borderColor: '#30405A' },
  habitTileSkipped: { backgroundColor: '#293348', borderStyle: 'dashed', opacity: 0.72 },
  habitEmoji: { color: colors.oat, fontSize: 20, fontWeight: '900' },
  habitName: { color: colors.oat, fontSize: 12, fontWeight: '900', marginTop: 8 },
  habitStreak: { color: '#AAB5C7', fontSize: 9, fontWeight: '700', marginTop: 4 },
  habitsHint: { color: '#7F8BA0', fontSize: 9, lineHeight: 13, marginTop: 11 },
  habitModalOverlay: { flex: 1, backgroundColor: 'rgba(4,10,20,0.72)', justifyContent: 'center', padding: 20 },
  habitModal: { backgroundColor: colors.paper, borderRadius: 28, padding: 20 },
  habitModalEyebrow: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  habitModalTitle: { color: colors.text, fontFamily: 'serif', fontSize: 25, fontWeight: '800', marginTop: 6 },
  habitInputRow: { flexDirection: 'row', gap: 9, marginTop: 18 },
  emojiInput: { width: 54, backgroundColor: colors.ink, color: colors.oat, borderRadius: 15, textAlign: 'center', fontSize: 22 },
  habitInput: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DED5C5', color: colors.text, borderRadius: 15, paddingHorizontal: 13, fontSize: 14, fontWeight: '700' },
  habitDaysLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 18, marginBottom: 8 },
  habitDaysRow: { flexDirection: 'row', gap: 5 },
  habitDay: { flex: 1, aspectRatio: 1, borderRadius: 11, borderWidth: 1, borderColor: '#D9CFBF', alignItems: 'center', justifyContent: 'center' },
  habitDayActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  habitDayText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  habitDayTextActive: { color: colors.paper },
  habitModalActions: { flexDirection: 'row', gap: 9, marginTop: 21 },
  habitCancel: { flex: 1, borderWidth: 1, borderColor: '#D9CFBF', borderRadius: 14, padding: 13, alignItems: 'center' },
  habitCancelText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  habitCreate: { flex: 1.4, backgroundColor: colors.mint, borderRadius: 14, padding: 13, alignItems: 'center' },
  habitCreateText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  habitReportSheet: { maxHeight: '88%', backgroundColor: colors.paper, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 18, paddingBottom: 12 },
  habitReportTitle: { color: colors.text, fontFamily: 'serif', fontSize: 27, fontWeight: '800', marginTop: 4 },
  habitReportRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 13, marginTop: 10, borderWidth: 1, borderColor: colors.line },
  habitReportEmoji: { fontSize: 24 },
  habitReportName: { color: colors.text, fontSize: 13, fontWeight: '900' },
  habitReportMeta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  habitReportTrack: { height: 5, borderRadius: 3, backgroundColor: '#E7DFD0', overflow: 'hidden', marginTop: 7 },
  habitReportFill: { height: '100%', borderRadius: 3 },
  habitReportScore: { alignItems: 'flex-end', gap: 5 },
  habitReportPercent: { color: colors.text, fontFamily: 'serif', fontSize: 18, fontWeight: '900' },
  habitEdit: { color: colors.cornflower, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  habitDelete: { color: colors.coral, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  healthStrip: { backgroundColor: colors.inkSoft, borderWidth: 1, borderColor: colors.inkMuted, borderRadius: radii.medium, flexDirection: 'row', paddingVertical: 17, marginTop: 14 },
  healthMetric: { flex: 1, alignItems: 'center' },
  healthValue: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 6 },
  healthLabel: { color: '#8E9AAF', fontSize: 11, marginTop: 1 },
  healthRule: { width: 1, backgroundColor: colors.inkMuted, marginVertical: 3 },
  connectHealth: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  connectHealthText: { color: colors.mint, fontSize: 12, fontWeight: '700' },
  healthSyncCard: { backgroundColor: '#17243A', borderRadius: 17, borderWidth: 1, borderColor: '#2B3C58', padding: 12, marginTop: 9 },
  healthSyncHeader: { flexDirection: 'row', alignItems: 'center' },
  healthSyncStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.mint, marginRight: 6 },
  healthSyncEyebrow: { flex: 1, color: '#94A1B4', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  healthSyncTime: { color: colors.mint, fontSize: 8, fontWeight: '800' },
  healthWorkoutRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 },
  healthWorkoutIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#242E50', alignItems: 'center', justifyContent: 'center' },
  healthWorkoutName: { color: colors.white, fontSize: 12, fontWeight: '900' },
  healthWorkoutMeta: { color: '#8996A9', fontSize: 8, marginTop: 3 },
  healthImportedBadge: { backgroundColor: 'rgba(147,220,184,0.15)', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 5 },
  healthImportedText: { color: colors.mint, fontSize: 7, fontWeight: '900' },
  healthNoWorkout: { color: '#9AA7BA', fontSize: 10, paddingVertical: 12 },
  healthDetected: { color: '#718096', fontSize: 8, marginTop: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10, marginBottom: 11 },
  sectionTitle: { color: colors.oat, fontFamily: 'serif', fontSize: 24, fontWeight: '700' },
  sectionHint: { color: '#748096', fontSize: 11 },
  dashboardStack: { gap: 12 },
  dayCard: { minHeight: 142, backgroundColor: colors.paper, borderRadius: radii.medium, padding: 16 },
  smallCardTitle: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  emptyAgendaIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#E8E8FF', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 12 },
  emptyBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  agendaList: { marginTop: 13, gap: 10 },
  agendaItem: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  agendaTime: { color: colors.cornflower, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  agendaTitle: { color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '700', marginTop: 3 },
  moneyCard: { minHeight: 260, backgroundColor: colors.mustard, borderRadius: radii.medium, padding: 17, overflow: 'hidden' },
  moneyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moneyEyebrow: { color: 'rgba(16,23,34,0.64)', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  moneySummaryRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 15 },
  moneyValue: { color: colors.text, fontFamily: 'serif', fontWeight: '800', fontSize: 34 },
  moneySub: { color: 'rgba(16,23,34,0.66)', fontSize: 11, lineHeight: 15, marginTop: 3 },
  connectMoney: { color: colors.text, fontFamily: 'serif', fontSize: 23, lineHeight: 25, fontWeight: '800', marginTop: 24 },
  changeBadge: { alignItems: 'flex-end', backgroundColor: 'rgba(255,249,237,0.48)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  changeText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  changeLabel: { color: 'rgba(16,23,34,0.56)', fontSize: 8, marginTop: 1 },
  dailyChart: { height: 84, flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 12, paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: 'rgba(16,23,34,0.16)' },
  dayBarColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 68 },
  dayAmount: { color: 'rgba(16,23,34,0.62)', fontSize: 9, fontWeight: '700', marginBottom: 3 },
  dayBar: { width: '70%', maxWidth: 42, backgroundColor: colors.text, borderTopLeftRadius: 6, borderTopRightRadius: 6, opacity: 0.82 },
  dayLabel: { color: colors.text, fontSize: 9, fontWeight: '800', position: 'absolute', bottom: -15 },
  categoryHeading: { color: 'rgba(16,23,34,0.60)', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 12 },
  categoryList: { marginTop: 6, gap: 5 },
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  categoryDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  categoryName: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '700' },
  categoryAmount: { color: colors.text, fontSize: 11, fontWeight: '900' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, paddingHorizontal: 4 },
  syncText: { flex: 1, color: '#7E8AA0', fontSize: 10 },
  insightSection: { marginTop: 8 },
  streakGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  streakCard: { width: '48%', backgroundColor: colors.inkSoft, borderRadius: 18, borderTopWidth: 4, padding: 14 },
  streakEmoji: { fontSize: 18 },
  streakValue: { color: colors.oat, fontFamily: 'serif', fontSize: 29, fontWeight: '800', marginTop: 5 },
  streakLabel: { color: '#8E9AAF', fontSize: 10, marginTop: 1 },
  weeklyCard: { backgroundColor: colors.oat, borderRadius: radii.large, padding: 18, marginTop: 16, marginBottom: 10 },
  weeklyEyebrow: { color: colors.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  weeklyTitle: { color: colors.text, fontFamily: 'serif', fontSize: 24, lineHeight: 29, fontWeight: '800', marginTop: 10 },
  weeklyNumbers: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  observation: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  aiReview: { color: colors.text, fontSize: 12, lineHeight: 19, backgroundColor: colors.paper, borderRadius: 15, padding: 13, marginTop: 10 },
  aiButton: { backgroundColor: colors.mint, borderRadius: 16, padding: 13, alignItems: 'center', marginTop: 13 },
  aiButtonText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  tokenHint: { color: colors.muted, fontSize: 9, textAlign: 'center', marginTop: 6 },
  budgetOverlay: { flex: 1, backgroundColor: 'rgba(4,10,20,0.72)', justifyContent: 'flex-end' },
  budgetSheet: { maxHeight: '91%', backgroundColor: colors.paper, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 19, paddingBottom: 12 },
  budgetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D2C8B8', alignSelf: 'center', marginTop: 10, marginBottom: 13 },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  budgetEyebrow: { color: colors.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  budgetTitle: { color: colors.text, fontFamily: 'serif', fontSize: 28, fontWeight: '800', marginTop: 5 },
  budgetClose: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.oat, alignItems: 'center', justifyContent: 'center' },
  budgetHero: { backgroundColor: colors.ink, borderRadius: 25, padding: 18 },
  budgetHeroLabel: { color: colors.mint, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  budgetHeroValue: { color: colors.oat, fontFamily: 'serif', fontSize: 40, fontWeight: '800', marginTop: 7 },
  budgetHeroSub: { color: '#AAB5C7', fontSize: 11, marginTop: 2 },
  budgetCycleLabel: { color: colors.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 9 },
  budgetTrack: { height: 9, backgroundColor: colors.inkMuted, borderRadius: 5, overflow: 'hidden', marginTop: 16 },
  budgetFill: { height: '100%', backgroundColor: colors.coral, borderRadius: 5 },
  budgetStats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  budgetStat: { flex: 1, minHeight: 82, backgroundColor: colors.oat, borderRadius: 17, padding: 11, justifyContent: 'space-between' },
  budgetStatValue: { color: colors.text, fontFamily: 'serif', fontSize: 17, fontWeight: '800' },
  budgetStatLabel: { color: colors.muted, fontSize: 9, lineHeight: 12 },
  budgetSectionTitle: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginTop: 21, marginBottom: 9 },
  coachNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 15, padding: 12, marginBottom: 7 },
  coachDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, marginRight: 9 },
  coachNoteText: { flex: 1, color: colors.text, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  budgetCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  budgetCategoryRank: { color: colors.coral, fontSize: 10, fontWeight: '900' },
  budgetCategoryName: { color: colors.text, fontSize: 12, fontWeight: '800' },
  categoryTrack: { height: 4, backgroundColor: '#E5DDCE', borderRadius: 2, marginTop: 5, overflow: 'hidden' },
  categoryFill: { height: '100%', backgroundColor: colors.mustard, borderRadius: 2 },
  budgetCategoryAmount: { color: colors.text, fontSize: 11, fontWeight: '900' },
  budgetCategoryShare: { color: colors.muted, fontSize: 9, marginTop: 2 },
  subcategoryPanel: { backgroundColor: '#EFE7D8', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 7 },
  subcategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D6CCBC' },
  subcategoryDot: { width: 7, height: 7, borderRadius: 4 },
  subcategoryName: { color: colors.text, fontSize: 11, fontWeight: '800' },
  subcategoryShare: { color: colors.muted, fontSize: 8, marginTop: 2 },
  subcategoryAmount: { color: colors.text, fontSize: 11, fontWeight: '900' },
  paydayRow: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DED5C5', borderRadius: 16, padding: 11 },
  paydayTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  paydayHint: { color: colors.muted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  paydayPrefix: { color: colors.muted, fontSize: 8, fontWeight: '900' },
  paydayInput: { width: 38, color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center', paddingVertical: 3, borderBottomWidth: 2, borderBottomColor: colors.coral },
  paydaySave: { backgroundColor: colors.ink, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10 },
  paydaySaveText: { color: colors.oat, fontSize: 9, fontWeight: '900' },
  budgetEditRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DED5C5', borderRadius: 16, overflow: 'hidden' },
  currencyPrefix: { color: colors.muted, fontSize: 12, fontWeight: '900', paddingLeft: 13 },
  budgetInput: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 12 },
  budgetSave: { backgroundColor: colors.mint, paddingHorizontal: 17, alignSelf: 'stretch', justifyContent: 'center' },
  budgetSaveText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  suggestedHint: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 6 },
  refreshBudget: { flexDirection: 'row', gap: 7, alignItems: 'center', alignSelf: 'center', padding: 13, marginTop: 8 },
  refreshBudgetText: { color: colors.cornflower, fontSize: 11, fontWeight: '800' },
  realityCard: { backgroundColor: '#15243A', borderRadius: radii.medium, padding: 17, borderWidth: 1, borderColor: '#29405E' },
  realityCardDanger: { borderColor: colors.coral, borderWidth: 2 },
  realityTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  realityEyebrow: { color: colors.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  realityTitle: { color: '#9AA8BA', fontSize: 10, marginTop: 3 },
  realityValue: { color: colors.white, fontFamily: 'serif', fontSize: 38, fontWeight: '800', marginTop: 13 },
  realityValueLabel: { color: colors.mint, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  realityEquation: { flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 10 },
  realityEquationItem: { flex: 1 },
  realityEquationValue: { color: colors.oat, fontSize: 11, fontWeight: '900' },
  realityEquationLabel: { color: '#7E8AA0', fontSize: 7, marginTop: 2 },
  realityOperator: { color: '#6F7E93', fontSize: 17, marginHorizontal: 5 },
  realityCoach: { color: '#9AA8BA', fontSize: 9, lineHeight: 14, marginTop: 10 },
  realityPanel: { backgroundColor: colors.ink, borderRadius: 21, padding: 16, borderWidth: 1, borderColor: colors.inkMuted },
  realityPanelDanger: { borderColor: colors.coral },
  realityPanelLabel: { color: colors.mint, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  realityPanelValue: { color: colors.oat, fontFamily: 'serif', fontSize: 34, fontWeight: '800', marginTop: 5 },
  realityPanelFormula: { color: '#93A0B3', fontSize: 9, lineHeight: 14, marginTop: 3, marginBottom: 10 },
  realityCardDebtRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.inkMuted, paddingTop: 9, marginTop: 7 },
  realityDebtName: { color: colors.white, fontSize: 11, fontWeight: '800' },
  realityDebtMeta: { color: '#7E8AA0', fontSize: 7, marginTop: 2 },
  realityDebtAmount: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  realityPickerHint: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 12, marginBottom: 7 },
  realityAccountWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  realityAccountChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#D7CDBC', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  realityAccountChipActive: { backgroundColor: colors.mint, borderColor: colors.mint },
  realityAccountText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  realityAccountTextActive: { color: colors.ink },
  guardCard: { backgroundColor: colors.inkSoft, borderRadius: radii.medium, padding: 17, borderWidth: 1, borderColor: colors.inkMuted },
  guardCardBreached: { borderColor: colors.coral, borderWidth: 2 },
  guardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  guardEyebrow: { color: colors.mint, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  guardTitle: { color: colors.oat, fontFamily: 'serif', fontSize: 22, fontWeight: '800', marginTop: 5 },
  guardPercentBadge: { backgroundColor: 'rgba(147,220,184,0.16)', borderRadius: 13, paddingHorizontal: 11, paddingVertical: 8 },
  guardPercentBadgeDanger: { backgroundColor: 'rgba(255,101,66,0.18)' },
  guardPercent: { color: colors.oat, fontSize: 14, fontWeight: '900' },
  guardAmountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 17 },
  guardSpent: { color: colors.white, fontFamily: 'serif', fontSize: 31, fontWeight: '800' },
  guardLimit: { color: '#8E9AAF', fontSize: 12, fontWeight: '700' },
  guardTrack: { height: 8, backgroundColor: colors.inkMuted, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  guardFill: { height: '100%', borderRadius: 4, backgroundColor: colors.mint },
  guardFillDanger: { backgroundColor: colors.coral },
  guardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  guardRemaining: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  guardCycle: { color: '#7E8AA0', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  guardSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 19, marginBottom: 8 },
  guardAddButton: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.mint, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11 },
  guardAddText: { color: colors.ink, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  guardListRow: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFFFFF', borderRadius: 15, padding: 12, marginBottom: 7 },
  guardStatusDot: { width: 9, height: 9, borderRadius: 5 },
  guardListName: { color: colors.text, fontSize: 12, fontWeight: '900' },
  guardListTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinnedPill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.mint, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 2 },
  pinnedPillText: { color: colors.ink, fontSize: 6, fontWeight: '900', letterSpacing: 0.5 },
  guardListMeta: { color: colors.muted, fontSize: 8, marginTop: 2 },
  guardListAmount: { color: colors.text, fontSize: 11, fontWeight: '900' },
  guardListPercent: { color: colors.muted, fontSize: 8, marginTop: 2 },
  guardEmpty: { color: colors.muted, fontSize: 10, lineHeight: 15, backgroundColor: '#FFFFFF', borderRadius: 15, padding: 13 },
  guardDetailSheet: { maxHeight: '91%', backgroundColor: colors.paper, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 19, paddingBottom: 12 },
  guardDetailHero: { backgroundColor: colors.ink, borderRadius: 24, padding: 18 },
  guardDetailHeroDanger: { borderWidth: 2, borderColor: colors.coral },
  guardDetailStatus: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  guardDetailValue: { color: colors.oat, fontFamily: 'serif', fontSize: 41, fontWeight: '800', marginTop: 7 },
  guardDetailLimit: { color: '#AAB5C7', fontSize: 11 },
  guardDarkTrack: { height: 9, borderRadius: 5, backgroundColor: colors.inkMuted, overflow: 'hidden', marginTop: 15 },
  guardDetailMessage: { color: colors.white, fontSize: 11, fontWeight: '800', marginTop: 10 },
  guardBreakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  guardBreakdownName: { color: colors.text, fontSize: 11, fontWeight: '800' },
  guardBreakdownAmount: { color: colors.text, fontSize: 11, fontWeight: '900' },
  guardTransaction: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  guardTransactionName: { color: colors.text, fontSize: 12, fontWeight: '800' },
  guardTransactionMeta: { color: colors.muted, fontSize: 8, marginTop: 3 },
  guardTransactionAmount: { color: colors.coral, fontSize: 12, fontWeight: '900' },
  guardFreshness: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 14, fontStyle: 'italic' },
  guardDetailActions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  guardEditButton: { flex: 1, backgroundColor: colors.ink, borderRadius: 14, padding: 13, alignItems: 'center' },
  guardEditText: { color: colors.oat, fontSize: 10, fontWeight: '900' },
  guardDeleteButton: { width: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  guardPauseButton: { width: 48, borderRadius: 14, backgroundColor: colors.mustard, alignItems: 'center', justifyContent: 'center' },
  guardPinButton: { width: 48, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  guardPinButtonActive: { backgroundColor: colors.mint },
  guardEditor: { backgroundColor: colors.paper, borderRadius: 28, maxHeight: '92%' },
  guardEditorContent: { padding: 20 },
  guardFieldLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 15, marginBottom: 7 },
  guardChoiceRow: { flexDirection: 'row', gap: 6 },
  guardChoice: { flex: 1, minHeight: 36, borderWidth: 1, borderColor: '#D9CFBF', borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  guardChoiceActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  guardChoiceText: { color: colors.muted, fontSize: 7, fontWeight: '900', textAlign: 'center' },
  guardChoiceTextActive: { color: colors.mint },
  guardPickerWrap: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DED5C5', borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  guardPicker: { color: colors.text, height: 48 },
  guardTextInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DED5C5', color: colors.text, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, fontWeight: '700' },
  guardThresholdHint: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 13 },
  guardSaveButton: { backgroundColor: colors.mint, borderRadius: 15, padding: 14, alignItems: 'center', marginTop: 15 },
  guardSaveText: { color: colors.ink, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
});
