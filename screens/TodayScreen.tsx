import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Picker } from '@react-native-picker/picker';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  LayoutAnimation,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runLeanLogAi } from '../services/ai';
import { fsUpsert, fsDelete, fsSetSettings, fsFetchAll, fsFetchSettings } from '../firebase';
import { useLanguage } from '../context/LanguageContext';
import type { FoodEntry, FoodItem, ActivityEntry, MealCategory, UserProfile, ActivityLevel } from '../types';
import MacroRings from '../components/MacroRings';
import { refreshLeanLogWidget } from '../services/widget';

const WEIGHT_KEY = 'weight_entries';
const PROFILE_PHOTO_KEY = 'profile_photo';

const FOOD_KEY = 'calorie_entries';
const ACTIVITY_KEY = 'activity_entries';
const GOAL_KEY = 'calorie_goal';
const PROFILE_KEY = 'user_profile';
const DEFAULT_GOAL = 2000;

const ACTIVITY_MULTS: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725,
};

const calculateTDEE = (p: UserProfile): number => {
  const bmr = p.gender === 'lelaki'
    ? 10 * p.weight + 6.25 * p.height - 5 * p.age + 5
    : 10 * p.weight + 6.25 * p.height - 5 * p.age - 161;
  return Math.round(bmr * (ACTIVITY_MULTS[p.activityLevel] ?? 1.55));
};

const formatEntryDate = (d: Date) => d.toLocaleDateString('ms-MY');
const formatEntryTime = (d: Date) => d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });

const parseEntryDateTime = (dateStr: string, timeStr: string): Date => {
  const [day, month, year] = dateStr.split('/').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0);
};

