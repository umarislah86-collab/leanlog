import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useState } from 'react';
import { fsUpsert, fsDelete, fsFetchAll, fsMirrorPhotoFetchAll, fsMirrorPhotoUpsert, fsMirrorPhotoDelete } from '../firebase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { runLeanLogAi } from '../services/ai';
import { useLanguage } from '../context/LanguageContext';
import type { FoodEntry, ActivityEntry, WeightEntry, UserProfile, GymSession } from '../types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import WeightAreaChart from '../components/WeightAreaChart';

const FOOD_KEY = 'calorie_entries';
const ACTIVITY_KEY = 'activity_entries';
const WEIGHT_KEY = 'weight_entries';
const GOAL_KEY = 'calorie_goal';
const PROFILE_KEY = 'user_profile';
const GYM_SESSIONS_KEY = 'gym_sessions';
const DEFAULT_GOAL = 2000;

const MONTH_SHORT_BM = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const MONTH_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_SHORT_BM = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const DAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateKey = (d: Date) => d.toLocaleDateString('ms-MY');

const parseDateKey = (key: string): number => {
  const p = key.split('/');
  if (p.length !== 3) return 0;
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])).getTime();
};

const displayDate = (dateKey: string, lang = 'bm'): string => {
  const MONTH_SHORT = lang === 'en' ? MONTH_SHORT_EN : MONTH_SHORT_BM;
  const DAY_SHORT = lang === 'en' ? DAY_SHORT_EN : DAY_SHORT_BM;
  const todayLabel = lang === 'en' ? 'Today' : 'Hari Ini';
  const yestLabel = lang === 'en' ? 'Yesterday' : 'Semalam';
  const p = dateKey.split('/');
  if (p.length !== 3) return dateKey;
  const d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  const todayKey = formatDateKey(new Date());
  const yday = new Date(); yday.setDate(yday.getDate() - 1);
  const yearSuffix = parseInt(p[2]) !== new Date().getFullYear() ? ` ${p[2]}` : '';
  if (dateKey === todayKey) return todayLabel;
  if (dateKey === formatDateKey(yday)) return yestLabel;
  return `${DAY_SHORT[d.getDay()]}, ${parseInt(p[0])} ${MONTH_SHORT[parseInt(p[1]) - 1]}${yearSuffix}`;
};

const displayDateFull = (dateKey: string, lang = 'bm'): string => {
  const MONTH_SHORT = lang === 'en' ? MONTH_SHORT_EN : MONTH_SHORT_BM;
  const DAY_SHORT = lang === 'en' ? DAY_SHORT_EN : DAY_SHORT_BM;
  const todayLabel = lang === 'en' ? 'Today' : 'Hari Ini';
  const yestLabel = lang === 'en' ? 'Yesterday' : 'Semalam';
  const p = dateKey.split('/');
  if (p.length !== 3) return dateKey;
  const d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
  const todayKey = formatDateKey(new Date());
  const yday = new Date(); yday.setDate(yday.getDate() - 1);
  const datePart = `${parseInt(p[0])} ${MONTH_SHORT[parseInt(p[1]) - 1]} ${p[2]}`;
  if (dateKey === todayKey) return `${todayLabel}, ${datePart}`;
  if (dateKey === formatDateKey(yday)) return `${yestLabel}, ${datePart}`;
  return `${DAY_SHORT[d.getDay()]}, ${datePart}`;
};

const getStatusInfo = (avg: number, goal: number, statusLabels: Record<string, string>) => {
  const pct = (avg - goal) / goal;
  if (pct < -0.15) return { icon: '⬇️', label: statusLabels.under, color: '#8D9BFF' };
  if (pct < -0.03) return { icon: '✓', label: statusLabels.slightUnder, color: '#81C784' };
  if (pct <= 0.03) return { icon: '🎯', label: statusLabels.onTarget, color: '#FF6542' };
  if (pct <= 0.15) return { icon: '↑', label: statusLabels.slightOver, color: '#E8B84A' };
  return { icon: '⚠️', label: statusLabels.over, color: '#FF6542' };
};

type Period = '7' | '30' | 'all';

type MirrorPhoto = { id: string; base64: string; displayDate?: string; weight?: number; waist?: number };

