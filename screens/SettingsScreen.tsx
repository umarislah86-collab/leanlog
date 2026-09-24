import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, signOut, fsUpsert, fsSetSettings, fsFetchAll, fsFetchSettings } from '../firebase';

let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch {}
import { useLanguage } from '../context/LanguageContext';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import type { UserProfile } from '../types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { requestPinWidget } from 'react-native-android-widget';
import { refreshLeanLogWidget } from '../services/widget';
import { getNagDays, getNagTimes, isNagModeEnabled, setNagDays, setNagModeEnabled, setNagTimes } from '../services/nagging';

const formatPickerTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const timeStrToDate = (timeStr: string): Date => {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

const REMINDER_KEY = 'reminders';

interface Reminder {
  id: string;
  name: string;
  time: string;
  notifId: string;
  enabled: boolean;
}

async function scheduleNotif(name: string, time: string): Promise<string> {
  const parts = time.split(':');
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Daily Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return Notifications.scheduleNotificationAsync({
    content: { title: '🏃 CalorieTracker', body: name, sound: true },
    trigger: { type: 'daily', hour, minute, channelId: 'reminders' } as any,
  });
}

async function cancelNotif(notifId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {}
}

export default function SettingsScreen() {
  const { lang, setLang, t } = useLanguage();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [reminderName, setReminderName] = useState('');
  const [reminderPickedTime, setReminderPickedTime] = useState(new Date());
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showEditReminderModal, setShowEditReminderModal] = useState(false);
  const [editReminderName, setEditReminderName] = useState('');
  const [editReminderPickedTime, setEditReminderPickedTime] = useState(new Date());
  const [showEditReminderTimePicker, setShowEditReminderTimePicker] = useState(false);
  const [nagMode, setNagMode] = useState(false);
  const [nagSaving, setNagSaving] = useState(false);
  const [nagDays, setNagDaysState] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [nagTimes, setNagTimesState] = useState<string[]>(['07:00', '11:00', '15:00', '19:00']);
  const [nagEditingSlot, setNagEditingSlot] = useState<number | null>(null);
  const [nagPickedTime, setNagPickedTime] = useState(new Date());
  const [syncMsg, setSyncMsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [nutritionMode, setNutritionModeState] = useState<'sss' | 'standard'>('sss');

  const userEmail = auth.currentUser?.email ?? '';

  useEffect(() => {
    loadReminders();
    AsyncStorage.getItem('nutrition_mode').then(v => {
      if (v === 'sss' || v === 'standard') setNutritionModeState(v);
    });
  }, []);

  useEffect(() => {
    isNagModeEnabled().then(setNagMode);
    getNagDays().then(setNagDaysState);
    getNagTimes().then(setNagTimesState);
  }, []);

  const toggleNagMode = async (enabled: boolean) => {
    setNagSaving(true);
    const success = await setNagModeEnabled(enabled);
    setNagMode(enabled && success);
    setNagSaving(false);
    if (enabled && !success) Alert.alert('Notification permission', 'Allow LeanLog notifications in Android Settings to activate Super-Karen.');
  };

  const toggleNagDay = async (day: number) => {
    const next = nagDays.includes(day) ? nagDays.filter((item) => item !== day) : [...nagDays, day];
    if (!next.length) {
      Alert.alert('Nag days', 'Choose at least one day, or switch Nag Mode off.');
      return;
    }
    setNagDaysState(next);
    setNagSaving(true);
    await setNagDays(next);
    setNagSaving(false);
  };

  const openNagTimePicker = (index: number) => {
    setNagPickedTime(timeStrToDate(nagTimes[index]));
    setNagEditingSlot(index);
  };

  const saveNagTime = async (date?: Date) => {
    const slot = nagEditingSlot;
    setNagEditingSlot(null);
    if (!date || slot === null) return;
    const next = [...nagTimes];
    next[slot] = formatPickerTime(date);
    setNagTimesState(next);
    setNagSaving(true);
    await setNagTimes(next);
    setNagSaving(false);
  };

  const changeNutritionMode = async (mode: 'sss' | 'standard') => {
    setNutritionModeState(mode);
    await AsyncStorage.setItem('nutrition_mode', mode);
  };

  const loadReminders = async () => {
    const saved = await AsyncStorage.getItem(REMINDER_KEY);
    if (saved) setReminders(JSON.parse(saved));
  };

  const saveReminders = async (list: Reminder[]) => {
    setReminders(list);
    await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(list));
  };

  const requestNotifPermission = async (): Promise<boolean> => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permRequired'), t('notifPermMsg'));
      return false;
    }
    return true;
  };

  const addReminder = async () => {
    const name = reminderName.trim();
    const time = formatPickerTime(reminderPickedTime);
    if (!name) {
      Alert.alert(t('inputError'), t('invalidReminder'));
      return;
    }
    const ok = await requestNotifPermission();
    if (!ok) return;
    try {
      const notifId = await scheduleNotif(name, time);
      const newReminder: Reminder = {
        id: Date.now().toString(),
        name,
        time,
        notifId,
        enabled: true,
      };
      await saveReminders([...reminders, newReminder]);
      setReminderName('');
      setReminderPickedTime(new Date());
      setShowAddReminder(false);
    } catch (e: any) {
      Alert.alert(t('error'), e?.message ?? 'Gagal jadual notifikasi.');
    }
  };

  const toggleReminder = async (r: Reminder) => {
    if (r.enabled) {
      await cancelNotif(r.notifId);
      const updated = reminders.map((x) => x.id === r.id ? { ...x, enabled: false, notifId: '' } : x);
      await saveReminders(updated);
    } else {
      const ok = await requestNotifPermission();
      if (!ok) return;
      try {
        const notifId = await scheduleNotif(r.name, r.time);
        const updated = reminders.map((x) => x.id === r.id ? { ...x, enabled: true, notifId } : x);
        await saveReminders(updated);
      } catch {}
    }
  };

  const deleteReminder = (r: Reminder) => {
    Alert.alert(t('delete'), `Padam "${r.name}"?`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          await cancelNotif(r.notifId);
          await saveReminders(reminders.filter((x) => x.id !== r.id));
        },
      },
    ]);
  };

  const openEditReminder = (r: Reminder) => {
    setEditingReminder(r);
    setEditReminderName(r.name);
    setEditReminderPickedTime(timeStrToDate(r.time));
    setShowEditReminderModal(true);
  };

  const saveEditReminder = async () => {
    if (!editingReminder) return;
    const name = editReminderName.trim();
    const time = formatPickerTime(editReminderPickedTime);
    if (!name) {
      Alert.alert(t('inputError'), t('invalidReminder'));
      return;
    }
    const ok = await requestNotifPermission();
    if (!ok) return;
    try {
      await cancelNotif(editingReminder.notifId);
      const notifId = editingReminder.enabled ? await scheduleNotif(name, time) : '';
      const updated = reminders.map((x) =>
        x.id === editingReminder.id ? { ...x, name, time, notifId } : x
      );
      await saveReminders(updated);
      setShowEditReminderModal(false);
      setEditingReminder(null);
    } catch (e: any) {
      Alert.alert(t('error'), e?.message ?? 'Gagal kemaskini peringatan.');
    }
  };

  const uploadToCloud = async () => {
    setSyncing(true);
    setSyncMsg(t('uploading'));
    try {
      const [food, acts, weights, goal, profile] = await Promise.all([
        AsyncStorage.getItem('calorie_entries'),
        AsyncStorage.getItem('activity_entries'),
        AsyncStorage.getItem('weight_entries'),
        AsyncStorage.getItem('calorie_goal'),
        AsyncStorage.getItem('user_profile'),
      ]);
      const ops: Promise<void>[] = [];
      if (food) JSON.parse(food).forEach((e: any) => ops.push(fsUpsert('foodEntries', e.id, e)));
      if (acts) JSON.parse(acts).forEach((e: any) => ops.push(fsUpsert('activityEntries', e.id, e)));
      if (weights) JSON.parse(weights).forEach((e: any) => ops.push(fsUpsert('weightEntries', e.id, e)));
      if (goal) ops.push(fsSetSettings({ goal: Number(goal) }));
      if (profile) ops.push(fsSetSettings({ profile: JSON.parse(profile) as UserProfile }));
      await Promise.all(ops);
      setSyncMsg(t('uploadSuccess'));
    } catch {
      setSyncMsg(t('uploadFail'));
    } finally {
      setSyncing(false);
    }
  };

  const restoreFromCloud = async () => {
    setSyncing(true);
    setSyncMsg(t('restoring'));
    try {
      const [food, acts, weights, settings] = await Promise.all([
        fsFetchAll<any>('foodEntries'),
        fsFetchAll<any>('activityEntries'),
        fsFetchAll<any>('weightEntries'),
        fsFetchSettings(),
      ]);
      if (!food.length && !acts.length && !weights.length) {
        setSyncMsg(t('noCloudData'));
        setSyncing(false);
        return;
      }
      if (food.length) await AsyncStorage.setItem('calorie_entries', JSON.stringify(food));
      if (acts.length) await AsyncStorage.setItem('activity_entries', JSON.stringify(acts));
      if (weights.length) await AsyncStorage.setItem('weight_entries', JSON.stringify(weights));
      if (settings?.goal) await AsyncStorage.setItem('calorie_goal', String(settings.goal));
      if (settings?.profile) await AsyncStorage.setItem('user_profile', JSON.stringify(settings.profile));
      setSyncMsg(t('restoreSuccess'));
    } catch {
      setSyncMsg(t('restoreFail'));
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('logOut'), t('logOutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logOut'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const checkForUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch('https://api.github.com/repos/umarislah86-collab/leanlog/releases/latest');
      const data = await res.json();
      const latestTag = (data.tag_name ?? '').replace('v', '');
      const currentVersion = Constants.expoConfig?.version ?? '';
      const apkAsset = data.assets?.find((asset: any) => String(asset?.name || '').toLowerCase().endsWith('.apk'));
      const downloadUrl = apkAsset?.browser_download_url ?? `https://github.com/umarislah86-collab/leanlog/releases/tag/${data.tag_name}`;
      if (latestTag && latestTag !== currentVersion) {
        Alert.alert(
          '🔔 Update Tersedia',
          `Versi ${latestTag} telah dikeluarkan.\nAnda sedang guna versi ${currentVersion}.`,
          [
            { text: 'Batal', style: 'cancel' },
            { text: 'Download', onPress: () => Linking.openURL(downloadUrl) },
          ]
        );
      } else {
        Alert.alert('✅ Versi Terkini', `Anda sudah guna versi terbaru (${currentVersion}).`);
      }
    } catch {
      Alert.alert('Ralat', 'Gagal semak update. Cuba lagi.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const addHomeWidget = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Android widget', 'The LeanLog home-screen widget is available on Android.');
      return;
    }
    try {
      await refreshLeanLogWidget();
      const supported = await requestPinWidget({ widgetName: 'LeanLogDaily' });
      if (!supported) Alert.alert('Add widget', 'Long-press your Android home screen, choose Widgets, then select LeanLog Daily.');
    } catch {
      Alert.alert('Add widget', 'Long-press your Android home screen, choose Widgets, then select LeanLog Daily.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settingsTitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Language */}
        <Text style={styles.sectionLabel}>{t('language')}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langBtn, lang === 'bm' && styles.langBtnActive]}
            onPress={() => setLang('bm')}
          >
            <Text style={[styles.langBtnText, lang === 'bm' && styles.langBtnTextActive]}>
              🇲🇾 Bahasa Malaysia
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
            onPress={() => setLang('en')}
          >
            <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>
              🇬🇧 English
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nutrition Mode */}
        <Text style={styles.sectionLabel}>{lang === 'en' ? 'Nutrition Framework' : 'Panduan Pemakanan'}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langBtn, nutritionMode === 'sss' && styles.langBtnActive]}
            onPress={() => changeNutritionMode('sss')}
          >
            <Text style={[styles.langBtnText, nutritionMode === 'sss' && styles.langBtnTextActive]}>
              🥗 Suku Suku Separuh
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, nutritionMode === 'standard' && styles.langBtnActive]}
            onPress={() => changeNutritionMode('standard')}
          >
            <Text style={[styles.langBtnText, nutritionMode === 'standard' && styles.langBtnTextActive]}>
              📊 {lang === 'en' ? 'Standard Macro' : 'Makro Standard'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cloud Sync */}
        <Text style={styles.sectionLabel}>{t('cloudSync')}</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow} onPress={uploadToCloud} disabled={syncing}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{t('uploadToCloud')}</Text>
              <Text style={styles.actionSub}>{t('uploadDesc')}</Text>
            </View>
            {syncing && <ActivityIndicator size="small" color="#FF6542" />}
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionRow} onPress={restoreFromCloud} disabled={syncing}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{t('restoreData')}</Text>
              <Text style={styles.actionSub}>{t('restoreDesc')}</Text>
            </View>
          </TouchableOpacity>
          {syncMsg !== '' && (
            <Text style={styles.syncMsg}>{syncMsg}</Text>
          )}
        </View>

        <Text style={styles.sectionLabel}>HOME SCREEN</Text>
        <View style={styles.widgetCard}>
          <View style={styles.widgetPreview}>
            <View style={styles.widgetPreviewTop}><Text style={styles.widgetEyebrow}>LEANLOG / TODAY</Text><Text style={styles.widgetUpdated}>UPDATED 4:18 PM</Text></View>
            <View style={styles.widgetPreviewHero}><View><Text style={styles.widgetValue}>1,240</Text><Text style={styles.widgetKcal}>KCAL LEFT</Text></View><View style={styles.widgetPercent}><Text style={styles.widgetPercentValue}>38%</Text><Text style={styles.widgetPercentSub}>760 / 2,000</Text></View></View>
            <View style={styles.widgetPreviewTrack}><View style={styles.widgetPreviewFill} /></View>
            <View style={styles.widgetPreviewTiles}><Text style={styles.widgetPreviewTile}>4,892 steps{`\n`}2 meals · 214 burned</Text><Text style={[styles.widgetPreviewTile, styles.widgetPreviewNext]}>NEXT UP{`\n`}Gym · 6:30 PM</Text></View>
          </View>
          <Text style={styles.widgetTitle}>Your day without opening the app.</Text>
          <Text style={styles.widgetBody}>A native Android widget for calories, steps and your next calendar event. It refreshes when LeanLog opens and every 30 minutes.</Text>
          <TouchableOpacity style={styles.widgetButton} onPress={addHomeWidget}>
            <Text style={styles.widgetButtonText}>＋ Add LeanLog widget</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>SUPER-KAREN COACH</Text>
        <View style={styles.nagCard}>
          <View style={styles.nagTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nagTitle}>🔥 Nag Mode</Text>
              <Text style={styles.nagSubtitle}>Four daily checkpoints on your schedule. One tiny meal will not silence the coach.</Text>
            </View>
            {nagSaving ? <ActivityIndicator color="#FF6542" /> : <Switch value={nagMode} onValueChange={toggleNagMode} trackColor={{ false: '#D8CEBE', true: '#FF856B' }} thumbColor={nagMode ? '#FFFDF7' : '#FFFFFF'} />}
          </View>
          <View style={styles.nagQuote}>
            <Text style={styles.nagQuoteTime}>3:00 PM · EXAMPLE</Text>
            <Text style={styles.nagQuoteText}>“Your lunch is not classified information, bro. Release the photo to the authorities.”</Text>
          </View>
          <Text style={styles.nagDaysLabel}>ACTIVE DAYS</Text>
          <View style={styles.nagDaysRow}>
            {[
              { day: 1, label: 'M' }, { day: 2, label: 'T' }, { day: 3, label: 'W' },
              { day: 4, label: 'T' }, { day: 5, label: 'F' }, { day: 6, label: 'S' }, { day: 0, label: 'S' },
            ].map(({ day, label }) => {
              const active = nagDays.includes(day);
              return <TouchableOpacity key={day} style={[styles.nagDay, active && styles.nagDayActive]} onPress={() => toggleNagDay(day)}><Text style={[styles.nagDayText, active && styles.nagDayTextActive]}>{label}</Text></TouchableOpacity>;
            })}
          </View>
          <Text style={styles.nagDaysLabel}>DAILY CHECKPOINTS · TAP TO CHANGE</Text>
          <View style={styles.nagTimesGrid}>
            {['MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING'].map((label, index) => (
              <TouchableOpacity key={label} style={styles.nagTimeButton} onPress={() => openNagTimePicker(index)}>
                <Text style={styles.nagTimeLabel}>{label}</Text>
                <Text style={styles.nagTimeValue}>{timeStrToDate(nagTimes[index]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.nagActions}>
            <Text style={styles.nagAction}>📸 Fine, log now</Text>
            <Text style={styles.nagAction}>😴 Snooze 2h</Text>
            <Text style={styles.nagAction}>🏳️ Lazy day</Text>
          </View>
          <Text style={styles.nagHint}>Messages rotate daily and all four checkpoints remain active. Only “Lazy day” or switching Nag Mode off stops the rest.</Text>
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>{t('notifications')}</Text>
        <View style={styles.card}>
          {reminders.length === 0 ? (
            <Text style={styles.emptyText}>{t('noReminders')}</Text>
          ) : (
            reminders.map((r) => (
              <TouchableOpacity key={r.id} style={styles.reminderRow}
                onLongPress={() => openEditReminder(r)} delayLongPress={400}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reminderName}>{r.name}</Text>
                  <Text style={styles.reminderTime}>{r.time} · {lang === 'bm' ? 'Setiap hari' : 'Daily'}</Text>
                </View>
                <Switch
                  value={r.enabled}
                  onValueChange={() => toggleReminder(r)}
                  trackColor={{ true: '#FF6542', false: '#33415C' }}
                  thumbColor={r.enabled ? '#FFFDF7' : '#AAB3C2'}
                />
                <TouchableOpacity onPress={() => deleteReminder(r)} style={styles.deleteBtn}>
                  <Text style={{ color: '#FF6542', fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity
            style={styles.addReminderBtn}
            onPress={() => { setReminderName(''); setReminderPickedTime(new Date()); setShowAddReminder(true); }}
          >
            <Text style={styles.addReminderBtnText}>{t('addReminder')}</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>{t('account')}</Text>
        <View style={styles.card}>
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>{t('emailLabel')}</Text>
            <Text style={styles.accountValue}>{userEmail}</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <Text style={[styles.actionTitle, { color: '#FF6542' }]}>{t('logOut')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />

        <Text style={styles.sectionLabel}>App</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow} onPress={checkForUpdate} disabled={checkingUpdate}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>🔄 Semak Update</Text>
              <Text style={styles.actionSub}>Semak sama ada ada versi terbaru</Text>
            </View>
            {checkingUpdate && <ActivityIndicator size="small" color="#FF6542" />}
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionRow} onPress={() => {
            Linking.openURL('mailto:umarislah86@gmail.com?subject=LeanLog%20Maklum%20Balas&body=Versi%3A%201.3.3%0A%0AMaklum%20balas%20saya%3A%0A');
          }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>💬 Hantar Maklum Balas</Text>
              <Text style={styles.actionSub}>Cadangan, masalah atau sebarang pertanyaan</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionRow} onPress={() => {
            Alert.alert(
              '📊 Pengiraan Makro',
              'Matlamat makro dikira daripada sasaran kalori harian anda:\n\n• Protein: 25% ÷ 4 kcal/g\n• Karbohidrat: 45% ÷ 4 kcal/g\n• Lemak: 30% ÷ 9 kcal/g\n\nContoh (2000 kcal):\nProtein 125g  |  Karbo 225g  |  Lemak 67g',
              [{ text: 'OK' }]
            );
          }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>📊 Cara Makro Dikira</Text>
              <Text style={styles.actionSub}>Ketahui pengiraan Protein, Karbo & Lemak</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />

        <Text style={{ color: '#26334A', fontSize: 11, textAlign: 'center', marginBottom: 32, letterSpacing: 0.5 }}>
          LeanLog · Dibina dengan ❤️ oleh Umarosli
        </Text>
      </ScrollView>

      {/* Add Reminder Modal */}
      <Modal visible={showAddReminder} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('addReminderTitle')}</Text>
            <Text style={styles.modalLabel}>{t('reminderName')}</Text>
            <TextInput
              style={styles.modalInput}
              value={reminderName}
              onChangeText={setReminderName}
              placeholder={t('reminderNamePh')}
              placeholderTextColor="#7D8799"
              autoFocus
            />
            <Text style={styles.modalLabel}>{t('reminderTime')}</Text>
            <TouchableOpacity style={styles.reminderTimeBtn} onPress={() => setShowReminderTimePicker(true)}>
              <Text style={styles.reminderTimeBtnText}>🕐 {formatPickerTime(reminderPickedTime)}</Text>
            </TouchableOpacity>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddReminder(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={addReminder}>
                <Text style={styles.modalSaveText}>{t('add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Reminder Modal */}
      <Modal visible={showEditReminderModal} transparent animationType="fade">
        <View style={styles.centeredOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{lang === 'bm' ? 'Edit Peringatan' : 'Edit Reminder'}</Text>
            <Text style={styles.modalLabel}>{t('reminderName')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editReminderName}
              onChangeText={setEditReminderName}
              placeholder={t('reminderNamePh')}
              placeholderTextColor="#7D8799"
              autoFocus
            />
            <Text style={styles.modalLabel}>{t('reminderTime')}</Text>
            <TouchableOpacity style={styles.reminderTimeBtn} onPress={() => setShowEditReminderTimePicker(true)}>
              <Text style={styles.reminderTimeBtnText}>🕐 {formatPickerTime(editReminderPickedTime)}</Text>
            </TouchableOpacity>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditReminderModal(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveEditReminder}>
                <Text style={styles.modalSaveText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {showReminderTimePicker && (
        <DateTimePicker
          value={reminderPickedTime}
          mode="time"
          display="spinner"
          onChange={(_, date) => { setShowReminderTimePicker(false); if (date) setReminderPickedTime(date); }}
        />
      )}
      {showEditReminderTimePicker && (
        <DateTimePicker
          value={editReminderPickedTime}
          mode="time"
          display="spinner"
          onChange={(_, date) => { setShowEditReminderTimePicker(false); if (date) setEditReminderPickedTime(date); }}
        />
      )}
      {nagEditingSlot !== null && (
        <DateTimePicker
          value={nagPickedTime}
          mode="time"
          display="spinner"
          onChange={(_, date) => saveNagTime(date)}
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

  sectionLabel: {
    color: '#C95370',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 24,
    fontWeight: '700',
  },

  langRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  langBtn: {
    flex: 1, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#E2D9C9',
    backgroundColor: '#FFFDF7', alignItems: 'center',
  },
  langBtnActive: { borderColor: '#FF6542', backgroundColor: '#FFE6DC' },
  langBtnText: { color: '#626A75', fontSize: 13, fontWeight: '600' },
  langBtnTextActive: { color: '#FF6542', fontWeight: 'bold' },

  card: {
    backgroundColor: '#FFFDF7',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2D9C9',
    overflow: 'hidden',
    marginBottom: 4,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 18 },
  actionTitle: { color: '#101A2B', fontSize: 14, fontWeight: '800' },
  actionSub: { color: '#737A84', fontSize: 12, marginTop: 3 },
  divider: { height: 1, backgroundColor: '#E8DFD0', marginHorizontal: 16 },
  syncMsg: { color: '#AAB3C2', fontSize: 12, paddingHorizontal: 18, paddingBottom: 12, paddingTop: 4 },

  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#26334A',
  },
  reminderName: { color: '#101A2B', fontSize: 14, fontWeight: '800' },
  reminderTime: { color: '#7D8799', fontSize: 12, marginTop: 2 },
  deleteBtn: { paddingLeft: 12 },
  emptyText: { color: '#657086', fontSize: 13, padding: 16, textAlign: 'center' },
  addReminderBtn: { padding: 14, alignItems: 'center' },
  addReminderBtnText: { color: '#FF6542', fontSize: 14, fontWeight: '600' },

  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  accountLabel: { color: '#7D8799', fontSize: 13 },
  accountValue: { color: '#263247', fontSize: 13, fontWeight: '700', maxWidth: '65%', textAlign: 'right' },

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

  reminderTimeBtn: { backgroundColor: '#26334A', borderRadius: 10, padding: 14, marginBottom: 4 },
  reminderTimeBtnText: { color: '#FF6542', fontSize: 15, fontWeight: '500' },
  widgetCard: { backgroundColor: '#FFFDF7', borderRadius: 24, padding: 17, borderWidth: 1, borderColor: '#E2D9C9' },
  widgetPreview: { backgroundColor: '#F7EEDC', borderRadius: 20, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E2D7C3' },
  widgetPreviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  widgetEyebrow: { color: '#172033', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  widgetUpdated: { color: '#7C756B', fontSize: 7, fontWeight: '800' },
  widgetPreviewHero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  widgetValue: { color: '#172033', fontFamily: 'serif', fontSize: 31, fontWeight: '800' },
  widgetKcal: { color: '#FF6542', fontSize: 8, fontWeight: '900' },
  widgetPercent: { backgroundColor: '#172033', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'flex-end' },
  widgetPercentValue: { color: '#91DCBB', fontSize: 17, fontWeight: '900' },
  widgetPercentSub: { color: '#F7EEDC', fontSize: 7 },
  widgetPreviewTrack: { height: 6, backgroundColor: '#DED5C6', borderRadius: 3, marginTop: 9, overflow: 'hidden' },
  widgetPreviewFill: { width: '38%', height: '100%', backgroundColor: '#FF6542', borderRadius: 3 },
  widgetPreviewTiles: { flexDirection: 'row', gap: 7, marginTop: 9 },
  widgetPreviewTile: { flex: 1, backgroundColor: '#EEE3CF', borderRadius: 11, color: '#172033', fontSize: 8, fontWeight: '800', lineHeight: 13, padding: 8 },
  widgetPreviewNext: { backgroundColor: '#D9D8FF', color: '#525190' },
  widgetTitle: { color: '#101A2B', fontFamily: 'serif', fontSize: 21, fontWeight: '800' },
  widgetBody: { color: '#737A84', fontSize: 12, lineHeight: 18, marginTop: 7 },
  widgetButton: { backgroundColor: '#8FD6B4', borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 15 },
  widgetButtonText: { color: '#101A2B', fontSize: 13, fontWeight: '900' },
  nagCard: { backgroundColor: '#101A2B', borderRadius: 24, padding: 17 },
  nagTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nagTitle: { color: '#FFF4DB', fontFamily: 'serif', fontSize: 22, fontWeight: '800' },
  nagSubtitle: { color: '#AAB5C7', fontSize: 11, lineHeight: 16, marginTop: 5 },
  nagQuote: { backgroundColor: '#1C2940', borderRadius: 17, padding: 13, marginTop: 15, borderLeftWidth: 3, borderLeftColor: '#FF6542' },
  nagQuoteTime: { color: '#8FD6B4', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  nagQuoteText: { color: '#FFFDF7', fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 6 },
  nagDaysLabel: { color: '#7F8BA0', fontSize: 8, fontWeight: '900', letterSpacing: 1.3, marginTop: 13, marginBottom: 7 },
  nagDaysRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  nagDay: { flex: 1, aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: '#33415C', alignItems: 'center', justifyContent: 'center' },
  nagDayActive: { backgroundColor: '#FF6542', borderColor: '#FF6542' },
  nagDayText: { color: '#8E9AAF', fontSize: 10, fontWeight: '900' },
  nagDayTextActive: { color: '#FFFDF7' },
  nagTimesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nagTimeButton: { width: '48.5%', backgroundColor: '#1C2940', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: '#33415C' },
  nagTimeLabel: { color: '#8FD6B4', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  nagTimeValue: { color: '#FFF4DB', fontFamily: 'serif', fontSize: 18, fontWeight: '800', marginTop: 3 },
  nagActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  nagAction: { color: '#101A2B', backgroundColor: '#F3EAD7', borderRadius: 11, paddingHorizontal: 8, paddingVertical: 6, fontSize: 9, fontWeight: '800' },
  nagHint: { color: '#7F8BA0', fontSize: 9, lineHeight: 13, marginTop: 10 },
});