export default function TodayScreen() {
  const { t } = useLanguage();

  const MEAL_CATEGORIES: { key: MealCategory; label: string; emoji: string; subtitle: string }[] = [
    { key: 'sarapan', label: t('sarapan'), emoji: '🌅', subtitle: t('sarapanSub') },
    { key: 'tengahari', label: t('tengahari'), emoji: '☀️', subtitle: t('tengahariSub') },
    { key: 'malam', label: t('malam'), emoji: '🌙', subtitle: t('malamSub') },
    { key: 'snek', label: t('snek'), emoji: '🍿', subtitle: t('snekSub') },
  ];

  const ACTIVITY_LEVELS: { key: ActivityLevel; label: string; sub: string; mult: number }[] = [
    { key: 'sedentary', label: t('sedentary'), sub: t('sedentarySub'), mult: 1.2 },
    { key: 'light', label: t('light'), sub: t('lightSub'), mult: 1.375 },
    { key: 'moderate', label: t('moderate'), sub: t('moderateSub'), mult: 1.55 },
    { key: 'active', label: t('active'), sub: t('activeSub'), mult: 1.725 },
  ];

  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [dataHydrated, setDataHydrated] = useState(false);
  const route = useRoute();
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [calorieGoal, setCalorieGoal] = useState(DEFAULT_GOAL);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pendingCategory, setPendingCategory] = useState<MealCategory>('snek');
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [profilePhotoBase64, setProfilePhotoBase64] = useState<string | null>(null);

  // Modal visibility
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [showMealMemory, setShowMealMemory] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FoodEntry | null>(null);
  const [showEntryOptions, setShowEntryOptions] = useState(false);
  const [showEditDateTime, setShowEditDateTime] = useState(false);
  const [optionsTarget, setOptionsTarget] = useState<{ id: string; type: 'food' | 'activity' } | null>(null);

  // Image detail modal (shown after picking image, before AI analysis)
  const [showImageDetailModal, setShowImageDetailModal] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [pendingImageBase64, setPendingImageBase64] = useState<string | null>(null);
  const [imageDetailNote, setImageDetailNote] = useState('');
  const [imageBackdateEnabled, setImageBackdateEnabled] = useState(false);
  const [imageBackdateDate, setImageBackdateDate] = useState(new Date());
  const [showImageBackdatePicker, setShowImageBackdatePicker] = useState(false);
  const [imageBackdatePickerMode, setImageBackdatePickerMode] = useState<'date' | 'time'>('date');

  // Backdate (shared between food text modal and activity modal)
  const [backdateEnabled, setBackdateEnabled] = useState(false);
  const [backdateDate, setBackdateDate] = useState(new Date());
  const [showBackdatePicker, setShowBackdatePicker] = useState(false);
  const [backdatePickerMode, setBackdatePickerMode] = useState<'date' | 'time'>('date');

  // Edit date/time
  const [editPickedDate, setEditPickedDate] = useState(new Date());
  const [showEditPicker, setShowEditPicker] = useState(false);
  const [editPickerMode, setEditPickerMode] = useState<'date' | 'time'>('date');

  // Form state
  const [goalInput, setGoalInput] = useState('');
  const [textFoodInput, setTextFoodInput] = useState('');
  const [activityName, setActivityName] = useState('');
  const [activityDuration, setActivityDuration] = useState('');
  const [profileWeight, setProfileWeight] = useState('70.0');
  const [profileHeight, setProfileHeight] = useState('170');
  const [profileAge, setProfileAge] = useState('25');
  const [profileGender, setProfileGender] = useState<'lelaki' | 'perempuan'>('lelaki');
  const [profileActivityLevel, setProfileActivityLevel] = useState<ActivityLevel>('moderate');

  // Activity via image
  const [showActivitySourcePicker, setShowActivitySourcePicker] = useState(false);
  const [pendingImageFor, setPendingImageFor] = useState<'food' | 'activity'>('food');
  const [showActivityConfirmModal, setShowActivityConfirmModal] = useState(false);
  const [pendingActivityKcal, setPendingActivityKcal] = useState('');
  const [pendingActivityDate, setPendingActivityDate] = useState<string | undefined>(undefined);
  const [pendingActivityTime, setPendingActivityTime] = useState<string | undefined>(undefined);

  // Log weight from FAB
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [newWeight, setNewWeight] = useState('70.0');
  const [newWeightDate, setNewWeightDate] = useState(new Date());
  const [showWeightDatePicker, setShowWeightDatePicker] = useState(false);
  const [vegServings, setVegServings] = useState(0);
  const [nutritionMode, setNutritionMode] = useState<'sss' | 'standard'>('sss');

  const progressAnim = useRef(new Animated.Value(0)).current;

  const today = new Date().toLocaleDateString('ms-MY');
  const todayFood = foodEntries.filter((e) => e.date === today);
  const todayActivities = activityEntries.filter((e) => e.date === today);
  const totalConsumed = todayFood.reduce((sum, e) => sum + e.calories, 0);
  const totalBurned = todayActivities.reduce((sum, e) => sum + e.caloriesBurned, 0);
  const progress = Math.min(totalConsumed / calorieGoal, 1);
  const remaining = calorieGoal - totalConsumed;
  const progressColor = progress >= 1 ? '#FF6542' : progress >= 0.8 ? '#E8B84A' : '#FF6542';

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = yesterdayDate.toLocaleDateString('ms-MY');
  const yesterdayFood = foodEntries.filter((e) => e.date === yesterdayKey);
  const yesterdayActs = activityEntries.filter((e) => e.date === yesterdayKey);
  const yesterdayConsumed = yesterdayFood.reduce((s, e) => s + e.calories, 0);
  const yesterdayBurned = yesterdayActs.reduce((s, e) => s + e.caloriesBurned, 0);
  const yesterdayNet = yesterdayConsumed - yesterdayBurned;
  const hasYesterday = yesterdayFood.length > 0 || yesterdayActs.length > 0;

  useFocusEffect(useCallback(() => { loadData(); }, []));
  useEffect(() => {
    if (dataHydrated) AsyncStorage.setItem(FOOD_KEY, JSON.stringify(foodEntries)).then(refreshLeanLogWidget);
  }, [foodEntries, dataHydrated]);
  useEffect(() => {
    if (dataHydrated) AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityEntries));
  }, [activityEntries, dataHydrated]);
  useEffect(() => {
    if (dataHydrated) AsyncStorage.setItem(GOAL_KEY, String(calorieGoal)).then(refreshLeanLogWidget);
  }, [calorieGoal, dataHydrated]);
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    fetch('https://api.github.com/repos/umarislah86-collab/leanlog/releases/latest')
      .then(r => r.json())
      .then(data => {
        const latest = (data.tag_name ?? '').replace('v', '');
        const current = Constants.expoConfig?.version ?? '';
        if (latest && latest !== current) {
          Alert.alert(
            '🔔 Update Tersedia',
            `Versi ${latest} dah keluar!\nAnda sedang guna versi ${current}.`,
            [
              { text: 'Nanti', style: 'cancel' },
              { text: 'Download', onPress: () => Linking.openURL(`https://github.com/umarislah86-collab/leanlog/releases/download/v${latest}/leanlog-V${latest}.apk`) },
            ]
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = route.params as { fabTrigger?: number } | undefined;
    if (params?.fabTrigger) setShowCategoryPicker(true);
  }, [(route.params as any)?.fabTrigger]);

  const loadData = async () => {
    const todayKey = `sss_veg_${new Date().toLocaleDateString('ms-MY')}`;
    const [savedFood, savedActivities, savedGoal, savedProfile, savedWeights, savedProfilePhoto, savedVeg, savedNutrMode] = await Promise.all([
      AsyncStorage.getItem(FOOD_KEY),
      AsyncStorage.getItem(ACTIVITY_KEY),
      AsyncStorage.getItem(GOAL_KEY),
      AsyncStorage.getItem(PROFILE_KEY),
      AsyncStorage.getItem(WEIGHT_KEY),
      AsyncStorage.getItem(PROFILE_PHOTO_KEY),
      AsyncStorage.getItem(todayKey),
      AsyncStorage.getItem('nutrition_mode'),
    ]);
    setVegServings(savedVeg ? parseInt(savedVeg) || 0 : 0);
    setNutritionMode(savedNutrMode === 'standard' ? 'standard' : 'sss');

    let food: FoodEntry[] = savedFood
      ? JSON.parse(savedFood).map((e: any) => ({ ...e, type: 'food', category: e.category ?? 'snek' }))
      : [];
    let activities: ActivityEntry[] = savedActivities ? JSON.parse(savedActivities) : [];

    if (food.length === 0) {
      const fsFood = await fsFetchAll<FoodEntry>('foodEntries');
      if (fsFood.length > 0) {
        food = fsFood.map((e) => ({ ...e, type: 'food', category: (e as any).category ?? 'snek' }));
        await AsyncStorage.setItem(FOOD_KEY, JSON.stringify(food));
      }
    }
    if (activities.length === 0) {
      const fsAct = await fsFetchAll<ActivityEntry>('activityEntries');
      if (fsAct.length > 0) {
        activities = fsAct;
        await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
      }
    }

    setFoodEntries(food);
    setActivityEntries(activities);

    if (savedWeights) {
      const weights = JSON.parse(savedWeights);
      if (weights.length > 0) {
        const sorted = [...weights].sort((a: any, b: any) => {
          const pa = a.date.split('/'), pb = b.date.split('/');
          return new Date(+pb[2], +pb[1]-1, +pb[0]).getTime() - new Date(+pa[2], +pa[1]-1, +pa[0]).getTime();
        });
        setLatestWeight(sorted[0].weight);
      }
    }
    if (savedProfilePhoto) setProfilePhotoBase64(savedProfilePhoto);

    if (savedGoal) setCalorieGoal(Number(savedGoal));
    if (savedProfile) {
      const p = JSON.parse(savedProfile);
      setUserProfile(p);
      setProfileWeight((Math.round(p.weight * 2) / 2).toFixed(1));
      setProfileHeight(String(Math.round(p.height)));
      setProfileAge(String(Math.round(p.age)));
      setProfileGender(p.gender);
      setProfileActivityLevel(p.activityLevel ?? 'moderate');
    }

    if (!savedGoal || !savedProfile) {
      const settings = await fsFetchSettings();
      if (settings?.goal && !savedGoal) {
        setCalorieGoal(settings.goal);
        await AsyncStorage.setItem(GOAL_KEY, String(settings.goal));
      }
      if (settings?.profile && !savedProfile) {
        const p = settings.profile;
        setUserProfile(p);
        setProfileWeight((Math.round(p.weight * 2) / 2).toFixed(1));
        setProfileHeight(String(Math.round(p.height)));
        setProfileAge(String(Math.round(p.age)));
        setProfileGender(p.gender);
        setProfileActivityLevel(p.activityLevel ?? 'moderate');
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      }
    }
    setDataHydrated(true);
  };

  const saveWeightFromFAB = async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) { Alert.alert(t('error'), t('invalidWeight')); return; }
    const dateKey = newWeightDate.toLocaleDateString('ms-MY');
    const entry = { id: Date.now().toString(), weight: w, date: dateKey };
    const raw = await AsyncStorage.getItem(WEIGHT_KEY);
    const existing: { id: string; weight: number; date: string }[] = raw ? JSON.parse(raw) : [];
    const updated = [entry, ...existing].sort((a, b) => {
      const pa = a.date.split('/'); const pb = b.date.split('/');
      return new Date(parseInt(pb[2]), parseInt(pb[1]) - 1, parseInt(pb[0])).getTime()
           - new Date(parseInt(pa[2]), parseInt(pa[1]) - 1, parseInt(pa[0])).getTime();
    });
    await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(updated));
    fsUpsert('weightEntries', entry.id, entry);
    setNewWeight('70.0');
    setNewWeightDate(new Date());
    setShowWeightModal(false);
  };

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t('permRequired'), t('permGalleryMsg')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled && result.assets[0]?.uri) {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (compressed.base64) {
        setProfilePhotoBase64(compressed.base64);
        await AsyncStorage.setItem(PROFILE_PHOTO_KEY, compressed.base64);
      }
    }
  };

  const handleCategorySelect = (cat: MealCategory | 'aktiviti') => {
    setShowCategoryPicker(false);
    if (cat === 'aktiviti') {
      setTimeout(() => setShowActivitySourcePicker(true), 300);
    } else {
      setPendingCategory(cat);
      setTimeout(() => setShowSourcePicker(true), 300);
    }
  };

  const handleSourceSelect = (src: 'camera' | 'gallery' | 'text') => {
    setShowSourcePicker(false);
    if (src === 'text') {
      setTextFoodInput('');
      setBackdateEnabled(false);
      setBackdateDate(new Date());
      setTimeout(() => setShowTextModal(true), 300);
    } else {
      setPendingImageFor('food');
      setTimeout(() => pickImage(src === 'camera'), 300);
    }
  };

  const handleActivitySourceSelect = (src: 'camera' | 'gallery' | 'text') => {
    setShowActivitySourcePicker(false);
    if (src === 'text') {
      setActivityName('');
      setActivityDuration('');
      setBackdateEnabled(false);
      setBackdateDate(new Date());
      setTimeout(() => setShowActivityModal(true), 300);
    } else {
      setPendingImageFor('activity');
      setTimeout(() => pickImage(src === 'camera'), 300);
    }
  };

  const pickImage = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t('permRequired'), t('permCameraMsg')); return; }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t('permRequired'), t('permGalleryMsg')); return; }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    }
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (compressed.base64) {
        setPendingImageUri(uri);
        setPendingImageBase64(compressed.base64);
        setImageDetailNote('');
        setImageBackdateEnabled(false);
        setImageBackdateDate(new Date());
        setTimeout(() => setShowImageDetailModal(true), 300);
      }
    }
  };

  const confirmImageAnalysis = async () => {
    if (!pendingImageUri || !pendingImageBase64) return;
    const entryDate = imageBackdateEnabled ? formatEntryDate(imageBackdateDate) : undefined;
    const entryTime = imageBackdateEnabled ? formatEntryTime(imageBackdateDate) : undefined;
    setShowImageDetailModal(false);
    if (pendingImageFor === 'activity') {
      await analyzeImageActivity(pendingImageBase64, imageDetailNote.trim(), entryDate, entryTime);
    } else {
      await analyzeImageFood(pendingImageUri, pendingImageBase64, pendingCategory, imageDetailNote.trim(), entryDate, entryTime);
    }
  };

  const analyzeImageFood = async (uri: string, base64: string, category: MealCategory, extraNote?: string, entryDate?: string, entryTime?: string) => {
    setLoadingMsg(t('aiAnalysing'));
    setLoading(true);
    try {
      const noteText = extraNote ? `\nMaklumat tambahan dari pengguna: "${extraNote}"` : '';
      const prompt = `Analisa SEMUA makanan dalam gambar ini dengan teliti.${noteText}
Balas dalam format JSON sahaja, tanpa teks lain:
{
  "nama": "nama keseluruhan hidangan",
  "kalori": 850,
  "items": [
    {"nama": "item 1", "kalori": 300, "protein": 10, "karbohidrat": 45, "lemak": 8}
  ]
}
Anggarkan kalori dan makro setiap item. Jumlah kalori items mesti sama dengan kalori keseluruhan.`;
      const output = await runLeanLogAi('food_image', [
          { type: 'image', mime_type: 'image/jpeg', data: base64 },
          { type: 'text', text: prompt },
        ]);
      const data = parseJSON(output);
      addFoodEntry({ name: data.nama, calories: data.kalori, imageUri: uri, items: data.items ?? [], category, entryDate, entryTime });
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const analyzeImageActivity = async (base64: string, extraNote?: string, entryDate?: string, entryTime?: string) => {
    setLoadingMsg(t('aiAnalysing'));
    setLoading(true);
    try {
      const weight = userProfile?.weight ?? 70;
      const noteText = extraNote ? `\nMaklumat tambahan: "${extraNote}"` : '';
      const prompt =
        `Gambar ini adalah screenshot rekod aktiviti/senaman dari aplikasi kesihatan. ` +
        `Keluarkan maklumat aktiviti dari gambar ini.${noteText} ` +
        `Berat pengguna: ${weight} kg. ` +
        `Balas JSON: {"nama": "nama aktiviti", "tempoh": 30, "kalori_dibakar": 250}`;
      const output = await runLeanLogAi('activity_image', [
          { type: 'image', mime_type: 'image/jpeg', data: base64 },
          { type: 'text', text: prompt },
        ]);
      const data = parseJSON(output);
      setActivityName(data.nama ?? '');
      setActivityDuration(String(data.tempoh ?? ''));
      setPendingActivityKcal(String(data.kalori_dibakar ?? ''));
      setPendingActivityDate(entryDate);
      setPendingActivityTime(entryTime);
      setShowActivityConfirmModal(true);
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const saveActivityFromImage = () => {
    const name = activityName.trim();
    const duration = parseInt(activityDuration);
    const kcal = parseInt(pendingActivityKcal);
    if (!name || isNaN(duration) || duration <= 0) { Alert.alert(t('error'), t('invalidActivity')); return; }
    setShowActivityConfirmModal(false);
    const entry: ActivityEntry = {
      type: 'activity',
      id: Date.now().toString(),
      name,
      duration,
      caloriesBurned: isNaN(kcal) ? 0 : kcal,
      time: pendingActivityTime ?? new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
      date: pendingActivityDate ?? today,
    };
    setActivityEntries((prev) => [entry, ...prev]);
    fsUpsert('activityEntries', entry.id, entry);
  };

  const analyzeTextFood = async () => {
    const desc = textFoodInput.trim();
    if (!desc) { Alert.alert(t('error'), t('invalidFood')); return; }
    const entryDate = backdateEnabled ? formatEntryDate(backdateDate) : undefined;
    const entryTime = backdateEnabled ? formatEntryTime(backdateDate) : undefined;
    setShowTextModal(false);
    setLoadingMsg(t('aiAnalysing'));
    setLoading(true);
    try {
      const prompt = `Saya makan: "${desc}"
Anggarkan kalori dan makro dalam format JSON sahaja:
{
  "nama": "nama hidangan ringkas",
  "kalori": 300,
  "items": [
    {"nama": "item 1", "kalori": 200, "protein": 15, "karbohidrat": 20, "lemak": 8}
  ]
}`;
      const output = await runLeanLogAi('food_text', [{ type: 'text', text: prompt }]);
      const data = parseJSON(output);
      addFoodEntry({ name: data.nama, calories: data.kalori, items: data.items ?? [], category: pendingCategory, entryDate, entryTime });
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const parseJSON = (text: string) => {
    const match = text.trim().match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Format response tidak betul');
    return JSON.parse(match[0]);
  };

  const addFoodEntry = (data: {
    name: string; calories: number; imageUri?: string; items: FoodItem[];
    category: MealCategory; entryDate?: string; entryTime?: string;
  }) => {
    const entry: FoodEntry = {
      type: 'food',
      id: Date.now().toString(),
      name: data.name,
      calories: data.calories,
      imageUri: data.imageUri,
      time: data.entryTime ?? new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
      date: data.entryDate ?? today,
      items: data.items,
      category: data.category,
    };
    setFoodEntries((prev) => [entry, ...prev]);
    fsUpsert('foodEntries', entry.id, entry);
  };

  const logActivity = async () => {
    const name = activityName.trim();
    const duration = parseInt(activityDuration);
    if (!name || isNaN(duration) || duration <= 0) { Alert.alert(t('error'), t('invalidActivity')); return; }
    const entryDate = backdateEnabled ? formatEntryDate(backdateDate) : undefined;
    const entryTime = backdateEnabled ? formatEntryTime(backdateDate) : undefined;
    setShowActivityModal(false);
    setLoadingMsg(t('aiAnalysing'));
    setLoading(true);
    try {
      const weight = userProfile?.weight ?? 70;
      const output = await runLeanLogAi('activity_estimate', [{ type: 'text', text: `Anggarkan kalori dibakar untuk aktiviti: ${name}, tempoh: ${duration} minit, berat: ${weight} kg.\nBalas JSON: {"kalori_dibakar": 200}` }]);
      const data = parseJSON(output);
      const entry: ActivityEntry = {
        type: 'activity', id: Date.now().toString(), name, duration,
        caloriesBurned: data.kalori_dibakar ?? 0,
        time: entryTime ?? new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
        date: entryDate ?? today,
      };
      setActivityEntries((prev) => [entry, ...prev]);
      fsUpsert('activityEntries', entry.id, entry);
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const saveGoal = () => {
    const val = parseInt(goalInput);
    if (isNaN(val) || val <= 0) { Alert.alert(t('inputError'), t('invalidGoal')); return; }
    setCalorieGoal(val);
    setShowGoalModal(false);
    fsSetSettings({ goal: val });
  };

  const saveProfile = () => {
    const weight = parseFloat(profileWeight);
    const height = parseFloat(profileHeight);
    const age = parseInt(profileAge);
    if (isNaN(weight) || isNaN(height) || isNaN(age)) { Alert.alert(t('error'), t('invalidProfile')); return; }
    const profile: UserProfile = { weight, height, age, gender: profileGender, activityLevel: profileActivityLevel };
    setUserProfile(profile);
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    fsSetSettings({ profile });
    setShowProfileModal(false);
    const tdee = calculateTDEE(profile);
    Alert.alert(
      t('tdeeCalcTitle'),
      t('tdeeCalcMsg').replace('%d', String(tdee)),
      [
        { text: t('no'), style: 'cancel' },
        { text: t('useAsGoal'), onPress: () => { setCalorieGoal(tdee); fsSetSettings({ goal: tdee }); } },
      ]
    );
  };

  const handleLongPress = (id: string, type: 'food' | 'activity') => {
    setOptionsTarget({ id, type });
    setShowEntryOptions(true);
  };

  const handleEditDateTimeOpen = () => {
    if (!optionsTarget) return;
    const entry = optionsTarget.type === 'food'
      ? foodEntries.find((e) => e.id === optionsTarget.id)
      : activityEntries.find((e) => e.id === optionsTarget.id);
    if (!entry) return;
    setEditPickedDate(parseEntryDateTime(entry.date, entry.time));
    setShowEntryOptions(false);
    setTimeout(() => setShowEditDateTime(true), 300);
  };

  const handleDeleteOption = () => {
    if (!optionsTarget) return;
    setShowEntryOptions(false);
    setTimeout(() => {
      Alert.alert(t('delete'), t('confirmDeleteEntry'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive', onPress: () => {
            if (optionsTarget.type === 'food') {
              setFoodEntries((p) => p.filter((e) => e.id !== optionsTarget.id));
              fsDelete('foodEntries', optionsTarget.id);
            } else {
              setActivityEntries((p) => p.filter((e) => e.id !== optionsTarget.id));
              fsDelete('activityEntries', optionsTarget.id);
            }
          },
        },
      ]);
    }, 300);
  };

  const saveEditDateTime = () => {
    if (!optionsTarget) return;
    const newDate = formatEntryDate(editPickedDate);
    const newTime = formatEntryTime(editPickedDate);
    if (optionsTarget.type === 'food') {
      const entry = foodEntries.find((e) => e.id === optionsTarget.id);
      if (entry) fsUpsert('foodEntries', optionsTarget.id, { ...entry, date: newDate, time: newTime });
      setFoodEntries((p) => p.map((e) => e.id === optionsTarget.id ? { ...e, date: newDate, time: newTime } : e));
    } else {
      const entry = activityEntries.find((e) => e.id === optionsTarget.id);
      if (entry) fsUpsert('activityEntries', optionsTarget.id, { ...entry, date: newDate, time: newTime });
      setActivityEntries((p) => p.map((e) => e.id === optionsTarget.id ? { ...e, date: newDate, time: newTime } : e));
    }
    setShowEditDateTime(false);
  };

  const totalMacro = (key: keyof FoodItem) =>
    todayFood.reduce((sum, e) => sum + e.items.reduce((s, i) => s + (Number(i[key]) || 0), 0), 0);

  const proteinGoal = Math.round(calorieGoal * 0.25 / 4);
  const carbsGoal   = Math.round(calorieGoal * 0.45 / 4);
  const fatGoal     = Math.round(calorieGoal * 0.30 / 9);

  const sssCarbsGoal   = Math.round(calorieGoal * 0.25 / 4);
  const sssProteinGoal = Math.round(calorieGoal * 0.25 / 4);
  const sssVegGoal     = 5;

  const changeVeg = async (delta: number) => {
    const next = Math.max(0, Math.min(sssVegGoal + 5, vegServings + delta));
    setVegServings(next);
    await AsyncStorage.setItem(`sss_veg_${today}`, String(next));
  };

  const saveQuickNote = async () => {
    const text = quickNoteText.trim();
    if (!text) return;
    const raw = await AsyncStorage.getItem('quick_notes');
    const existing = raw ? JSON.parse(raw) : [];
    const now = new Date();
    const next = [{ id: String(Date.now()), text, date: today, time: formatEntryTime(now) }, ...existing].slice(0, 100);
    await AsyncStorage.setItem('quick_notes', JSON.stringify(next));
    setQuickNoteText('');
    setShowQuickNoteModal(false);
  };

  const mealMemories = useMemo(() => {
    const map = new Map<string, FoodEntry & { count: number; lastUsed: number }>();
    foodEntries.forEach((entry, index) => {
      const key = `${entry.category}:${entry.name.trim().toLowerCase()}`;
      const current = map.get(key);
      if (current) current.count += 1;
      else map.set(key, { ...entry, count: 1, lastUsed: foodEntries.length - index });
    });
    return [...map.values()].sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed).slice(0, 12);
  }, [foodEntries]);

  const logMealFromMemory = (memory: FoodEntry) => {
    const now = new Date();
    const entry: FoodEntry = {
      ...memory,
      id: String(Date.now()),
      date: today,
      time: formatEntryTime(now),
      items: memory.items.map((item) => ({ ...item })),
    };
    setFoodEntries((previous) => [entry, ...previous]);
    fsUpsert('foodEntries', entry.id, entry).catch(() => {});
    setShowMealMemory(false);
    Alert.alert('Meal logged', `${entry.name} · ${entry.calories} kcal`);
  };

  const toggleSummary = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSummaryExpanded((value) => !value);
  };

  const hasEntries = todayFood.length > 0 || todayActivities.length > 0;
  const pendingCategoryLabel = MEAL_CATEGORIES.find((c) => c.key === pendingCategory)?.label ?? '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>{t('headerTitle')}</Text>
          <View style={styles.headerRight}>
            {latestWeight !== null && (
              <View style={styles.weightBadge}>
                <Text style={styles.weightBadgeText}>{latestWeight} kg</Text>
              </View>
            )}
            <TouchableOpacity style={styles.profilePhotoBtn} onPress={() => setShowProfileModal(true)}>
              {profilePhotoBase64
                ? <Image source={{ uri: `data:image/jpeg;base64,${profilePhotoBase64}` }} style={styles.profilePhotoImg} />
                : <View style={styles.profileDefaultAvatar}>
                    <View style={styles.profileSkeletonHead} />
                    <View style={styles.profileSkeletonBody} />
                  </View>
              }
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.statsSection}>
          <TouchableOpacity style={styles.compactTopRow} activeOpacity={0.82} onPress={toggleSummary}>
            <View>
              <Text style={styles.compactEyebrow}>TODAY'S FUEL</Text>
              <View style={styles.compactKcalRow}><Text style={styles.compactKcal}>{totalConsumed.toLocaleString()}</Text><Text style={styles.compactGoal}> / {calorieGoal.toLocaleString()} kcal</Text></View>
            </View>
            <View style={styles.compactRight}>
              <Text style={styles.compactToggle}>{summaryExpanded ? 'LESS  ↑' : 'DETAILS  ↓'}</Text>
              <Text style={styles.compactBurn}>−{totalBurned} burned</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.progressBg}>
            <Animated.View style={[styles.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              backgroundColor: progressColor,
            }]} />
          </View>
          <View style={styles.compactMetaRow}>
            <Text style={styles.compactRemaining}>{Math.abs(remaining).toLocaleString()} kcal {remaining < 0 ? 'over' : 'remaining'}</Text>
            <Text style={styles.compactMacros}>P {totalMacro('protein')}g  ·  C {totalMacro('karbohidrat')}g  ·  F {totalMacro('lemak')}g</Text>
          </View>
          {summaryExpanded && <>
          <View style={styles.expandedDivider} />
          <View style={styles.ringRow}>
            <View style={styles.ringStatCol}>
              <View style={styles.ringStatItem}>
                <Text style={[styles.ringStatVal, { color: progressColor }]}>{totalConsumed}</Text>
                <Text style={styles.ringStatLbl}>{t('kcalEaten')}</Text>
              </View>
              <View style={styles.ringStatItem}>
                <Text style={[styles.ringStatVal, { color: remaining < 0 ? '#FF6542' : '#CBD2DD' }]}>{Math.abs(remaining)}</Text>
                <Text style={styles.ringStatLbl}>{remaining < 0 ? t('over') : t('remaining')}</Text>
              </View>
            </View>
            <MacroRings
              compact
              protein={totalMacro('protein')}
              carbs={totalMacro('karbohidrat')}
              fat={totalMacro('lemak')}
              calorieGoal={calorieGoal}
              eatenCalories={totalConsumed}
            />
            <View style={styles.ringStatCol}>
              <View style={styles.ringStatItem}>
                <Text style={[styles.ringStatVal, { color: '#8D9BFF' }]}>{totalBurned}</Text>
                <Text style={styles.ringStatLbl}>{t('kcalBurned')}</Text>
              </View>
              <TouchableOpacity style={styles.ringStatItem} onPress={() => { setGoalInput(String(calorieGoal)); setShowGoalModal(true); }}>
                <Text style={styles.ringStatVal}>{calorieGoal}</Text>
                <Text style={[styles.ringStatLbl, { color: '#FF6542' }]}>{t('goalEdit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.progressLabel}>{Math.round(progress * 100)}{t('pctOfGoal')}</Text>
          <View style={styles.macrosRow}>
            <View style={styles.macroCell}>
              <Text style={[styles.macroVal, { color: '#8D9BFF' }]}>{totalMacro('protein')}g</Text>
              <Text style={styles.macroSub}>/ {proteinGoal}g</Text>
              <Text style={styles.macroLbl}>{t('protein')}</Text>
            </View>
            <View style={[styles.macroCell, styles.macroCellMid]}>
              <Text style={[styles.macroVal, { color: '#FF6542' }]}>{totalMacro('karbohidrat')}g</Text>
              <Text style={styles.macroSub}>/ {carbsGoal}g</Text>
              <Text style={styles.macroLbl}>{t('carbs')}</Text>
            </View>
            <View style={styles.macroCell}>
              <Text style={[styles.macroVal, { color: '#E8B84A' }]}>{totalMacro('lemak')}g</Text>
              <Text style={styles.macroSub}>/ {fatGoal}g</Text>
              <Text style={styles.macroLbl}>{t('fat')}</Text>
            </View>
          </View>
          </>}
        </View>
      </View>

      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#FF6542" />
          <Text style={styles.loadingText}>{loadingMsg}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Suku Suku Separuh Card */}
        {nutritionMode === 'sss' && (() => {
          const vegPct  = Math.min(1, vegServings / sssVegGoal);
          const carbPct = Math.min(1, totalMacro('karbohidrat') / sssCarbsGoal);
          const protPct = Math.min(1, totalMacro('protein') / sssProteinGoal);
          const tip =
            vegPct < 0.5  ? '💡 Tambah lebih sayur dan buah hari ini!' :
            protPct < 0.5 ? '💡 Jangan lupa protein — ikan, ayam, atau telur!' :
            carbPct > 1   ? '💡 Karbohidrat dah cukup, elak nasi/roti tambahan.' :
                            '✅ Amalan makan hari ini nampak seimbang!';
          const bar = (pct: number, color: string) => (
            <View style={styles.sssBarBg}>
              <View style={[styles.sssBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
            </View>
          );
          return (
            <View style={styles.sssCard}>
              <Text style={styles.sssTitle}>🥗 Suku Suku Separuh</Text>

              <View style={styles.sssRow}>
                <Text style={styles.sssLabel}>🥦 Sayur & Buah</Text>
                <View style={styles.sssCounter}>
                  <TouchableOpacity style={styles.sssCountBtn} onPress={() => changeVeg(-1)}>
                    <Text style={styles.sssCountBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.sssCountVal}>{vegServings}/{sssVegGoal} serving</Text>
                  <TouchableOpacity style={styles.sssCountBtn} onPress={() => changeVeg(1)}>
                    <Text style={styles.sssCountBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {bar(vegPct, '#FF856B')}

              <View style={[styles.sssRow, { marginTop: 10 }]}>
                <Text style={styles.sssLabel}>🍚 Karbohidrat</Text>
                <Text style={styles.sssMacroVal}>{totalMacro('karbohidrat')}g / {sssCarbsGoal}g</Text>
              </View>
              {bar(carbPct, '#FF6542')}

              <View style={[styles.sssRow, { marginTop: 10 }]}>
                <Text style={styles.sssLabel}>🍗 Protein</Text>
                <Text style={styles.sssMacroVal}>{totalMacro('protein')}g / {sssProteinGoal}g</Text>
              </View>
              {bar(protPct, '#8D9BFF')}

              <Text style={styles.sssTip}>{tip}</Text>
            </View>
          );
        })()}

        {hasYesterday && (
          <View style={styles.yesterdayCard}>
            <Text style={styles.yesterdayLabel}>{t('yesterday')}</Text>
            <Text style={styles.yesterdaySummary}>
              {yesterdayConsumed.toLocaleString()} kcal
              {yesterdayFood.length > 0 ? ` · ${yesterdayFood.length} ${t('foodRecords')}` : ''}
              {yesterdayActs.length > 0 ? ` · ${yesterdayActs.length} ${t('activities')}` : ''}
            </Text>
          </View>
        )}

        {!hasEntries ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyText}>{t('noRecordsToday')}</Text>
            <Text style={styles.emptySubText}>{t('tapToAdd')}</Text>
          </View>
        ) : (
          <>
            {MEAL_CATEGORIES.map((cat) => {
              const items = todayFood.filter((e) => e.category === cat.key);
              if (!items.length) return null;
              return (
                <View key={cat.key} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionEmoji}>{cat.emoji}</Text>
                    <Text style={styles.sectionTitle}>{cat.label}</Text>
                    <Text style={styles.sectionCal}>{items.reduce((s, e) => s + e.calories, 0)} kcal</Text>
                  </View>
                  {items.map((entry) => (
                    <TouchableOpacity key={entry.id} style={styles.entryCard}
                      onPress={() => setSelectedEntry(entry)}
                      onLongPress={() => handleLongPress(entry.id, 'food')}>
                      {entry.imageUri
                        ? <Image source={{ uri: entry.imageUri }} style={styles.foodImage} />
                        : <View style={styles.noImageBox}><Text style={{ fontSize: 24 }}>📝</Text></View>
                      }
                      <View style={styles.entryInfo}>
                        <Text style={styles.foodName}>{entry.name}</Text>
                        <Text style={styles.foodTime}>{entry.time} · {entry.items.length} item</Text>
                      </View>
                      <View style={styles.calorieBadge}>
                        <Text style={styles.foodCalories}>{entry.calories}</Text>
                        <Text style={styles.kcalLabel}>kcal</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
            {todayActivities.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEmoji}>🏃</Text>
                  <Text style={styles.sectionTitle}>{t('aktiviti')}</Text>
                  <Text style={[styles.sectionCal, { color: '#8D9BFF' }]}>-{totalBurned} kcal</Text>
                </View>
                {todayActivities.map((a) => (
                  <TouchableOpacity key={a.id} style={styles.activityCard} activeOpacity={0.8}
                    onLongPress={() => handleLongPress(a.id, 'activity')}>
                    <View style={styles.activityIconBox}><Text style={{ fontSize: 26 }}>💪</Text></View>
                    <View style={styles.entryInfo}>
                      <Text style={styles.foodName}>{a.name}</Text>
                      <Text style={styles.foodTime}>{a.time} · {a.duration} {t('min')}</Text>
                    </View>
                    <View style={styles.calorieBadge}>
                      <Text style={[styles.foodCalories, { color: '#8D9BFF' }]}>-{a.caloriesBurned}</Text>
                      <Text style={[styles.kcalLabel, { color: '#8D9BFF' }]}>kcal</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Category Picker ── */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowCategoryPicker(false)}>
          <View style={styles.categorySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('addRecord')}</Text>
            {MEAL_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat.key} style={styles.categoryRow} onPress={() => handleCategorySelect(cat.key)}>
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoryLabel}>{cat.label}</Text>
                  <Text style={styles.categorySubtitle}>{cat.subtitle}</Text>
                </View>
                <Text style={styles.categoryArrow}>›</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.categoryDivider} />
            <TouchableOpacity style={styles.categoryRow} onPress={() => handleCategorySelect('aktiviti')}>
              <Text style={styles.categoryEmoji}>🏃</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>{t('aktiviti')}</Text>
                <Text style={styles.categorySubtitle}>{t('aktivitiSub')}</Text>
              </View>
              <Text style={styles.categoryArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.categoryDivider} />
            <TouchableOpacity style={styles.categoryRow} onPress={() => {
              setShowCategoryPicker(false);
              setNewWeight('70.0'); setNewWeightDate(new Date());
              setTimeout(() => setShowWeightModal(true), 300);
            }}>
              <Text style={styles.categoryEmoji}>⚖️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>{t('logWeight')}</Text>
                <Text style={styles.categorySubtitle}>{t('weightKg')}</Text>
              </View>
              <Text style={styles.categoryArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.categoryDivider} />
            <TouchableOpacity style={styles.categoryRow} onPress={() => { setShowCategoryPicker(false); setTimeout(() => setShowQuickNoteModal(true), 250); }}>
              <Text style={styles.categoryEmoji}>✍️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>Quick Note</Text>
                <Text style={styles.categorySubtitle}>Capture a thought, symptom or reminder</Text>
              </View>
              <Text style={styles.categoryArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.categoryDivider} />
            <TouchableOpacity style={styles.categoryRow} onPress={() => { setShowCategoryPicker(false); setTimeout(() => setShowMealMemory(true), 250); }}>
              <Text style={styles.categoryEmoji}>🧠</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>Meal Memory</Text>
                <Text style={styles.categorySubtitle}>Log a frequent meal in one tap</Text>
              </View>
              <Text style={styles.categoryArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCategoryPicker(false)}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showQuickNoteModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Quick Note</Text>
            <Text style={styles.modalLabel}>WHAT'S ON YOUR MIND?</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 110, textAlignVertical: 'top' }]}
              multiline
              autoFocus
              value={quickNoteText}
              onChangeText={setQuickNoteText}
              placeholder="Energy low, craving sweets, remember meal prep…"
              placeholderTextColor="#8D97A8"
            />
            <Text style={styles.modalHint}>Saved locally and shown in your Daily Briefing.</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowQuickNoteModal(false)}><Text style={styles.modalCancelText}>{t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveQuickNote}><Text style={styles.modalSaveText}>Save note</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showMealMemory} transparent animationType="slide" onRequestClose={() => setShowMealMemory(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.categorySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>MEAL MEMORY</Text>
            <Text style={styles.memoryHeadline}>Your usuals, ready in one tap.</Text>
            <ScrollView style={styles.memoryList} showsVerticalScrollIndicator={false}>
              {mealMemories.length ? mealMemories.map((meal) => (
                <TouchableOpacity key={`${meal.category}-${meal.name}`} style={styles.memoryRow} onPress={() => logMealFromMemory(meal)}>
                  {meal.imageUri ? <Image source={{ uri: meal.imageUri }} style={styles.memoryImage} /> : <View style={styles.memoryFallback}><Text style={{ fontSize: 20 }}>🍽️</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memoryName}>{meal.name}</Text>
                    <Text style={styles.memoryMeta}>{meal.calories} kcal · logged {meal.count}×</Text>
                  </View>
                  <View style={styles.memoryAdd}><Text style={styles.memoryAddText}>＋</Text></View>
                </TouchableOpacity>
              )) : <View style={styles.memoryEmpty}><Text style={styles.memoryEmptyIcon}>🍜</Text><Text style={styles.memoryEmptyTitle}>No meal memories yet</Text><Text style={styles.memoryEmptyBody}>Meals you log will automatically appear here. Nothing extra to set up.</Text></View>}
            </ScrollView>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowMealMemory(false)}><Text style={styles.cancelBtnText}>{t('cancel')}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Source Picker ── */}
      <Modal visible={showSourcePicker} transparent animationType="slide">
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowSourcePicker(false)}>
          <View style={styles.categorySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{pendingCategoryLabel} — {t('chooseMethod')}</Text>
            <TouchableOpacity style={styles.categoryRow} onPress={() => handleSourceSelect('camera')}>
              <Text style={styles.categoryEmoji}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>{t('camera')}</Text>
                <Text style={styles.categorySubtitle}>{t('cameraSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryRow} onPress={() => handleSourceSelect('gallery')}>
              <Text style={styles.categoryEmoji}>🖼️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>{t('gallery')}</Text>
                <Text style={styles.categorySubtitle}>{t('gallerySub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryRow} onPress={() => handleSourceSelect('text')}>
              <Text style={styles.categoryEmoji}>⌨️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>{t('typeText')}</Text>
                <Text style={styles.categorySubtitle}>{t('typeTextSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSourcePicker(false)}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Activity Source Picker ── */}
      <Modal visible={showActivitySourcePicker} transparent animationType="slide">
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowActivitySourcePicker(false)}>
          <View style={styles.categorySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('activitySourceTitle')}</Text>
            <TouchableOpacity style={styles.categoryRow} onPress={() => handleActivitySourceSelect('camera')}>
              <Text style={styles.categoryEmoji}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>{t('camera')}</Text>
                <Text style={styles.categorySubtitle}>{t('activityViaImageSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryRow} onPress={() => handleActivitySourceSelect('gallery')}>
              <Text style={styles.categoryEmoji}>🖼️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>{t('gallery')}</Text>
                <Text style={styles.categorySubtitle}>{t('activityViaImageSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryRow} onPress={() => handleActivitySourceSelect('text')}>
              <Text style={styles.categoryEmoji}>⌨️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>{t('typeText')}</Text>
                <Text style={styles.categorySubtitle}>{t('typeTextSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowActivitySourcePicker(false)}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Text Food Modal ── */}
      <Modal visible={showTextModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('typeFoodTitle')}</Text>
            <Text style={styles.modalLabel}>{t('foodDescLabel')}</Text>
            <TextInput
              style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
              value={textFoodInput}
              onChangeText={setTextFoodInput}
              placeholder={t('foodDescPlaceholder')}
              placeholderTextColor="#7D8799"
              multiline
              autoFocus
            />
            <View style={styles.backdateRow}>
              <Text style={styles.backdateLabel}>{t('backdate')}</Text>
              <Switch
                value={backdateEnabled}
                onValueChange={(v) => { setBackdateEnabled(v); if (v) setBackdateDate(new Date()); }}
                trackColor={{ true: '#FF6542', false: '#33415C' }}
                thumbColor={backdateEnabled ? '#FFFDF7' : '#AAB3C2'}
              />
            </View>
            {backdateEnabled && (
              <View style={styles.backdateBtns}>
                <TouchableOpacity style={styles.backdateBtn} onPress={() => { setBackdatePickerMode('date'); setShowBackdatePicker(true); }}>
                  <Text style={styles.backdateBtnText}>📅 {formatEntryDate(backdateDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backdateBtn} onPress={() => { setBackdatePickerMode('time'); setShowBackdatePicker(true); }}>
                  <Text style={styles.backdateBtnText}>🕐 {formatEntryTime(backdateDate)}</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.modalHint}>{t('aiTip')}</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTextModal(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={analyzeTextFood}>
                <Text style={styles.modalSaveText}>{t('aiAnalyze')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Goal Modal ── */}
      <Modal visible={showGoalModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('setGoal')}</Text>
            <TextInput style={styles.modalInput} value={goalInput} onChangeText={setGoalInput} keyboardType="numeric" placeholder="2000" placeholderTextColor="#7D8799" autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowGoalModal(false)}><Text style={styles.modalCancelText}>{t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveGoal}><Text style={styles.modalSaveText}>{t('save')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Activity Modal ── */}
      <Modal visible={showActivityModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('logActivity')}</Text>
            <Text style={styles.modalLabel}>{t('activityName')}</Text>
            <TextInput style={styles.modalInput} value={activityName} onChangeText={setActivityName} placeholder={t('activityNamePh')} placeholderTextColor="#7D8799" autoFocus />
            <Text style={styles.modalLabel}>{t('duration')}</Text>
            <TextInput style={styles.modalInput} value={activityDuration} onChangeText={setActivityDuration} keyboardType="numeric" placeholder="30" placeholderTextColor="#7D8799" />
            <Text style={styles.modalHint}>{userProfile ? t('activityWeightHint').replace('%d', String(userProfile.weight)) : t('activityProfileTip')}</Text>
            <View style={styles.backdateRow}>
              <Text style={styles.backdateLabel}>{t('backdate')}</Text>
              <Switch
                value={backdateEnabled}
                onValueChange={(v) => { setBackdateEnabled(v); if (v) setBackdateDate(new Date()); }}
                trackColor={{ true: '#FF6542', false: '#33415C' }}
                thumbColor={backdateEnabled ? '#FFFDF7' : '#AAB3C2'}
              />
            </View>
            {backdateEnabled && (
              <View style={styles.backdateBtns}>
                <TouchableOpacity style={styles.backdateBtn} onPress={() => { setBackdatePickerMode('date'); setShowBackdatePicker(true); }}>
                  <Text style={styles.backdateBtnText}>📅 {formatEntryDate(backdateDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backdateBtn} onPress={() => { setBackdatePickerMode('time'); setShowBackdatePicker(true); }}>
                  <Text style={styles.backdateBtnText}>🕐 {formatEntryTime(backdateDate)}</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowActivityModal(false)}><Text style={styles.modalCancelText}>{t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={logActivity}><Text style={styles.modalSaveText}>{t('aiAnalyze')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Activity Confirm Modal (after image analysis) ── */}
      <Modal visible={showActivityConfirmModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('logActivity')}</Text>
            <Text style={styles.modalLabel}>{t('activityName')}</Text>
            <TextInput
              style={styles.modalInput}
              value={activityName}
              onChangeText={setActivityName}
              placeholder={t('activityNamePh')}
              placeholderTextColor="#7D8799"
            />
            <Text style={styles.modalLabel}>{t('duration')}</Text>
            <TextInput
              style={styles.modalInput}
              value={activityDuration}
              onChangeText={setActivityDuration}
              keyboardType="numeric"
              placeholder="30"
              placeholderTextColor="#7D8799"
            />
            <Text style={styles.modalLabel}>Kcal dibakar</Text>
            <TextInput
              style={styles.modalInput}
              value={pendingActivityKcal}
              onChangeText={setPendingActivityKcal}
              keyboardType="numeric"
              placeholder="250"
              placeholderTextColor="#7D8799"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowActivityConfirmModal(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveActivityFromImage}>
                <Text style={styles.modalSaveText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {showWeightDatePicker && (
        <DateTimePicker
          value={newWeightDate}
          mode="date"
          display="calendar"
          maximumDate={new Date()}
          onChange={(_, date) => {
            setShowWeightDatePicker(false);
            if (date) setNewWeightDate(date);
          }}
        />
      )}

      {/* ── Profile Modal ── */}
      <Modal visible={showProfileModal} transparent animationType="fade" onRequestClose={() => setShowProfileModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.modalBox, { width: '100%' }]}>
              <Text style={styles.modalTitle}>{t('userProfile')}</Text>
              <View style={styles.profilePhotoModalWrap}>
                {profilePhotoBase64
                  ? <Image source={{ uri: `data:image/jpeg;base64,${profilePhotoBase64}` }} style={styles.profilePhotoModal} />
                  : <View style={[styles.profilePhotoModal, styles.profileDefaultAvatarLg]}>
                      <View style={[styles.profileSkeletonHead, { width: 30, height: 30, borderRadius: 15, marginBottom: 2 }]} />
                      <View style={[styles.profileSkeletonBody, { width: 54, height: 26, borderRadius: 27 }]} />
                    </View>
                }
                <TouchableOpacity style={styles.profilePhotoChangeBtn} onPress={pickProfilePhoto}>
                  <Text style={styles.profilePhotoChangeBtnText}>{profilePhotoBase64 ? t('changePhoto') : t('addPhoto')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>{t('weight')}</Text>
              <TextInput
                style={styles.modalInput}
                value={profileWeight}
                onChangeText={setProfileWeight}
                keyboardType="numeric"
                placeholder="cth: 85.5"
                placeholderTextColor="#7D8799"
              />
              <Text style={styles.modalLabel}>{t('height')}</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={profileHeight} onValueChange={(v) => setProfileHeight(String(v))} style={{ color: '#FFFDF7', backgroundColor: '#26334A' }} dropdownIconColor="#FF6542">
                  {Array.from({ length: 151 }, (_, i) => { const h = String(100 + i); return <Picker.Item key={h} label={`${h} cm`} value={h} />; })}
                </Picker>
              </View>
              <Text style={styles.modalLabel}>{t('age')}</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={profileAge} onValueChange={(v) => setProfileAge(String(v))} style={{ color: '#FFFDF7', backgroundColor: '#26334A' }} dropdownIconColor="#FF6542">
                  {Array.from({ length: 100 }, (_, i) => { const a = String(1 + i); return <Picker.Item key={a} label={`${a} ${t('yearUnit')}`} value={a} />; })}
                </Picker>
              </View>
              <Text style={styles.modalLabel}>{t('gender')}</Text>
              <View style={styles.genderRow}>
                {(['lelaki', 'perempuan'] as const).map((g) => (
                  <TouchableOpacity key={g} style={[styles.genderBtn, profileGender === g && styles.genderBtnActive]} onPress={() => setProfileGender(g)}>
                    <Text style={[styles.genderText, profileGender === g && styles.genderTextActive]}>
                      {g === 'lelaki' ? t('male') : t('female')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.modalLabel}>{t('activityLevel')}</Text>
              {ACTIVITY_LEVELS.map((level) => (
                <TouchableOpacity key={level.key} style={[styles.activityLevelBtn, profileActivityLevel === level.key && styles.activityLevelBtnActive]} onPress={() => setProfileActivityLevel(level.key)}>
                  <Text style={[styles.activityLevelLabel, profileActivityLevel === level.key && styles.activityLevelLabelActive]}>{level.label}</Text>
                  <Text style={styles.activityLevelSub}>{level.sub}</Text>
                </TouchableOpacity>
              ))}
              {profileWeight && profileHeight && profileAge && (
                <View style={styles.tdeePreview}>
                  <Text style={styles.tdeePreviewText}>
                    {t('tdeeLabel')}: {calculateTDEE({ weight: parseFloat(profileWeight) || 0, height: parseFloat(profileHeight) || 0, age: parseInt(profileAge) || 0, gender: profileGender, activityLevel: profileActivityLevel })} {t('kcalPerDay')}
                  </Text>
                </View>
              )}
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowProfileModal(false)}><Text style={styles.modalCancelText}>{t('cancel')}</Text></TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={saveProfile}><Text style={styles.modalSaveText}>{t('save')}</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Entry Options Sheet ── */}
      <Modal visible={showEntryOptions} transparent animationType="slide">
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowEntryOptions(false)}>
          <View style={styles.categorySheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('options')}</Text>
            <TouchableOpacity style={styles.categoryRow} onPress={handleEditDateTimeOpen}>
              <Text style={styles.categoryEmoji}>✏️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>{t('editDateTime')}</Text>
                <Text style={styles.categorySubtitle}>{t('editDateTimeSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryRow} onPress={handleDeleteOption}>
              <Text style={styles.categoryEmoji}>🗑️</Text>
              <View style={{ flex: 1 }}><Text style={[styles.categoryLabel, { color: '#FF6542' }]}>{t('delete')}</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEntryOptions(false)}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit DateTime Modal ── */}
      <Modal visible={showEditDateTime} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('editDateTimeTitle')}</Text>
            <Text style={styles.modalLabel}>{t('dateFormat')}</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => { setEditPickerMode('date'); setShowEditPicker(true); }}>
              <Text style={styles.pickerBtnText}>📅 {formatEntryDate(editPickedDate)}</Text>
            </TouchableOpacity>
            <Text style={styles.modalLabel}>{t('timeFormat')}</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => { setEditPickerMode('time'); setShowEditPicker(true); }}>
              <Text style={styles.pickerBtnText}>🕐 {formatEntryTime(editPickedDate)}</Text>
            </TouchableOpacity>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditDateTime(false)}><Text style={styles.modalCancelText}>{t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveEditDateTime}><Text style={styles.modalSaveText}>{t('save')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Food Detail Modal ── */}
      <Modal visible={!!selectedEntry} transparent animationType="slide">
        <View style={styles.detailOverlay}>
          <View style={styles.detailBox}>
            {selectedEntry && (<>
              {selectedEntry.imageUri
                ? <Image source={{ uri: selectedEntry.imageUri }} style={styles.detailImage} />
                : <View style={[styles.detailImage, styles.noDetailImage]}><Text style={{ fontSize: 48 }}>📝</Text><Text style={{ color: '#7D8799', fontSize: 12, marginTop: 8 }}>{t('textInput')}</Text></View>
              }
              <ScrollView style={styles.detailScroll}>
                <Text style={styles.detailTitle}>{selectedEntry.name}</Text>
                <Text style={styles.detailTime}>{selectedEntry.date} · {selectedEntry.time}</Text>
                <View style={styles.detailTotalRow}>
                  <Text style={styles.detailTotal}>{selectedEntry.calories} kcal</Text>
                  <View style={styles.detailMacros}>
                    <Text style={styles.macroP}>P: {selectedEntry.items.reduce((s, i) => s + (i.protein || 0), 0)}g</Text>
                    <Text style={styles.macroK}>K: {selectedEntry.items.reduce((s, i) => s + (i.karbohidrat || 0), 0)}g</Text>
                    <Text style={styles.macroL}>L: {selectedEntry.items.reduce((s, i) => s + (i.lemak || 0), 0)}g</Text>
                  </View>
                </View>
                <Text style={styles.detailSectionTitle}>{t('itemBreakdown')}</Text>
                {selectedEntry.items.map((item, idx) => (
                  <View key={idx} style={styles.detailItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailItemName}>{item.nama}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 3 }}>
                        <Text style={styles.macroP}>P {item.protein}g</Text>
                        <Text style={styles.macroK}>K {item.karbohidrat}g</Text>
                        <Text style={styles.macroL}>L {item.lemak}g</Text>
                      </View>
                    </View>
                    <Text style={styles.detailItemCal}>{item.kalori} kcal</Text>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.detailClose} onPress={() => setSelectedEntry(null)}>
                <Text style={styles.detailCloseText}>{t('close')}</Text>
              </TouchableOpacity>
            </>)}
          </View>
        </View>
      </Modal>

      {/* ── Image Detail Modal ── */}
      <Modal visible={showImageDetailModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={[styles.modalBox, { width: '92%' }]}>
            <Text style={styles.modalTitle}>{t('confirmImageTitle')}</Text>
            {pendingImageUri && (
              <Image source={{ uri: pendingImageUri }} style={{ width: '100%', height: 170, borderRadius: 10, marginBottom: 12 }} resizeMode="cover" />
            )}
            <Text style={styles.modalLabel}>{t('imageExtraInfo')}</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              value={imageDetailNote}
              onChangeText={setImageDetailNote}
              placeholder={t('imageExtraPh')}
              placeholderTextColor="#7D8799"
              multiline
            />
            <Text style={styles.modalHint}>{t('imageAiHint')}</Text>
            <View style={styles.backdateRow}>
              <Text style={styles.backdateLabel}>{t('backdate')}</Text>
              <Switch
                value={imageBackdateEnabled}
                onValueChange={(v) => { setImageBackdateEnabled(v); if (v) setImageBackdateDate(new Date()); }}
                trackColor={{ true: '#FF6542', false: '#33415C' }}
                thumbColor={imageBackdateEnabled ? '#FFFDF7' : '#AAB3C2'}
              />
            </View>
            {imageBackdateEnabled && (
              <View style={styles.backdateBtns}>
                <TouchableOpacity style={styles.backdateBtn} onPress={() => { setImageBackdatePickerMode('date'); setShowImageBackdatePicker(true); }}>
                  <Text style={styles.backdateBtnText}>📅 {formatEntryDate(imageBackdateDate)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backdateBtn} onPress={() => { setImageBackdatePickerMode('time'); setShowImageBackdatePicker(true); }}>
                  <Text style={styles.backdateBtnText}>🕐 {formatEntryTime(imageBackdateDate)}</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowImageDetailModal(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={confirmImageAnalysis}>
                <Text style={styles.modalSaveText}>{t('analyzeBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Native date/time pickers (rendered outside modals so they overlay correctly) ── */}
      {showImageBackdatePicker && (
        <DateTimePicker
          value={imageBackdateDate}
          mode={imageBackdatePickerMode}
          display={imageBackdatePickerMode === 'date' ? 'calendar' : 'spinner'}
          onChange={(_, date) => { setShowImageBackdatePicker(false); if (date) setImageBackdateDate(date); }}
        />
      )}
      {showBackdatePicker && (
        <DateTimePicker
          value={backdateDate}
          mode={backdatePickerMode}
          display={backdatePickerMode === 'date' ? 'calendar' : 'spinner'}
          onChange={(_, date) => {
            setShowBackdatePicker(false);
            if (date) setBackdateDate(date);
          }}
        />
      )}
      {showEditPicker && (
        <DateTimePicker
          value={editPickedDate}
          mode={editPickerMode}
          display={editPickerMode === 'date' ? 'calendar' : 'spinner'}
          onChange={(_, date) => {
            setShowEditPicker(false);
            if (date) setEditPickedDate(date);
          }}
        />
      )}

      {/* ── Log Weight Modal (from FAB) ── */}
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
              placeholder="cth: 72.5"
              placeholderTextColor="#7D8799"
            />
            <Text style={styles.modalLabel}>DATE</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowWeightDatePicker(true)}>
              <Text style={styles.pickerBtnText}>📅 {newWeightDate.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              <Text style={styles.pickerBtnHint}>Tap to backdate</Text>
            </TouchableOpacity>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowWeightModal(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveWeightFromFAB}>
                <Text style={styles.modalSaveText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F0E1' },
  header: { backgroundColor: '#F7F0E1', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 0 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerTitle: { color: '#101A2B', fontSize: 31, fontWeight: '800', fontFamily: 'serif', letterSpacing: -0.8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weightBadge: { backgroundColor: '#FFFDF7', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#DED5C5' },
  weightBadgeText: { color: '#101A2B', fontSize: 12, fontWeight: '700' },
  profilePhotoBtn: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#2a3a5a' },
  profilePhotoImg: { width: 36, height: 36, borderRadius: 18 },
  profileDefaultAvatar: { width: 36, height: 36, backgroundColor: '#2a3a5a', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  profileSkeletonHead: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#6a8abf' },
  profileSkeletonBody: { width: 24, height: 12, borderRadius: 12, backgroundColor: '#6a8abf', marginTop: 2 },
  profileDefaultAvatarLg: { backgroundColor: '#2a3a5a', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8, overflow: 'hidden' },
  profileAddBtn: { backgroundColor: '#26334A', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FF6542' },
  profileAddBtnText: { color: '#FF6542', fontSize: 18, lineHeight: 22 },
  profilePhotoModalWrap: { alignItems: 'center', marginBottom: 12 },
  profilePhotoModal: { width: 80, height: 80, borderRadius: 40, marginBottom: 8, borderWidth: 2, borderColor: '#FF6542' },
  profilePhotoChangeBtn: { backgroundColor: '#26334A', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  profilePhotoChangeBtnText: { color: '#AAB3C2', fontSize: 12 },
  statsSection: { backgroundColor: '#101A2B', borderRadius: 24, paddingHorizontal: 17, paddingTop: 15, paddingBottom: 14, marginTop: 10, marginBottom: 10, shadowColor: '#101A2B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 5 },
  compactTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  compactEyebrow: { color: '#8FD6B4', fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  compactKcalRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  compactKcal: { color: '#FFF4DB', fontFamily: 'serif', fontSize: 28, fontWeight: '900' },
  compactGoal: { color: '#AAB5C7', fontSize: 11, fontWeight: '700' },
  compactRight: { alignItems: 'flex-end' },
  compactToggle: { color: '#FF856B', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  compactBurn: { color: '#8D9BFF', fontSize: 10, fontWeight: '800', marginTop: 9 },
  compactMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 },
  compactRemaining: { color: '#FFFDF7', fontSize: 10, fontWeight: '800' },
  compactMacros: { color: '#CDD4E0', fontSize: 9, fontWeight: '700' },
  expandedDivider: { height: 1, backgroundColor: '#26334A', marginTop: 16, marginBottom: 12 },
  ringRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  ringStatCol: { flex: 1, gap: 14, alignItems: 'center' },
  ringStatItem: { alignItems: 'center' },
  ringStatVal: { color: '#FFFDF7', fontSize: 17, fontWeight: '700', lineHeight: 21 },
  ringStatLbl: { color: '#7D8799', fontSize: 9, marginTop: 2 },
  progressBg: { width: '100%', height: 6, backgroundColor: '#26334A', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { color: '#7D8799', fontSize: 11, marginBottom: 10, textAlign: 'center' },
  macrosRow: { flexDirection: 'row', width: '100%', borderTopWidth: 1, borderTopColor: '#26334A', paddingTop: 10 },
  macroCell: { flex: 1, alignItems: 'center' },
  macroCellMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#26334A' },
  macroVal: { fontSize: 14, fontWeight: '700' },
  macroSub: { color: '#657086', fontSize: 10, marginTop: 1 },
  macroLbl: { color: '#7D8799', fontSize: 9, marginTop: 2 },
  loadingBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFDF7', paddingHorizontal: 20, paddingVertical: 10 },
  loadingText: { color: '#566070', fontSize: 13 },
  scrollContent: { padding: 18, paddingTop: 12, paddingBottom: 120 },
  yesterdayCard: {
    backgroundColor: '#FFFDF7', borderRadius: 20, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E2D9C9', flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  yesterdayLabel: { color: '#FF6542', fontSize: 11, fontWeight: '600', letterSpacing: 1, minWidth: 60 },
  yesterdaySummary: { color: '#566070', fontSize: 12, flex: 1 },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#657086', fontSize: 16 },
  emptySubText: { color: '#33415C', fontSize: 13, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 },
  sectionEmoji: { fontSize: 16, marginRight: 8 },
  sectionTitle: { flex: 1, color: '#101A2B', fontSize: 13, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionCal: { color: '#5E6672', fontSize: 12, fontWeight: '700' },
  entryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFDF7', borderRadius: 20, marginBottom: 11, overflow: 'hidden', borderWidth: 1, borderColor: '#E2D9C9', shadowColor: '#101A2B', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 9, elevation: 2 },
  foodImage: { width: 68, height: 68 },
  noImageBox: { width: 68, height: 68, backgroundColor: '#EFE6D6', alignItems: 'center', justifyContent: 'center' },
  entryInfo: { flex: 1, paddingHorizontal: 12 },
  foodName: { color: '#101A2B', fontSize: 14, fontWeight: '800' },
  foodTime: { color: '#737A84', fontSize: 11, marginTop: 3 },
  calorieBadge: { alignItems: 'center', paddingRight: 14 },
  foodCalories: { color: '#FF6542', fontSize: 18, fontWeight: 'bold' },
  kcalLabel: { color: '#FF6542', fontSize: 9 },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8E8FF', borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: '#D4D3F4', paddingVertical: 10 },
  activityIconBox: { width: 68, alignItems: 'center', justifyContent: 'center' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  categorySheet: { backgroundColor: '#FFFDF7', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 30 },
  sheetHandle: { width: 36, height: 4, backgroundColor: '#3a3a4a', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetTitle: { color: '#101A2B', fontSize: 12, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 16, textTransform: 'uppercase' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14 },
  categoryEmoji: { fontSize: 24, width: 44 },
  categoryLabel: { color: '#101A2B', fontSize: 16, fontWeight: '800' },
  categorySubtitle: { color: '#737A84', fontSize: 12, marginTop: 2 },
  categoryArrow: { color: '#657086', fontSize: 22 },
  categoryDivider: { height: 1, backgroundColor: '#E2D9C9', marginHorizontal: 20, marginVertical: 4 },
  cancelBtn: { marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#33415C', alignItems: 'center' },
  cancelBtnText: { color: '#8D97A8', fontSize: 15 },
  centeredOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#FFFDF7', borderRadius: 26, padding: 24, width: '88%' },
  modalTitle: { color: '#101A2B', fontSize: 25, fontFamily: 'serif', fontWeight: '800', marginBottom: 16 },
  modalLabel: { color: '#8D97A8', fontSize: 12, marginBottom: 6, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
  modalInput: { backgroundColor: '#26334A', color: '#FFFDF7', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 4 },
  modalHint: { color: '#7D8799', fontSize: 12, marginTop: 8 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#657086', alignItems: 'center' },
  modalCancelText: { color: '#AAB3C2' },
  modalSave: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#FF6542', alignItems: 'center' },
  modalSaveText: { color: '#FFFDF7', fontWeight: 'bold' },
  backdateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4 },
  backdateLabel: { color: '#AAB3C2', fontSize: 13 },
  backdateBtns: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 4 },
  backdateBtn: { flex: 1, backgroundColor: '#26334A', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#3a3a4a' },
  backdateBtnText: { color: '#FF6542', fontSize: 13, fontWeight: '500' },
  pickerBtn: { backgroundColor: '#26334A', borderRadius: 10, padding: 14, marginBottom: 4, borderWidth: 1, borderColor: '#3a3a4a' },
  pickerBtnText: { color: '#FF6542', fontSize: 15, fontWeight: '500' },
  pickerBtnHint: { color: '#8D97A8', fontSize: 9, marginTop: 3 },
  pickerContainer: { backgroundColor: '#26334A', borderRadius: 10, marginBottom: 4, overflow: 'hidden' },
  genderRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  genderBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#33415C', alignItems: 'center' },
  genderBtnActive: { borderColor: '#FF6542', backgroundColor: '#29364D' },
  genderText: { color: '#8D97A8', fontSize: 14 },
  genderTextActive: { color: '#FF6542', fontWeight: 'bold' },
  activityLevelBtn: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#33415C', marginTop: 6 },
  activityLevelBtnActive: { borderColor: '#FF6542', backgroundColor: '#29364D' },
  activityLevelLabel: { color: '#AAB3C2', fontSize: 14, fontWeight: '500' },
  activityLevelLabelActive: { color: '#FF6542', fontWeight: 'bold' },
  activityLevelSub: { color: '#657086', fontSize: 11, marginTop: 2 },
  tdeePreview: { marginTop: 14, backgroundColor: '#0d1a0d', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#495777' },
  tdeePreviewText: { color: '#FF6542', fontSize: 13, textAlign: 'center' },
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  detailBox: { backgroundColor: '#172338', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  detailImage: { width: '100%', height: 200, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  noDetailImage: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#26334A' },
  detailScroll: { padding: 20 },
  detailTitle: { color: '#FFF4DB', fontSize: 25, fontFamily: 'serif', fontWeight: '800', marginBottom: 4 },
  detailTime: { color: '#7D8799', fontSize: 12, marginBottom: 16 },
  detailTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0D0D1A', borderRadius: 12, padding: 14, marginBottom: 20 },
  detailTotal: { color: '#FF6542', fontSize: 28, fontWeight: 'bold' },
  detailMacros: { gap: 4, alignItems: 'flex-end' },
  detailSectionTitle: { color: '#7D8799', fontSize: 11, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  detailItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#26334A' },
  detailItemName: { color: '#FFFDF7', fontSize: 14, fontWeight: '500' },
  detailItemCal: { color: '#FF6542', fontSize: 15, fontWeight: 'bold' },
  macroP: { color: '#8D9BFF', fontSize: 12 },
  macroK: { color: '#FFB74D', fontSize: 12 },
  macroL: { color: '#EF9A9A', fontSize: 12 },
  detailClose: { margin: 20, padding: 14, backgroundColor: '#FF6542', borderRadius: 12, alignItems: 'center' },
  detailCloseText: { color: '#FFFDF7', fontWeight: 'bold', fontSize: 16 },

  sssCard: { backgroundColor: '#FFFDF7', borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#E2D9C9' },
  sssTitle: { color: '#101A2B', fontSize: 17, fontWeight: '900', marginBottom: 14 },
  sssRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sssLabel: { color: '#263247', fontSize: 13, fontWeight: '700' },
  sssCounter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sssCountBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#26334A', alignItems: 'center', justifyContent: 'center' },
  sssCountBtnTxt: { color: '#FFFDF7', fontSize: 18, lineHeight: 22 },
  sssCountVal: { color: '#101A2B', fontSize: 13, minWidth: 80, textAlign: 'center' },
  sssMacroVal: { color: '#566070', fontSize: 12 },
  sssBarBg: { height: 6, backgroundColor: '#26334A', borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  sssBarFill: { height: 6, borderRadius: 3 },
  sssTip: { color: '#AAB3C2', fontSize: 12, marginTop: 14, fontStyle: 'italic' },
  memoryHeadline: { color: '#101A2B', fontFamily: 'serif', fontSize: 23, fontWeight: '800', paddingHorizontal: 22, marginBottom: 12 },
  memoryList: { maxHeight: 440, paddingHorizontal: 18 },
  memoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F7F0E1', borderRadius: 18, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E2D9C9' },
  memoryImage: { width: 52, height: 52, borderRadius: 15 },
  memoryFallback: { width: 52, height: 52, borderRadius: 15, backgroundColor: '#FFE6DC', alignItems: 'center', justifyContent: 'center' },
  memoryName: { color: '#101A2B', fontSize: 14, fontWeight: '900' },
  memoryMeta: { color: '#737A84', fontSize: 10, marginTop: 4 },
  memoryAdd: { width: 34, height: 34, borderRadius: 13, backgroundColor: '#8FD6B4', alignItems: 'center', justifyContent: 'center' },
  memoryAddText: { color: '#101A2B', fontSize: 20, fontWeight: '800', lineHeight: 23 },
  memoryEmpty: { alignItems: 'center', paddingVertical: 35, paddingHorizontal: 20 },
  memoryEmptyIcon: { fontSize: 35 },
  memoryEmptyTitle: { color: '#101A2B', fontFamily: 'serif', fontSize: 21, fontWeight: '800', marginTop: 10 },
  memoryEmptyBody: { color: '#737A84', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
});