// ── Weight Line Chart ────────────────────────────────
function catmullRom(pts: {x: number, y: number}[], segs = 14): {x: number, y: number}[] {
  if (pts.length < 2) return pts;
  const out: {x: number, y: number}[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let t = 0; t < segs; t++) {
      const s = t / segs, s2 = s * s, s3 = s2 * s;
      out.push({
        x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*s + (2*p0.x-5*p1.x+4*p2.x-p3.x)*s2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*s3),
        y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*s + (2*p0.y-5*p1.y+4*p2.y-p3.y)*s2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*s3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const WeightLineChart = ({ entries }: { entries: WeightEntry[] }) => {
  const [chartWidth, setChartWidth] = useState(0);
  const sorted = [...entries]
    .sort((a, b) => parseDateKey(a.date) - parseDateKey(b.date))
    .slice(-12);

  if (sorted.length < 2) return null;

  const CHART_H = 140;
  const PAD = { top: 12, right: 16, bottom: 36, left: 44 };

  const vals = sorted.map(w => w.weight);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const pad = Math.max((maxV - minV) * 0.2, 0.5);
  const lo = minV - pad, hi = maxV + pad, range = hi - lo;

  const times = sorted.map(w => parseDateKey(w.date));
  const minT = times[0], maxT = times[times.length - 1];
  const timeRange = maxT - minT || 1;

  const gx = (t: number, w: number) =>
    PAD.left + ((t - minT) / timeRange) * (w - PAD.left - PAD.right);
  const gy = (v: number) =>
    PAD.top + (1 - (v - lo) / range) * (CHART_H - PAD.top - PAD.bottom);

  return (
    <View
      style={chartStyles.wrap}
      onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
    >
      {chartWidth > 0 && (() => {
        const pts = sorted.map((w, i) => ({ x: gx(times[i], chartWidth), y: gy(w.weight), entry: w }));
        const smoothPts = catmullRom(pts);

        // Only show labels that are ≥42px apart (prevent overlap)
        const labelPts = pts.reduce<typeof pts>((acc, p, i) => {
          const last = acc[acc.length - 1];
          if (i === 0 || i === pts.length - 1 || !last || p.x - last.x >= 42) acc.push(p);
          return acc;
        }, []);

        return (
          <View style={{ position: 'absolute', top: 0, left: 0, width: chartWidth, height: CHART_H }}>
            {/* Y-axis labels */}
            <Text style={[chartStyles.axisLbl, { top: gy(maxV) - 6 }]}>{maxV.toFixed(1)}</Text>
            <Text style={[chartStyles.axisLbl, { top: gy(minV) - 6 }]}>{minV.toFixed(1)}</Text>

            {/* Grid lines */}
            {[minV, (minV + maxV) / 2, maxV].map((v, gi) => (
              <View key={gi} style={{
                position: 'absolute', left: PAD.left, top: gy(v),
                width: chartWidth - PAD.left - PAD.right, height: 1, backgroundColor: '#222',
              }} />
            ))}

            {/* Smooth line segments (Catmull-Rom) */}
            {smoothPts.slice(0, -1).map((p, i) => {
              const nx = smoothPts[i + 1].x, ny = smoothPts[i + 1].y;
              const len = Math.sqrt((nx - p.x) ** 2 + (ny - p.y) ** 2);
              const angle = Math.atan2(ny - p.y, nx - p.x) * 180 / Math.PI;
              return (
                <View key={i} style={{
                  position: 'absolute', width: len, height: 2, backgroundColor: '#FF6542',
                  left: (p.x + nx) / 2 - len / 2, top: (p.y + ny) / 2 - 1,
                  transform: [{ rotate: `${angle}deg` }],
                }} />
              );
            })}

            {/* Dots at actual data points */}
            {pts.map((p, i) => (
              <View key={i} style={{
                position: 'absolute', width: 7, height: 7, borderRadius: 4,
                backgroundColor: '#FF6542', borderWidth: 2, borderColor: '#172338',
                left: p.x - 3.5, top: p.y - 3.5,
              }} />
            ))}

            {/* X-axis labels (DD/MM/YY) — time-proportional, no overlap */}
            {labelPts.map((p, i) => {
              const parts = p.entry.date.split('/');
              const label = `${parts[0]}/${parts[1]}/${parts[2].slice(2)}`;
              return (
                <Text key={i} style={[chartStyles.axisLbl, {
                  position: 'absolute', left: p.x - 18, top: CHART_H - PAD.bottom + 6,
                  width: 38, textAlign: 'center',
                }]}>
                  {label}
                </Text>
              );
            })}
          </View>
        );
      })()}
    </View>
  );
};

const chartStyles = StyleSheet.create({
  wrap: { height: 140, position: 'relative', marginTop: 4 },
  axisLbl: { position: 'absolute', color: '#7D8799', fontSize: 9, left: 0, width: 42, textAlign: 'right' },
});

interface DaySummary {
  dateKey: string;
  consumed: number;
  burned: number;
  net: number;
  foodCount: number;
  activityCount: number;
}

export default function ProgressScreen() {
  const { t, lang } = useLanguage();
  const [period, setPeriod] = useState<Period>('7');
  const [allFood, setAllFood] = useState<FoodEntry[]>([]);
  const [allActivities, setAllActivities] = useState<ActivityEntry[]>([]);
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState('70.0');
  const [newWeightPickedDate, setNewWeightPickedDate] = useState(new Date());
  const [showWeightDatePicker, setShowWeightDatePicker] = useState(false);

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [mirrorPhotos, setMirrorPhotos] = useState<MirrorPhoto[]>([]);
  const [showWeightListModal, setShowWeightListModal] = useState(false);
  const [showMirrorGalleryModal, setShowMirrorGalleryModal] = useState(false);
  const [mirrorGallerySelected, setMirrorGallerySelected] = useState<MirrorPhoto | null>(null);
  const [mirrorUploadLoading, setMirrorUploadLoading] = useState(false);
  const [showMirrorDetailModal, setShowMirrorDetailModal] = useState(false);
  const [mirrorDetailPhoto, setMirrorDetailPhoto] = useState<MirrorPhoto | null>(null);
  const [mirrorDetailDate, setMirrorDetailDate] = useState('');
  const [mirrorDetailDateObj, setMirrorDetailDateObj] = useState(new Date());
  const [showMirrorDetailDatePicker, setShowMirrorDetailDatePicker] = useState(false);
  const [mirrorDetailWeight, setMirrorDetailWeight] = useState('');
  const [mirrorDetailWaist, setMirrorDetailWaist] = useState('');
  const [gymSessions, setGymSessions] = useState<GymSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadData(period);
    }, [period])
  );

  const buildSummaries = (food: FoodEntry[], acts: ActivityEntry[], p: Period): DaySummary[] => {
    const today = new Date();
    let dateKeys: string[] = [];
    if (p === 'all') {
      const allDates = new Set([...food.map((e) => e.date), ...acts.map((e) => e.date)]);
      dateKeys = Array.from(allDates);
    } else {
      const days = p === '7' ? 7 : 30;
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dateKeys.push(formatDateKey(d));
      }
    }
    return dateKeys
      .map((dateKey) => {
        const dayFood = food.filter((e) => e.date === dateKey);
        const dayAct = acts.filter((e) => e.date === dateKey);
        const consumed = dayFood.reduce((s, e) => s + e.calories, 0);
        const burned = dayAct.reduce((s, e) => s + e.caloriesBurned, 0);
        return { dateKey, consumed, burned, net: consumed - burned, foodCount: dayFood.length, activityCount: dayAct.length };
      })
      .filter((d) => d.consumed > 0 || d.burned > 0)
      .sort((a, b) => parseDateKey(b.dateKey) - parseDateKey(a.dateKey));
  };

  const loadData = async (p: Period) => {
    const [savedFood, savedActivities, savedWeights, savedGoal, savedProfile] = await Promise.all([
      AsyncStorage.getItem(FOOD_KEY),
      AsyncStorage.getItem(ACTIVITY_KEY),
      AsyncStorage.getItem(WEIGHT_KEY),
      AsyncStorage.getItem(GOAL_KEY),
      AsyncStorage.getItem(PROFILE_KEY),
    ]);

    const food: FoodEntry[] = savedFood ? JSON.parse(savedFood) : [];
    const activities: ActivityEntry[] = savedActivities ? JSON.parse(savedActivities) : [];
    let weights: WeightEntry[] = savedWeights ? JSON.parse(savedWeights) : [];

    if (weights.length === 0) {
      const fsWeights = await fsFetchAll<WeightEntry>('weightEntries');
      if (fsWeights.length > 0) {
        weights = fsWeights;
        await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(weights));
      }
    }
    const calorieGoal = savedGoal ? Number(savedGoal) : DEFAULT_GOAL;
    const profile: UserProfile | null = savedProfile ? JSON.parse(savedProfile) : null;

    setAllFood(food);
    setAllActivities(activities);
    setWeightEntries(weights.sort((a, b) => parseDateKey(b.date) - parseDateKey(a.date)));
    setGoal(calorieGoal);
    setUserProfile(profile);
    setDaySummaries(buildSummaries(food, activities, p));

    const photos = await fsMirrorPhotoFetchAll();
    const parseDt = (p: any): number => {
      const parts = (p.displayDate || '').split('/');
      return parts.length === 3 ? new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime() : 0;
    };
    setMirrorPhotos(photos.sort((a, b) => parseDt(b) - parseDt(a)));

    const savedGym = await AsyncStorage.getItem(GYM_SESSIONS_KEY);
    setGymSessions(savedGym ? JSON.parse(savedGym) : []);
  };

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    loadData(p);
  };

  const deleteEntry = (id: string, type: 'food' | 'activity') => {
    Alert.alert(t('delete'), t('confirmDeleteEntry'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          if (type === 'food') {
            const updated = allFood.filter((e) => e.id !== id);
            setAllFood(updated);
            await AsyncStorage.setItem(FOOD_KEY, JSON.stringify(updated));
            fsDelete('foodEntries', id);
            setDaySummaries(buildSummaries(updated, allActivities, period));
          } else {
            const updated = allActivities.filter((e) => e.id !== id);
            setAllActivities(updated);
            await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated));
            fsDelete('activityEntries', id);
            setDaySummaries(buildSummaries(allFood, updated, period));
          }
        },
      },
    ]);
  };

  const deleteGymSession = (session: GymSession) => {
    Alert.alert(t('delete'), t('confirmDeleteEntry'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          const updatedGym = gymSessions.filter((s) => s.id !== session.id);
          setGymSessions(updatedGym);
          await AsyncStorage.setItem(GYM_SESSIONS_KEY, JSON.stringify(updatedGym));
          fsDelete('gymSessions', session.id);
          if (session.activityEntryId) {
            const updatedAct = allActivities.filter((e) => e.id !== session.activityEntryId);
            setAllActivities(updatedAct);
            await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(updatedAct));
            fsDelete('activityEntries', session.activityEntryId);
            setDaySummaries(buildSummaries(allFood, updatedAct, period));
          }
        },
      },
    ]);
  };

  const saveWeight = () => {
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) { Alert.alert(t('error'), t('invalidWeight')); return; }
    const date = formatDateKey(newWeightPickedDate);
    const entry: WeightEntry = { id: Date.now().toString(), weight: w, date };
    const updated = [entry, ...weightEntries].sort((a, b) => parseDateKey(b.date) - parseDateKey(a.date));
    setWeightEntries(updated);
    AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(updated));
    fsUpsert('weightEntries', entry.id, entry);
    setNewWeight('70.0');
    setShowWeightModal(false);
  };

  const deleteWeight = (id: string) => {
    Alert.alert(t('delete'), t('deleteWeightConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: () => {
          const updated = weightEntries.filter((e) => e.id !== id);
          setWeightEntries(updated);
          AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(updated));
          fsDelete('weightEntries', id);
        },
      },
    ]);
  };

  const getMirrorMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const uploadMirrorPhoto = () => {
    Alert.alert(t('selectSource'), '', [
      { text: `📷 ${t('camera')}`, onPress: () => pickMirrorSource(true) },
      { text: `🖼️ ${t('gallery')}`, onPress: () => pickMirrorSource(false) },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const pickMirrorSource = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t('permRequired'), t('permCameraMsg')); return; }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.9 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t('permRequired'), t('permGalleryMsg')); return; }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
    }
    if (result.canceled || !result.assets[0]?.uri) return;
    doUploadMirror(result.assets[0].uri, String(Date.now()));
  };

  const parseMirrorDate = (p: MirrorPhoto): number => {
    const d = p.displayDate || '';
    const parts = d.split('/');
    if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
    return 0;
  };

  const doUploadMirror = async (uri: string, key: string) => {
    setMirrorUploadLoading(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!compressed.base64) return;
      const now = new Date();
      const displayDate = formatDateKey(now);
      const data: MirrorPhoto = { id: key, base64: compressed.base64, displayDate };
      await fsMirrorPhotoUpsert(key, data);
      setMirrorPhotos(prev =>
        [data, ...prev].sort((a, b) => parseMirrorDate(b) - parseMirrorDate(a))
      );
    } catch (e) {
      Alert.alert(t('error'), t('failSavePhoto') + (e instanceof Error ? e.message : String(e)));
    } finally {
      setMirrorUploadLoading(false);
    }
  };

  const deleteMirrorPhoto = (id: string) => {
    Alert.alert(t('deleteMirrorTitle'), t('deleteMirrorMsg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        await fsMirrorPhotoDelete(id);
        setMirrorPhotos(prev => prev.filter(p => p.id !== id));
        if (mirrorGallerySelected?.id === id) setMirrorGallerySelected(null);
      }},
    ]);
  };

  const openMirrorDetail = (p: MirrorPhoto) => {
    setMirrorDetailPhoto(p);
    // Parse stored displayDate (DD/MM/YYYY) or fall back to YYYY-MM month key
    let dateObj = new Date();
    const disp = p.displayDate || '';
    const parts = disp.split('/');
    if (parts.length === 3) {
      dateObj = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    } else {
      const mp = p.id.split('-');
      if (mp.length === 2) dateObj = new Date(+mp[0], +mp[1] - 1, 1);
    }
    setMirrorDetailDateObj(dateObj);
    setMirrorDetailDate(disp || formatDateKey(dateObj));
    setMirrorDetailWeight(p.weight ? String(p.weight) : '');
    setMirrorDetailWaist(p.waist ? String(p.waist) : '');
    setShowMirrorDetailModal(true);
  };

  const saveMirrorDetail = async () => {
    if (!mirrorDetailPhoto) return;
    const updated: MirrorPhoto = {
      ...mirrorDetailPhoto,
      displayDate: mirrorDetailDate.trim() || mirrorDetailPhoto.id,
      ...(mirrorDetailWeight ? { weight: parseFloat(mirrorDetailWeight) } : {}),
      ...(mirrorDetailWaist ? { waist: parseFloat(mirrorDetailWaist) } : {}),
    };
    try {
      await fsMirrorPhotoUpsert(mirrorDetailPhoto.id, updated);
      setMirrorPhotos(prev =>
        prev.map(p => p.id === mirrorDetailPhoto.id ? updated : p)
           .sort((a, b) => parseMirrorDate(b) - parseMirrorDate(a))
      );
      setShowMirrorDetailModal(false);
    } catch (e) {
      Alert.alert(t('error'), t('failSavePhoto') + (e instanceof Error ? e.message : String(e)));
    }
  };

  const exportPDF = async () => {
    if (!allFood.length && !allActivities.length && !weightEntries.length) {
      Alert.alert(t('noData'), t('noDataToExport')); return;
    }
    setExportLoading(true);
    try {
      const today = new Date().toLocaleDateString('ms-MY');
      const catMap: Record<string, string> = { sarapan: 'Sarapan', tengahari: 'Tengah Hari', malam: 'Malam', snek: 'Snek' };

      const last14 = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - i);
        return d.toLocaleDateString('ms-MY');
      });

      const summaryRows = last14.map(date => {
        const c = allFood.filter(e => e.date === date).reduce((s, e) => s + e.calories, 0);
        const b = allActivities.filter(e => e.date === date).reduce((s, e) => s + e.caloriesBurned, 0);
        const net = c - b;
        const diff = net - goal;
        const color = net > goal ? '#e53935' : net > goal * 0.8 ? '#f57c00' : '#388e3c';
        return `<tr><td>${date}</td><td>${c}</td><td>${b}</td><td style="color:${color};font-weight:600">${net}</td><td>${diff > 0 ? '+' + diff : diff}</td></tr>`;
      }).join('');

      const foodRows = allFood.slice(0, 60).map(e =>
        `<tr><td>${e.date}</td><td>${e.time || ''}</td><td>${e.name || ''}</td><td>${catMap[e.category] || e.category}</td><td>${e.calories}</td></tr>`
      ).join('');

      const actRows = allActivities.slice(0, 40).map(a =>
        `<tr><td>${a.date}</td><td>${a.time || ''}</td><td>${a.name || ''}</td><td>${a.duration || 0} min</td><td>${a.caloriesBurned}</td></tr>`
      ).join('');

      const wtRows = weightEntries.map(w => {
        const bmiVal = userProfile?.height ? (w.weight / Math.pow(userProfile.height / 100, 2)).toFixed(1) : '-';
        return `<tr><td>${w.date}</td><td>${w.weight} kg</td><td>${bmiVal}</td></tr>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
        <style>
          body{font-family:sans-serif;padding:24px;color:#222;font-size:12px}
          h1{color:#2e7d32;font-size:18px;margin-bottom:4px}
          h2{color:#2e7d32;font-size:13px;margin:20px 0 6px;border-bottom:1px solid #e0e0e0;padding-bottom:4px}
          .meta{color:#AAB3C2;font-size:11px;margin-bottom:20px}
          table{width:100%;border-collapse:collapse;margin-bottom:8px}
          th{background:#f5f5f5;text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;color:#8D97A8}
          td{padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px}
        </style></head><body>
        <h1>CalorieTracker — Laporan Eksport</h1>
        <p class="meta">Tarikh: ${today} &nbsp;|&nbsp; Sasaran: ${goal} kcal/hari</p>

        <h2>Ringkasan 14 Hari Terkini</h2>
        <table><tr><th>Tarikh</th><th>Dimakan (kcal)</th><th>Dibakar (kcal)</th><th>Bersih (kcal)</th><th>vs Sasaran</th></tr>
        ${summaryRows}</table>

        <h2>Rekod Makanan (${allFood.length} rekod)</h2>
        <table><tr><th>Tarikh</th><th>Masa</th><th>Makanan</th><th>Kategori</th><th>Kalori</th></tr>
        ${foodRows}</table>

        <h2>Rekod Aktiviti (${allActivities.length} rekod)</h2>
        <table><tr><th>Tarikh</th><th>Masa</th><th>Aktiviti</th><th>Tempoh</th><th>Dibakar (kcal)</th></tr>
        ${actRows}</table>

        <h2>Rekod Berat Badan (${weightEntries.length} rekod)</h2>
        <table><tr><th>Tarikh</th><th>Berat</th><th>BMI</th></tr>
        ${wtRows}</table>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert(t('error'), t('failExportPdf') + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExportLoading(false);
    }
  };

  const exportCSV = async () => {
    if (!allFood.length && !allActivities.length && !weightEntries.length) {
      Alert.alert(t('noData'), t('noDataToExport')); return;
    }
    setExportLoading(true);
    try {
      const today = new Date().toLocaleDateString('ms-MY').replace(/\//g, '-');
      const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;

      let csv = 'CALORIE TRACKER EXPORT\n\n';

      csv += 'MAKANAN\n';
      csv += 'Tarikh,Masa,Nama Makanan,Kategori,Kalori (kcal)\n';
      allFood.forEach(e => {
        csv += `${esc(e.date)},${esc(e.time || '')},${esc(e.name || '')},${esc(e.category || '')},${e.calories}\n`;
      });

      csv += '\nAKTIVITI\n';
      csv += 'Tarikh,Masa,Aktiviti,Tempoh (min),Kalori Dibakar (kcal)\n';
      allActivities.forEach(a => {
        csv += `${esc(a.date)},${esc(a.time || '')},${esc(a.name || '')},${a.duration || 0},${a.caloriesBurned}\n`;
      });

      csv += '\nBERAT BADAN\n';
      csv += 'Tarikh,Berat (kg),BMI\n';
      weightEntries.forEach(w => {
        const bmiVal = userProfile?.height ? (w.weight / Math.pow(userProfile.height / 100, 2)).toFixed(1) : '';
        csv += `${esc(w.date)},${w.weight},${bmiVal}\n`;
      });

      const fileUri = `${FileSystem.documentDirectory}CalorieTracker_${today}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Eksport CSV' });
    } catch (e) {
      Alert.alert(t('error'), t('failExportCsv') + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExportLoading(false);
    }
  };

  const getAIFeedback = async () => {
    setLoadingFeedback(true);
    setShowFeedback(true);
    setFeedbackText('');
    try {
      const last7 = daySummaries.slice(0, 7);
      const summaryLines = last7.map((d) =>
        `- ${displayDate(d.dateKey)}: ${d.net} kcal bersih (makan ${d.consumed} kcal, bakar ${d.burned} kcal)`
      ).join('\n');

      const latestWeight = weightEntries[0]?.weight;
      const bmi = latestWeight && userProfile?.height
        ? (latestWeight / Math.pow(userProfile.height / 100, 2)).toFixed(1)
        : null;

      const weightLines = weightEntries.slice(0, 10)
        .map((w) => `- ${displayDate(w.date)}: ${w.weight} kg`)
        .join('\n');
      const weightChange = weightEntries.length >= 2
        ? (weightEntries[0].weight - weightEntries[weightEntries.length - 1].weight).toFixed(1)
        : null;

      // Mirror photo comparison: even n → n/2-1 vs n-1; odd n → 0 vs n-1
      const sortedMirrors = [...mirrorPhotos].sort((a, b) => parseMirrorDate(a) - parseMirrorDate(b));
      const nm = sortedMirrors.length;
      const mirrorInput: { type: string; mime_type?: string; data?: string; text?: string }[] = [];
      let mirrorPromptLine = '';
      if (nm >= 2) {
        const idxA = nm % 2 === 0 ? nm / 2 - 1 : 0;
        const photoA = sortedMirrors[idxA];
        const photoB = sortedMirrors[nm - 1];
        mirrorInput.push({ type: 'image', mime_type: 'image/jpeg', data: photoA.base64 });
        mirrorInput.push({ type: 'image', mime_type: 'image/jpeg', data: photoB.base64 });
        const dateA = photoA.displayDate || photoA.id;
        const dateB = photoB.displayDate || photoB.id;
        mirrorPromptLine = `\nDua gambar cermin disertakan (Gambar 1: ${dateA}, Gambar 2: ${dateB}) — analisa perubahan fizikal yang kelihatan. PENTING: dalam analisis anda, WAJIB sebut gambar dengan tarikh secara eksplisit seperti "Gambar 1 (${dateA})" dan "Gambar 2 (${dateB})" supaya pembaca tahu gambar mana yang dirujuk.\n4. Perubahan fizikal dari gambar cermin (bandingkan kedua-dua gambar secara spesifik — nyatakan "Gambar 1 (${dateA})" dan "Gambar 2 (${dateB})" dalam setiap penerangan anda)`;
      }

      const prompt = `Analisa data kesihatan saya dan berikan maklum balas ringkas dalam Bahasa Malaysia yang mesra dan membina.

Data kalori (${last7.length} hari):
${summaryLines || '(tiada data)'}

Rekod berat badan:
${weightLines || '(tiada data)'}
${weightChange !== null ? `Perubahan berat: ${Number(weightChange) > 0 ? '+' : ''}${weightChange} kg` : ''}

Maklumat pengguna:
- Sasaran harian: ${goal} kcal
- Berat semasa: ${latestWeight ? `${latestWeight} kg` : 'tidak direkodkan'}
- BMI: ${bmi ?? 'tidak boleh dikira'}
- Profil: ${userProfile ? `${userProfile.age} tahun, ${userProfile.gender}` : 'tidak ditetapkan'}

Berikan analisa dalam format berikut (ringkas, tidak lebih 200 patah perkataan):
1. Prestasi keseluruhan kalori (dalam sasaran atau tidak?)
2. Trend berat badan (naik/turun/stabil?)
3. 2-3 cadangan praktikal${mirrorPromptLine}`;

      const output = await runLeanLogAi(
        'progress_review',
        [...mirrorInput, { type: 'text', text: prompt }] as any,
      );
      setFeedbackText(output);
    } catch (err) {
      setFeedbackText('Ralat: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingFeedback(false);
    }
  };

  const avgCalories = daySummaries.length > 0
    ? Math.round(daySummaries.reduce((s, d) => s + d.consumed, 0) / daySummaries.length)
    : 0;
  const totalBurnedPeriod = daySummaries.reduce((s, d) => s + d.burned, 0);
  const latestWeight = weightEntries[0];
  const bmi = latestWeight && userProfile?.height
    ? latestWeight.weight / Math.pow(userProfile.height / 100, 2)
    : null;
  const bmiLabel = bmi
    ? bmi < 18.5 ? t('bmiUnderweight') : bmi < 25 ? t('bmiNormal') : bmi < 30 ? t('bmiOverweight') : t('bmiObese')
    : null;
  const bmiColor = bmi
    ? bmi < 18.5 ? '#8D9BFF' : bmi < 25 ? '#FF6542' : bmi < 30 ? '#E8B84A' : '#FF6542'
    : '#CBD2DD';

  const statusLabels = {
    under: t('statusUnder'),
    slightUnder: t('statusSlightUnder'),
    onTarget: t('statusOnTarget'),
    slightOver: t('statusSlightOver'),
    over: t('statusOver'),
  };

  const CATS = [
    { key: 'sarapan', label: t('sarapan') },
    { key: 'tengahari', label: t('tengahari') },
    { key: 'malam', label: t('malam') },
    { key: 'snek', label: t('snek') },
  ];

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };
  const moveSelectedDay = (offset: number) => {
    if (!selectedDay) return;
    const date = new Date(parseDateKey(selectedDay));
    date.setDate(date.getDate() + offset);
    setSelectedDay(formatDateKey(date));
  };

  const calFoodDays = new Set(allFood.map(e => e.date));
  const calActDays = new Set(allActivities.map(e => e.date));
  const calWeightDays = new Set(weightEntries.map(e => e.date));
  const calGymDays = new Set(gymSessions.map(e => e.date));
  const bodyTimeline = [
    ...weightEntries.map((entry) => ({
      id: `weight-${entry.id}`, date: entry.date, time: parseDateKey(entry.date), icon: '⚖️',
      title: `${entry.weight.toFixed(1)} kg`, detail: entry.note || 'Weight check-in', image: undefined as string | undefined,
    })),
    ...mirrorPhotos.map((photo) => ({
      id: `photo-${photo.id}`, date: photo.displayDate || photo.id, time: parseMirrorDate(photo), icon: '📸',
      title: 'Mirror check-in', detail: [photo.weight ? `${photo.weight} kg` : '', photo.waist ? `${photo.waist} cm waist` : ''].filter(Boolean).join(' · ') || 'Progress photo', image: photo.base64,
    })),
    ...gymSessions.map((session) => ({
      id: `gym-${session.id}`, date: session.date, time: parseDateKey(session.date), icon: '🏋️',
      title: session.planDayLabel, detail: `${session.durationMin} min · ${session.exercises.length} exercises`, image: undefined as string | undefined,
    })),
  ].sort((a, b) => b.time - a.time).slice(0, 12);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('progressTitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Weight + Chart merged card */}
        <TouchableOpacity style={styles.weightCard} activeOpacity={0.85} onPress={() => setShowWeightListModal(true)}>
          <View style={styles.weightCardTop}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.weightValue}>
                  {latestWeight ? latestWeight.weight.toFixed(1) : '—'}
                </Text>
                <Text style={styles.weightUnit}>kg</Text>
              </View>
              <Text style={styles.weightDateSub}>
                {latestWeight ? displayDateFull(latestWeight.date, lang) : t('currentWeight')}
              </Text>
            </View>
            {bmi && (
              <View style={[styles.bmiPill, { borderColor: bmiColor }]}>
                <Text style={[styles.bmiPillValue, { color: bmiColor }]}>{bmi.toFixed(1)}</Text>
                <Text style={styles.bmiPillLabel}>BMI · {bmiLabel}</Text>
              </View>
            )}
          </View>
          {weightEntries.length >= 2 && <WeightAreaChart entries={weightEntries} />}
          <Text style={styles.chartTapHint}>{t('tapToSeeList')}</Text>
        </TouchableOpacity>

        {/* Mirror Photos */}
        <View style={styles.mirrorCard}>
          <View style={styles.mirrorHeader}>
            <Text style={styles.mirrorTitle}>{t('mirrorMonthlyTitle')}</Text>
            <TouchableOpacity style={styles.mirrorAddBtn} onPress={uploadMirrorPhoto} disabled={mirrorUploadLoading}>
              <Text style={styles.mirrorAddBtnText}>{mirrorUploadLoading ? '…' : '+'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.mirrorGalleryBtn} onPress={() => setShowMirrorGalleryModal(true)}>
            <Text style={styles.mirrorGalleryBtnText}>{t('mirrorGalleryBtnLabel').replace('%d', String(mirrorPhotos.length))}</Text>
          </TouchableOpacity>
          {mirrorPhotos.length >= 2 && (
            <Text style={styles.mirrorHint}>{t('mirrorAiHint')}</Text>
          )}
        </View>

        <View style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <View>
              <Text style={styles.timelineEyebrow}>BODY TIMELINE</Text>
              <Text style={styles.timelineTitle}>Your story, in one line.</Text>
            </View>
            <Text style={styles.timelineCount}>{bodyTimeline.length}</Text>
          </View>
          {bodyTimeline.length ? bodyTimeline.map((item, index) => (
            <View key={item.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={styles.timelineDot}><Text style={styles.timelineIcon}>{item.icon}</Text></View>
                {index < bodyTimeline.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineDate}>{displayDate(item.date)}</Text>
                <Text style={styles.timelineItemTitle}>{item.title}</Text>
                <Text style={styles.timelineDetail}>{item.detail}</Text>
              </View>
              {item.image && <Image source={{ uri: `data:image/jpeg;base64,${item.image}` }} style={styles.timelineImage} />}
            </View>
          )) : <Text style={styles.timelineEmpty}>Log weight, finish a workout or add a mirror photo to begin your timeline.</Text>}
        </View>

        {/* Period filter */}
        <View style={styles.periodRow}>
          {(['7', '30', 'all'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => handlePeriodChange(p)}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                {p === '7' ? t('sevenDays') : p === '30' ? t('thirtyDays') : t('all')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary stats */}
        {daySummaries.length > 0 && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{avgCalories}</Text>
              <Text style={styles.summaryLabel}>{t('avgKcalDay')}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#8D9BFF' }]}>{totalBurnedPeriod}</Text>
              <Text style={styles.summaryLabel}>{t('kcalBurnedLabel')}</Text>
            </View>
            {(() => {
              const s = getStatusInfo(avgCalories, goal, statusLabels);
              return (
                <View style={styles.summaryCard}>
                  <Text style={[styles.summaryValue, { color: s.color }]}>{s.icon}</Text>
                  <Text style={[styles.summaryLabel, { color: s.color, textAlign: 'center' }]}>{s.label}</Text>
                </View>
              );
            })()}
          </View>
        )}

        {/* AI Feedback button */}
        {daySummaries.length > 0 && (
          <TouchableOpacity style={styles.feedbackBtn} onPress={getAIFeedback}>
            <Text style={styles.feedbackBtnText}>{t('aiAnalysis')}</Text>
            <Text style={styles.feedbackBtnSub}>{t('aiAnalysisSub')}</Text>
          </TouchableOpacity>
        )}

        {/* Export buttons */}
        {(allFood.length > 0 || allActivities.length > 0 || weightEntries.length > 0) && (
          <View style={styles.exportRow}>
            <TouchableOpacity
              style={[styles.exportBtn, styles.exportPdfBtn]}
              onPress={exportPDF}
              disabled={exportLoading}
            >
              <Text style={styles.exportBtnText}>{exportLoading ? '...' : '⬇ PDF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, styles.exportCsvBtn]}
              onPress={exportCSV}
              disabled={exportLoading}
            >
              <Text style={[styles.exportBtnText, { color: '#FF6542' }]}>{exportLoading ? '...' : '⬇ CSV'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Calendar */}
        {allFood.length === 0 && allActivities.length === 0 && weightEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>{t('noDataYet')}</Text>
            <Text style={styles.emptySubText}>{t('logInToday')}</Text>
          </View>
        ) : (
          <View style={styles.calendarCard}>
            <View style={styles.calMonthRow}>
              <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
                <Text style={styles.calNavTxt}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calMonthTitle}>
                {(lang === 'en' ? MONTH_SHORT_EN : MONTH_SHORT_BM)[calMonth]} {calYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
                <Text style={styles.calNavTxt}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.calGrid}>
              {(lang === 'en'
                ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                : ['Ahd','Isn','Sel','Rab','Kha','Jum','Sab']
              ).map(d => (
                <View key={d} style={styles.calHeaderCell}>
                  <Text style={styles.calHeaderTxt}>{d}</Text>
                </View>
              ))}
              {(() => {
                const firstDay = new Date(calYear, calMonth, 1).getDay();
                const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                const cells: (number | null)[] = [
                  ...Array(firstDay).fill(null),
                  ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                ];
                while (cells.length % 7 !== 0) cells.push(null);
                const todayKey = formatDateKey(new Date());
                return cells.map((day, idx) => {
                  if (day === null) return <View key={idx} style={styles.calCell} />;
                  const dateKey = new Date(calYear, calMonth, day).toLocaleDateString('ms-MY');
                  const hasFood = calFoodDays.has(dateKey);
                  const hasAct = calActDays.has(dateKey);
                  const hasWeight = calWeightDays.has(dateKey);
                  const hasGym = calGymDays.has(dateKey);
                  const isToday = dateKey === todayKey;
                  const isSelected = selectedDay === dateKey;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.calCell, isSelected && styles.calCellSelected]}
                      onPress={() => setSelectedDay(dateKey)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.calDayNum, isToday && styles.calDayNumToday, isSelected && styles.calDayNumSelected]}>
                        {day}
                      </Text>
                      <View style={styles.calDots}>
                        {hasFood && <View style={[styles.calDot, { backgroundColor: '#FF6542' }]} />}
                        {hasAct && <View style={[styles.calDot, { backgroundColor: '#FF6542' }]} />}
                        {hasWeight && <View style={[styles.calDot, { backgroundColor: '#8FD6B4' }]} />}
                        {hasGym && <View style={[styles.calDot, { backgroundColor: '#8D9BFF' }]} />}
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
            <View style={styles.calLegend}>
              <View style={styles.calLegendItem}>
                <View style={[styles.calDot, { backgroundColor: '#FF6542' }]} />
                <Text style={styles.calLegendTxt}>{lang === 'en' ? 'Food' : 'Makanan'}</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calDot, { backgroundColor: '#FF6542' }]} />
                <Text style={styles.calLegendTxt}>{lang === 'en' ? 'Activity' : 'Aktiviti'}</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calDot, { backgroundColor: '#8FD6B4' }]} />
                <Text style={styles.calLegendTxt}>{lang === 'en' ? 'Weight' : 'Berat'}</Text>
              </View>
              <View style={styles.calLegendItem}>
                <View style={[styles.calDot, { backgroundColor: '#8D9BFF' }]} />
                <Text style={styles.calLegendTxt}>Gym</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Day Detail Modal */}
      {selectedDay !== null && (() => {
        const dayFood = allFood.filter((e) => e.date === selectedDay);
        const dayAct = allActivities.filter((e) => e.date === selectedDay);
        const dayGym = gymSessions.filter((s) => s.date === selectedDay);
        const eaten = dayFood.reduce((s, e) => s + e.calories, 0);
        const burned = dayAct.reduce((s, a) => s + a.caloriesBurned, 0);
        const net = eaten - burned;
        return (
          <Modal visible transparent animationType="slide">
            <View style={styles.centeredOverlay}>
              <View style={[styles.modalBox, { maxHeight: '85%', width: '92%' }]}>
                <View style={styles.journalHeader}>
                  <TouchableOpacity style={styles.journalNav} onPress={() => moveSelectedDay(-1)}><Text style={styles.journalNavText}>‹</Text></TouchableOpacity>
                  <View style={{ flex: 1 }}><Text style={styles.journalEyebrow}>DAILY JOURNAL</Text><Text style={[styles.modalTitle, styles.journalDateTitle]}>{displayDate(selectedDay, lang)}</Text></View>
                  <TouchableOpacity style={styles.journalNav} onPress={() => moveSelectedDay(1)}><Text style={styles.journalNavText}>›</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.journalClose} onPress={() => setSelectedDay(null)}><Text style={styles.journalCloseText}>×</Text></TouchableOpacity>
                </View>
                <View style={styles.dayKcalSummary}>
                  <View style={styles.dayKcalItem}>
                    <Text style={[styles.dayKcalVal, { color: '#FF6542' }]}>
                      {eaten}
                    </Text>
                    <Text style={styles.dayKcalLbl}>{lang === 'en' ? 'kcal eaten' : 'kcal dimakan'}</Text>
                  </View>
                  <View style={[styles.dayKcalItem, { borderLeftWidth: 1, borderLeftColor: '#26334A' }]}>
                    <Text style={[styles.dayKcalVal, { color: '#8D9BFF' }]}>
                      {burned}
                    </Text>
                    <Text style={styles.dayKcalLbl}>{lang === 'en' ? 'kcal burned' : 'kcal dibakar'}</Text>
                  </View>
                  <View style={[styles.dayKcalItem, { borderLeftWidth: 1, borderLeftColor: '#26334A' }]}>
                    <Text style={[styles.dayKcalVal, { color: net <= goal ? '#8FD6B4' : '#FF6542' }]}>{net}</Text>
                    <Text style={styles.dayKcalLbl}>net kcal</Text>
                  </View>
                </View>
                <ScrollView style={{ maxHeight: 440 }}>
                  {CATS.map(({ key, label }) => {
                    const entries = dayFood.filter((e) => e.category === key);
                    if (entries.length === 0) return null;
                    return (
                      <View key={key} style={styles.detailSection}>
                        <Text style={styles.detailCatLabel}>{label}</Text>
                        {entries.map((e) => (
                          <View key={e.id} style={styles.detailFoodRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.detailFoodName}>{e.name}</Text>
                              <Text style={styles.detailFoodTime}>{e.time}</Text>
                              {e.items.length > 0 && (
                                <Text style={styles.detailFoodMacros}>
                                  {t('macroLabel')
                                    .replace('%d', String(Math.round(e.items.reduce((s, i) => s + (i.protein || 0), 0))))
                                    .replace('%d', String(Math.round(e.items.reduce((s, i) => s + (i.karbohidrat || 0), 0))))
                                    .replace('%d', String(Math.round(e.items.reduce((s, i) => s + (i.lemak || 0), 0))))}
                                </Text>
                              )}
                              {e.items.map((item, itemIndex) => (
                                <View key={`${e.id}-${itemIndex}`} style={styles.ingredientRow}>
                                  <View style={styles.ingredientBullet} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.ingredientName}>{item.nama}</Text>
                                    <Text style={styles.ingredientMacros}>P {Math.round(item.protein || 0)}g · C {Math.round(item.karbohidrat || 0)}g · F {Math.round(item.lemak || 0)}g</Text>
                                  </View>
                                  <Text style={styles.ingredientKcal}>{Math.round(item.kalori || 0)} kcal</Text>
                                </View>
                              ))}
                            </View>
                            <Text style={styles.detailFoodKcal}>{e.calories} kcal</Text>
                            <TouchableOpacity
                              onPress={() => deleteEntry(e.id, 'food')}
                              style={styles.detailDeleteBtn}
                            >
                              <Text style={{ color: '#FF6542', fontSize: 14 }}>🗑️</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                  {dayAct.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailCatLabel}>{t('aktiviti')}</Text>
                      {dayAct.map((a) => (
                        <View key={a.id} style={styles.detailFoodRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.detailFoodName}>{a.name}</Text>
                            <Text style={styles.detailFoodTime}>{a.time} · {a.duration} min</Text>
                          </View>
                          <Text style={[styles.detailFoodKcal, { color: '#8D9BFF' }]}>-{a.caloriesBurned} kcal</Text>
                          <TouchableOpacity
                            onPress={() => deleteEntry(a.id, 'activity')}
                            style={styles.detailDeleteBtn}
                          >
                            <Text style={{ color: '#FF6542', fontSize: 14 }}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {dayGym.length > 0 && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailCatLabel}>💪 Gym</Text>
                      {dayGym.map((s) => (
                        <View key={s.id} style={styles.detailFoodRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.detailFoodName}>{s.planDayLabel}</Text>
                            <Text style={styles.detailFoodTime}>
                              {s.time} · {s.durationMin} {lang === 'en' ? 'min' : 'min'} · {s.exercises.length} {lang === 'en' ? 'exercises' : 'latihan'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => deleteGymSession(s)}
                            style={styles.detailDeleteBtn}
                          >
                            <Text style={{ color: '#FF6542', fontSize: 14 }}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {dayFood.length === 0 && dayAct.length === 0 && dayGym.length === 0 && (
                    <Text style={styles.detailEmpty}>{t('noRecordToday')}</Text>
                  )}
                </ScrollView>
                {(() => {
                  const totalP = Math.round(dayFood.reduce((s, e) => s + e.items.reduce((si, i) => si + (i.protein || 0), 0), 0));
                  const totalK = Math.round(dayFood.reduce((s, e) => s + e.items.reduce((si, i) => si + (i.karbohidrat || 0), 0), 0));
                  const totalL = Math.round(dayFood.reduce((s, e) => s + e.items.reduce((si, i) => si + (i.lemak || 0), 0), 0));
                  if (totalP + totalK + totalL === 0) return null;
                  return (
                    <View style={styles.macroProgressBox}>
                      <Text style={styles.macroSummaryLabel}>{t('macroTotal')}</Text>
                      {[
                        { label: lang === 'en' ? 'Protein' : 'Protein', value: totalP, target: Math.round(goal * 0.25 / 4), color: '#8D9BFF' },
                        { label: lang === 'en' ? 'Carbs' : 'Karbo', value: totalK, target: Math.round(goal * 0.45 / 4), color: '#E8B84A' },
                        { label: lang === 'en' ? 'Fat' : 'Lemak', value: totalL, target: Math.round(goal * 0.30 / 9), color: '#FF856B' },
                      ].map((macro) => (
                        <View key={macro.label} style={styles.journalMacroRow}>
                          <View style={styles.journalMacroLabels}><Text style={styles.journalMacroName}>{macro.label}</Text><Text style={styles.journalMacroValue}>{macro.value}g / {macro.target}g</Text></View>
                          <View style={styles.journalMacroTrack}><View style={[styles.journalMacroFill, { width: `${Math.min(100, macro.value / Math.max(macro.target, 1) * 100)}%`, backgroundColor: macro.color }]} /></View>
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* Weight List Modal */}
      <Modal visible={showWeightListModal} transparent animationType="slide">
        <View style={styles.centeredOverlay}>
          <View style={[styles.modalBox, { maxHeight: '75%', width: '92%' }]}>
            <Text style={styles.modalTitle}>{t('weightRecords')}</Text>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {weightEntries.map((w) => (
                <TouchableOpacity key={w.id} style={styles.weightHistoryRow} onLongPress={() => { setShowWeightListModal(false); setTimeout(() => deleteWeight(w.id), 300); }}>
                  <Text style={styles.weightHistoryDate}>{displayDateFull(w.date, lang)}</Text>
                  <Text style={styles.weightHistoryVal}>{w.weight} kg</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ color: '#33415C', fontSize: 11, textAlign: 'center', marginVertical: 8 }}>{t('longPressDelete')}</Text>
            <TouchableOpacity style={styles.modalSave} onPress={() => setShowWeightListModal(false)}>
              <Text style={styles.modalSaveText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Mirror Gallery Modal */}
      <Modal visible={showMirrorGalleryModal} transparent animationType="slide">
        <View style={styles.mirrorModalOverlay}>
          <View style={[styles.mirrorModalBox, { maxHeight: '85%', padding: 16, width: '94%' }]}>
            <Text style={styles.mirrorModalTitle}>{t('mirrorGalleryTitle')}</Text>
            {mirrorPhotos.length === 0 ? (
              <Text style={styles.mirrorEmpty}>{t('mirrorNoPhoto')}</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {mirrorPhotos.map((p) => (
                    <TouchableOpacity key={p.id} style={{ width: '47%' }} onPress={() => openMirrorDetail(p)}>
                      <Image
                        source={{ uri: `data:image/jpeg;base64,${p.base64}` }}
                        style={{ width: '100%', height: 180, borderRadius: 8 }}
                        resizeMode="cover"
                      />
                      <Text style={{ color: '#CBD2DD', fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                        {p.displayDate || p.id}
                      </Text>
                      {p.weight !== undefined && (
                        <Text style={{ color: '#FF6542', fontSize: 11, textAlign: 'center' }}>{p.weight} kg</Text>
                      )}
                      {p.waist !== undefined && (
                        <Text style={{ color: '#8D9BFF', fontSize: 11, textAlign: 'center' }}>{t('waistUnit')} {p.waist} cm</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
            <TouchableOpacity style={[styles.modalSave, { marginTop: 16 }]} onPress={() => setShowMirrorGalleryModal(false)}>
              <Text style={styles.modalSaveText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Mirror Photo Detail / Edit Modal */}
      <Modal visible={showMirrorDetailModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={[styles.modalBox, { width: '92%' }]}>
            {mirrorDetailPhoto && (<>
              <Image
                source={{ uri: `data:image/jpeg;base64,${mirrorDetailPhoto.base64}` }}
                style={{ width: '100%', height: 200, borderRadius: 10, marginBottom: 12 }}
                resizeMode="cover"
              />
              <Text style={styles.modalLabel}>{t('dateLabel')}</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowMirrorDetailDatePicker(true)}>
                <Text style={styles.pickerBtnText}>📅 {mirrorDetailDate || t('pickDate')}</Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>{t('weightKgLabel')}</Text>
              <TextInput
                style={styles.modalInput}
                value={mirrorDetailWeight}
                onChangeText={setMirrorDetailWeight}
                keyboardType="numeric"
                placeholder="cth: 85.5"
                placeholderTextColor="#7D8799"
              />
              <Text style={styles.modalLabel}>{t('waistCmLabel')}</Text>
              <TextInput
                style={styles.modalInput}
                value={mirrorDetailWaist}
                onChangeText={setMirrorDetailWaist}
                keyboardType="numeric"
                placeholder="cth: 90"
                placeholderTextColor="#7D8799"
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalCancel, { borderColor: '#FF6542' }]} onPress={() => {
                  const id = mirrorDetailPhoto.id;
                  setShowMirrorDetailModal(false);
                  deleteMirrorPhoto(id);
                }}>
                  <Text style={[styles.modalCancelText, { color: '#FF6542' }]}>{t('delete')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={saveMirrorDetail}>
                  <Text style={styles.modalSaveText}>{t('save')}</Text>
                </TouchableOpacity>
              </View>
            </>)}
          </View>
        </View>
      </Modal>

      {/* Log Weight Modal */}
      <Modal visible={showWeightModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('logWeightTitle')}</Text>
            <Text style={styles.modalLabel}>{t('weightKg')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newWeight}
              onChangeText={setNewWeight}
              keyboardType="numeric"
              placeholder="cth: 85.5"
              placeholderTextColor="#7D8799"
              autoFocus
            />
            <Text style={styles.modalLabel}>{t('dateOptional')}</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowWeightDatePicker(true)}>
              <Text style={styles.pickerBtnText}>📅 {formatDateKey(newWeightPickedDate)}</Text>
            </TouchableOpacity>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowWeightModal(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveWeight}>
                <Text style={styles.modalSaveText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Feedback Modal */}
      <Modal visible={showFeedback} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={[styles.modalBox, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>{t('aiAnalysisTitle')}</Text>
            {loadingFeedback ? (
              <View style={styles.feedbackLoading}>
                <ActivityIndicator size="large" color="#FF6542" />
                <Text style={styles.feedbackLoadingText}>{t('aiAnalysingData')}</Text>
              </View>
            ) : (
              <ScrollView style={styles.feedbackScroll}>
                <Text style={styles.feedbackContent}>{feedbackText}</Text>
              </ScrollView>
            )}
            {!loadingFeedback && (
              <TouchableOpacity style={styles.modalSave} onPress={() => setShowFeedback(false)}>
                <Text style={styles.modalSaveText}>{t('close')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
      {showWeightDatePicker && (
        <DateTimePicker
          value={newWeightPickedDate}
          mode="date"
          display="calendar"
          onChange={(_, date) => { setShowWeightDatePicker(false); if (date) setNewWeightPickedDate(date); }}
        />
      )}
      {showMirrorDetailDatePicker && (
        <DateTimePicker
          value={mirrorDetailDateObj}
          mode="date"
          display="calendar"
          onChange={(_, date) => {
            setShowMirrorDetailDatePicker(false);
            if (date) {
              setMirrorDetailDateObj(date);
              setMirrorDetailDate(formatDateKey(date));
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F0E1' },
  header: { backgroundColor: '#F7F0E1', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { color: '#101A2B', fontSize: 32, fontWeight: '800', fontFamily: 'serif', letterSpacing: -0.8 },
  scrollContent: { padding: 18, paddingBottom: 110 },

  fab: { position: 'absolute', bottom: 28, right: 24, width: 62, height: 62, borderRadius: 31, backgroundColor: '#FF6542', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#FF6542', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  fabText: { color: '#FFFDF7', fontSize: 34, lineHeight: 38 },

  weightCard: {
    backgroundColor: '#101A2B', borderRadius: 28, padding: 22, marginBottom: 16,
    borderWidth: 0, shadowColor: '#101A2B', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 5,
  },
  weightCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  weightLeft: { flex: 1 },
  weightValue: { color: '#FFFDF7', fontSize: 36, fontWeight: 'bold' },
  weightUnit: { color: '#AAB3C2', fontSize: 16, fontWeight: '400', marginBottom: 6 },
  weightDateSub: { color: '#657086', fontSize: 11, marginTop: 3 },
  weightLabel: { color: '#7D8799', fontSize: 11, marginTop: 2 },
  bmiText: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  bmiPill: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', minWidth: 72 },
  bmiPillValue: { fontSize: 20, fontWeight: 'bold' },
  bmiPillLabel: { color: '#7D8799', fontSize: 10, marginTop: 2 },
  logWeightBtn: { backgroundColor: '#FF6542', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  logWeightBtnText: { color: '#FFFDF7', fontWeight: 'bold', fontSize: 13 },

  weightHistory: { backgroundColor: '#FFFDF7', borderRadius: 22, marginBottom: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#E2D9C9' },
  weightHistoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#26334A' },
  weightHistoryDate: { color: '#737A84', fontSize: 13 },
  weightHistoryVal: { color: '#101A2B', fontSize: 14, fontWeight: '800' },
  weightMore: { color: '#657086', fontSize: 11, textAlign: 'center', padding: 8 },

  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodBtn: { flex: 1, paddingVertical: 11, borderRadius: 20, borderWidth: 1, borderColor: '#D8CEBE', backgroundColor: '#FFFDF7', alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#FF6542', borderColor: '#FF6542' },
  periodBtnText: { color: '#7D8799', fontSize: 13 },
  periodBtnTextActive: { color: '#FFFDF7', fontWeight: 'bold' },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#FFFDF7', borderRadius: 20, padding: 17, alignItems: 'center', borderWidth: 1, borderColor: '#E2D9C9' },
  summaryValue: { color: '#FF6542', fontSize: 20, fontWeight: 'bold' },
  summaryLabel: { color: '#7D8799', fontSize: 10, textAlign: 'center', marginTop: 4 },

  feedbackBtn: {
    backgroundColor: '#222F45', borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#495777', alignItems: 'center',
  },
  feedbackBtnText: { color: '#FF6542', fontSize: 15, fontWeight: 'bold' },
  feedbackBtnSub: { color: '#7D8799', fontSize: 11, marginTop: 4 },

  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#657086', fontSize: 16 },
  emptySubText: { color: '#33415C', fontSize: 13, marginTop: 4 },

  sectionTitle: { color: '#101A2B', fontSize: 12, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },

  dayCard: { backgroundColor: '#FFFDF7', borderRadius: 21, padding: 17, marginBottom: 11, borderWidth: 1, borderColor: '#E2D9C9' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayLabel: { color: '#101A2B', fontSize: 15, fontWeight: '800' },
  dayCalories: { fontSize: 18, fontWeight: 'bold' },
  dayBarBg: { height: 6, backgroundColor: '#26334A', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  dayBarFill: { height: 6, borderRadius: 3 },
  calendarCard: { backgroundColor: '#FFFDF7', borderRadius: 24, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 14, marginBottom: 18, borderWidth: 1, borderColor: '#E2D9C9', overflow: 'hidden' },
  calMonthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn: { padding: 8 },
  calNavTxt: { color: '#FF6542', fontSize: 24, fontWeight: '600', lineHeight: 26 },
  calMonthTitle: { color: '#101A2B', fontSize: 16, fontWeight: '900' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  calHeaderCell: { width: '14.285714%' as any, alignItems: 'center', justifyContent: 'center', height: 28 },
  calHeaderTxt: { color: '#68717E', fontSize: 9, fontWeight: '800' },
  calCell: { width: '14.285714%' as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  calCellSelected: { backgroundColor: '#101A2B', borderRadius: 13 },
  calDayNum: { color: '#263247', fontSize: 13, fontWeight: '600' },
  calDayNumToday: { color: '#FF6542', fontWeight: '800' },
  calDayNumSelected: { color: '#FFFDF7', fontWeight: '700' },
  calDots: { flexDirection: 'row', gap: 2, marginTop: 3, justifyContent: 'center' },
  calDot: { width: 5, height: 5, borderRadius: 3 },
  calLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 13, rowGap: 7, marginTop: 12, paddingTop: 10, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#E2D9C9' },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calLegendTxt: { color: '#8D97A8', fontSize: 11 },
  dayMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayMetaText: { color: '#7D8799', fontSize: 11 },
  dayBurned: { color: '#8D9BFF', fontSize: 11 },
  dayTapHint: { color: '#33415C', fontSize: 10, textAlign: 'right', marginTop: 6 },

  detailSection: { marginBottom: 14 },
  detailCatLabel: { color: '#C9472C', fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 7 },
  detailFoodRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E2D9C9' },
  detailFoodName: { color: '#101A2B', fontSize: 14, fontWeight: '900' },
  detailFoodTime: { color: '#59616D', fontSize: 11, marginTop: 3 },
  detailFoodKcal: { color: '#E8B84A', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
  detailDeleteBtn: { paddingLeft: 12, paddingVertical: 4 },
  detailEmpty: { color: '#657086', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  detailFoodMacros: { color: '#59616D', fontSize: 10, marginTop: 4, fontWeight: '700' },
  dayKcalSummary: { flexDirection: 'row', marginBottom: 14, borderRadius: 18, backgroundColor: '#101A2B', overflow: 'hidden' },
  dayKcalItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  dayKcalVal: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  dayKcalLbl: { color: '#7D8799', fontSize: 10, marginTop: 2 },
  macroSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, paddingHorizontal: 4 },
  macroSummaryLabel: { color: '#59616D', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 9 },
  macroChip: { fontSize: 12, fontWeight: '600' },
  journalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  journalEyebrow: { color: '#C9472C', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 3 },
  journalDateTitle: { marginBottom: 0, fontSize: 22 },
  journalNav: { width: 34, height: 38, borderRadius: 13, backgroundColor: '#F3EAD7', alignItems: 'center', justifyContent: 'center' },
  journalNavText: { color: '#101A2B', fontSize: 25, fontWeight: '700', lineHeight: 27 },
  journalClose: { width: 36, height: 36, borderRadius: 14, backgroundColor: '#101A2B', alignItems: 'center', justifyContent: 'center' },
  journalCloseText: { color: '#FFF4DB', fontSize: 24, lineHeight: 27 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#EEE6D8' },
  ingredientBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8FD6B4', marginRight: 8 },
  ingredientName: { color: '#263247', fontSize: 11, fontWeight: '800' },
  ingredientMacros: { color: '#697180', fontSize: 9, marginTop: 2 },
  ingredientKcal: { color: '#C9472C', fontSize: 10, fontWeight: '900', marginLeft: 8 },
  macroProgressBox: { marginTop: 13, padding: 13, backgroundColor: '#F3EAD7', borderRadius: 17 },
  journalMacroRow: { marginBottom: 9 },
  journalMacroLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  journalMacroName: { color: '#263247', fontSize: 10, fontWeight: '800' },
  journalMacroValue: { color: '#59616D', fontSize: 9, fontWeight: '700' },
  journalMacroTrack: { height: 6, backgroundColor: '#DCD3C1', borderRadius: 3, overflow: 'hidden' },
  journalMacroFill: { height: '100%', borderRadius: 3 },

  centeredOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#FFFDF7', borderRadius: 26, padding: 24, width: '88%' },
  modalTitle: { color: '#101A2B', fontSize: 25, fontFamily: 'serif', fontWeight: '800', marginBottom: 16 },
  modalLabel: { color: '#8D97A8', fontSize: 12, marginBottom: 6, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
  modalInput: { backgroundColor: '#26334A', color: '#FFFDF7', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 4 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#657086', alignItems: 'center' },
  modalCancelText: { color: '#AAB3C2' },
  modalSave: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#FF6542', alignItems: 'center' },
  modalSaveText: { color: '#FFFDF7', fontWeight: 'bold' },

  feedbackLoading: { alignItems: 'center', paddingVertical: 40 },
  feedbackLoadingText: { color: '#AAB3C2', marginTop: 12, fontSize: 13 },
  feedbackScroll: { maxHeight: 300, marginBottom: 16 },
  feedbackContent: { color: '#E9E2D3', fontSize: 14, lineHeight: 22 },

  pickerContainer: { backgroundColor: '#26334A', borderRadius: 10, marginBottom: 4, overflow: 'hidden' },
  pickerBtn: { backgroundColor: '#26334A', borderRadius: 10, padding: 14, marginBottom: 4 },
  pickerBtnText: { color: '#FF6542', fontSize: 15, fontWeight: '500' },

  chartTapHint: { color: '#33415C', fontSize: 9, textAlign: 'center', marginTop: 6 },


  mirrorCard: { backgroundColor: '#FFFDF7', borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E2D9C9' },
  mirrorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  mirrorTitle: { color: '#101A2B', fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
  mirrorAddBtn: { backgroundColor: '#26334A', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FF6542' },
  mirrorAddBtnText: { color: '#FF6542', fontSize: 18, lineHeight: 22 },
  mirrorEmpty: { color: '#657086', fontSize: 12, textAlign: 'center', paddingVertical: 12 },
  mirrorGalleryBtn: { backgroundColor: '#26334A', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#3a3a4a' },
  mirrorGalleryBtnText: { color: '#CBD2DD', fontSize: 14, fontWeight: '500' },
  mirrorHint: { color: '#3a5a3a', fontSize: 10, marginTop: 10, textAlign: 'center' },
  mirrorModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  mirrorModalBox: { backgroundColor: '#1C2940', borderRadius: 16, padding: 20, width: '90%', alignItems: 'center' },
  mirrorModalTitle: { color: '#FF6542', fontSize: 14, fontWeight: '600', marginBottom: 12 },

  exportRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  exportBtn: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center', borderWidth: 1 },
  exportPdfBtn: { backgroundColor: '#1a1a3a', borderColor: '#2a2a4a' },
  exportCsvBtn: { backgroundColor: '#222F45', borderColor: '#495777' },
  exportBtnText: { color: '#8D9BFF', fontWeight: '600', fontSize: 13 },
  timelineCard: { backgroundColor: '#101A2B', borderRadius: 26, padding: 18, marginBottom: 18 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  timelineEyebrow: { color: '#8FD6B4', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  timelineTitle: { color: '#FFF4DB', fontFamily: 'serif', fontSize: 22, fontWeight: '800', marginTop: 5 },
  timelineCount: { color: '#101A2B', backgroundColor: '#8FD6B4', minWidth: 32, height: 32, borderRadius: 12, textAlign: 'center', textAlignVertical: 'center', fontWeight: '900' },
  timelineRow: { flexDirection: 'row', minHeight: 72 },
  timelineRail: { width: 42, alignItems: 'center' },
  timelineDot: { width: 32, height: 32, borderRadius: 12, backgroundColor: '#26334A', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  timelineIcon: { fontSize: 15 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#33415C' },
  timelineContent: { flex: 1, paddingBottom: 15 },
  timelineDate: { color: '#8D9BFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  timelineItemTitle: { color: '#FFFDF7', fontSize: 14, fontWeight: '800', marginTop: 3 },
  timelineDetail: { color: '#8E9AAF', fontSize: 11, marginTop: 3 },
  timelineImage: { width: 48, height: 48, borderRadius: 14, marginLeft: 8 },
  timelineEmpty: { color: '#8E9AAF', fontSize: 12, lineHeight: 18, textAlign: 'center', paddingVertical: 15 },
});
