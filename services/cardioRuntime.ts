import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, Vibration } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { fsUpsert } from '../firebase';
import { latestLoggedWeight } from './currentWeight';
import { cardioCalories, cardioGoalProgress, cardioNames, createCardioSession, elapsedCardioMs, recordCardioFix, transitionCardio, type CardioConfig, type CardioSession } from './cardioCore';
import { loadCardioSession, updateCardioSession } from './cardioStore';
import type { ActivityEntry } from '../types';

const GPS_TASK = 'LEANLOG_CARDIO_GPS';
const LIVE_ID = 'leanlog-cardio-live';
const CUE_CHANNEL = 'leanlog-cardio-cues';
const LIVE_CHANNEL = 'leanlog-cardio-session';
const VIBRATE_CHANNEL = 'leanlog-cardio-vibration';
const isExpoGo = Constants.appOwnership === 'expo';
let watcher: Location.LocationSubscription | null = null;
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work); queue = next.catch(() => {}); return next;
}
export async function currentCardioWeight() {
  const [profile, weights] = await Promise.all([AsyncStorage.getItem('user_profile'), AsyncStorage.getItem('weight_entries')]);
  return latestLoggedWeight(weights ? JSON.parse(weights) : []) ?? (profile ? Number(JSON.parse(profile).weight) : 0);
}
export function speakCardio(session: CardioSession, message: string) {
  if (AppState.currentState !== 'active') return;
  if (session.config.vibrate) Vibration.vibrate([0, 160, 100, 160]);
  if (session.config.voice) { void Speech.stop(); Speech.speak(message, { language: 'en', rate: 0.9 }); }
}
async function notificationsReady() {
  await Notifications.setNotificationChannelAsync(CUE_CHANNEL, { name: 'Cardio interval cues', importance: Notifications.AndroidImportance.HIGH, sound: 'default', enableVibrate: true });
  await Notifications.setNotificationChannelAsync(LIVE_CHANNEL, { name: 'Cardio session controls', importance: Notifications.AndroidImportance.LOW, sound: null, enableVibrate: false });
  await Notifications.setNotificationChannelAsync(VIBRATE_CHANNEL, { name: 'Cardio vibration cues', importance: Notifications.AndroidImportance.HIGH, sound: null, enableVibrate: true });
  await Notifications.setNotificationCategoryAsync('cardio-running', [
    { identifier: 'CARDIO_PAUSE', buttonTitle: 'Pause', options: { opensAppToForeground: true } },
    { identifier: 'CARDIO_FINISH', buttonTitle: 'Finish', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync('cardio-paused', [
    { identifier: 'CARDIO_RESUME', buttonTitle: 'Resume', options: { opensAppToForeground: true } },
    { identifier: 'CARDIO_FINISH', buttonTitle: 'Finish', options: { opensAppToForeground: true } },
  ]);
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  return permission.granted;
}
async function cancelSessionNotifications(id: string) {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(pending.filter(n => n.content.data?.sessionId === id).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  await Notifications.dismissNotificationAsync(LIVE_ID).catch(() => {});
}
async function liveNotification(s: CardioSession) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({ identifier: LIVE_ID,
    content: { title: `${cardioNames[s.config.mode]} · ${s.status === 'paused' ? 'Paused' : 'In progress'}`,
      body: `${(s.distanceM / 1000).toFixed(2)} km · Tap to return to Cardio Companion`, sticky: true, autoDismiss: false,
      categoryIdentifier: s.status === 'paused' ? 'cardio-paused' : 'cardio-running', data: { kind: 'cardio', sessionId: s.id } },
    trigger: { channelId: LIVE_CHANNEL },
  });
}
async function cueNotification(s: CardioSession, title: string) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.scheduleNotificationAsync({ content: { title, body: 'Cardio Companion · Keep your own pace.', sound: s.config.voice ? 'default' : undefined,
    vibrate: s.config.vibrate ? [0, 180, 100, 180] : undefined, data: { kind: 'cardio-cue', sessionId: s.id } }, trigger: { channelId: s.config.voice ? CUE_CHANNEL : s.config.vibrate ? VIBRATE_CHANNEL : LIVE_CHANNEL } });
}
async function scheduleCues(s: CardioSession) {
  await cancelSessionNotifications(s.id);
  if (s.status !== 'running' || !(await Notifications.getPermissionsAsync()).granted) return;
  await liveNotification(s);
  const elapsed = elapsedCardioMs(s) / 1000;
  const clockOrigin = Date.now() - elapsed * 1000;
  const cues: { at: number; title: string }[] = [];
  const i = s.config.intervals;
  if (i) for (let round = 0; round < i.rounds; round++) {
    const base = round * (i.walkSeconds + i.effortSeconds);
    cues.push({ at: base + i.walkSeconds, title: `${cardioNames[s.config.mode]} · Round ${round + 1} of ${i.rounds}` });
    cues.push({ at: base + i.walkSeconds + i.effortSeconds, title: round + 1 === i.rounds ? 'Intervals complete · Continue or finish' : `Walk · Round ${round + 2} of ${i.rounds}` });
  }
  if (s.config.goal === 'time' && !s.goalAnnounced) cues.push({ at: s.config.target * 60, title: 'Time target reached · Finish when ready' });
  for (const cue of cues.filter(c => c.at > elapsed + 0.5)) await Notifications.scheduleNotificationAsync({
    identifier: `${s.id}-cue-${cue.at}`,
    content: { title: cue.title, body: 'Cardio Companion', sound: s.config.voice ? 'default' : undefined,
      vibrate: s.config.vibrate ? [0, 180, 100, 180] : undefined, data: { kind: 'cardio-cue', sessionId: s.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(clockOrigin + cue.at * 1000), channelId: s.config.voice ? CUE_CHANNEL : s.config.vibrate ? VIBRATE_CHANNEL : LIVE_CHANNEL },
  });
}
async function recordLocations(locations: Location.LocationObject[]) {
  let milestone = '', active: CardioSession | null = null;
  active = await updateCardioSession(current => {
    if (!current || current.status !== 'running') return current;
    let next = current;
    for (const location of [...locations].sort((a,b) => a.timestamp - b.timestamp)) next = recordCardioFix(next, { latitude: location.coords.latitude, longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? Infinity, timestamp: location.timestamp });
    if (next.splits.length > current.splits.length) milestone = `${next.splits.length} kilometre${next.splits.length === 1 ? '' : 's'} complete`;
    if (!next.goalAnnounced && next.config.goal === 'distance' && cardioGoalProgress(next) === 1) { next = { ...next, goalAnnounced: true }; milestone = 'Distance target reached · Finish when ready'; }
    return next;
  });
  if (active && milestone) {
    if (AppState.currentState === 'active') speakCardio(active, milestone);
    else await cueNotification(active, milestone);
    await liveNotification(active);
  }
}
if (!TaskManager.isTaskDefined(GPS_TASK)) TaskManager.defineTask<{ locations: Location.LocationObject[] }>(GPS_TASK, async ({ data, error }) => {
  if (error) { await updateCardioSession(s => s && s.status === 'running' ? { ...s, gpsError: error.message, lastFix: null } : s); return; }
  if (data?.locations) await recordLocations(data.locations);
});
async function stopTracking() {
  watcher?.remove(); watcher = null;
  if (!isExpoGo && await Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(GPS_TASK);
}
async function track(s: CardioSession) {
  if (!s.config.gps || s.status !== 'running') return;
  const options = { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 };
  if (s.tracking === 'background') {
    if (AppState.currentState !== 'active') throw Error('Open LeanLog to resume GPS tracking.');
    if (!await Location.hasStartedLocationUpdatesAsync(GPS_TASK)) await Location.startLocationUpdatesAsync(GPS_TASK, { ...options,
      pausesUpdatesAutomatically: false, activityType: Location.ActivityType.Fitness, showsBackgroundLocationIndicator: true,
      foregroundService: { notificationTitle: 'LeanLog Cardio Companion', notificationBody: 'GPS tracking is active · Tap LeanLog to pause or finish', notificationColor: '#8FD6B4', killServiceOnDestroy: true },
    });
  } else if (!watcher) watcher = await Location.watchPositionAsync(options, positions => { void recordLocations([positions]).catch(console.warn); });
  if (s.gpsError) await updateCardioSession(current => current?.id === s.id ? { ...current, gpsError: undefined } : current);
}
export function startCardio(config: CardioConfig) {
  return serial(async () => {
    const prior = await loadCardioSession();
    if (prior && prior.status !== 'saved') throw Error('Finish and save, or discard your current session first.');
    let tracking: CardioSession['tracking'] = 'off';
    if (config.gps) {
      if (!await Location.hasServicesEnabledAsync()) throw Error('Turn on Location, or choose Timer only.');
      if (!(await Location.requestForegroundPermissionsAsync()).granted) throw Error('GPS permission was declined. You can still use Timer only.');
      const background = isExpoGo ? null : await Location.requestBackgroundPermissionsAsync();
      tracking = background?.granted ? 'background' : 'foreground';
    }
    await notificationsReady().catch(() => false);
    const session = { ...createCardioSession(config, await currentCardioWeight()), tracking };
    await updateCardioSession(current => { if (current && current.status !== 'saved') throw Error('A session is already active.'); return session; });
    try { await track(session); } catch (error) {
      await stopTracking().catch(() => {});
      await updateCardioSession(s => s?.id === session.id ? { ...transitionCardio(s, 'pause'), gpsError: String(error) } : s);
      throw error;
    }
    await scheduleCues(session).catch(console.warn);
    return session;
  });
}
export function controlCardio(action: 'pause' | 'resume' | 'finish', sessionId?: string) {
  return serial(async () => {
    let trackingError: unknown = null;
    const next = await updateCardioSession(s => s && (!sessionId || s.id === sessionId) ? transitionCardio(s, action) : s);
    if (!next || (sessionId && next.id !== sessionId)) return next;
    if (next.status === 'running') {
      try { await track(next); } catch (error) { await updateCardioSession(s => s?.id === next.id ? { ...transitionCardio(s,'pause'), gpsError: String(error) } : s); throw error; }
    } else {
      try { await stopTracking(); } catch (error) { trackingError = error; }
    }
    await scheduleCues(next).catch(console.warn);
    if (next.status === 'paused') await liveNotification(next).catch(console.warn);
    if (trackingError) throw trackingError;
    return next;
  });
}
export function discardCardio() {
  return serial(async () => {
    const current = await loadCardioSession();
    await stopTracking();
    if (current) await cancelSessionNotifications(current.id);
    await updateCardioSession(() => null);
  });
}
export function saveCardioActivity(sessionId: string) {
  return serial(async () => {
    const s = await loadCardioSession();
    if (!s || s.id !== sessionId || !['finished','saved'].includes(s.status)) throw Error('Finish this session before saving.');
    if (elapsedCardioMs(s) < 1000) throw Error('This session has no active time to save. You can discard it and start again.');
    const id = s.activityEntryId || s.id;
    const date = new Date(s.startedAt);
    const entry: ActivityEntry = { id, type: 'activity', name: `${cardioNames[s.config.mode]}${s.config.intervals ? ' · Intervals' : ''}`,
      duration: Math.round(elapsedCardioMs(s) / 60000 * 100) / 100, caloriesBurned: cardioCalories(s),
      date: date.toLocaleDateString('ms-MY'), time: date.toLocaleTimeString('ms-MY', { hour:'2-digit', minute:'2-digit' }),
      details: {
        kind:s.config.mode, source:s.manual?'manual':'LeanLog Cardio', calorieBasis:'estimated',
        startedAt:new Date(s.startedAt).toISOString(), endedAt:new Date(s.endedAt || s.startedAt+elapsedCardioMs(s)).toISOString(),
        totalDurationMin:Math.round(((s.endedAt || s.startedAt+elapsedCardioMs(s))-s.startedAt)/60000*100)/100,
        ...(s.config.gps || s.distanceM>0 ? {distanceKm:s.distanceM/1000} : {}),
        ...(s.distanceM>0 ? {averagePaceSecKm:elapsedCardioMs(s)/1000/(s.distanceM/1000),averageSpeedKmh:(s.distanceM/1000)/(elapsedCardioMs(s)/3600000)} : {}),
        splits:s.splits.map(split=>({label:`${split.km} km`,distanceKm:1,durationSec:split.seconds,paceSecKm:split.seconds})),
        ...(s.config.intervals?{intervals:[{label:'Walk',durationSec:s.config.intervals.walkSeconds,rounds:s.config.intervals.rounds},{label:cardioNames[s.config.mode],durationSec:s.config.intervals.effortSeconds,rounds:s.config.intervals.rounds}]}:{}),
      },
      cardio: { distanceKm: s.distanceM / 1000, source: s.manual ? 'manual' : s.config.gps ? 'gps' : 'timer', sessionId: s.id },
    };
    const rows: ActivityEntry[] = JSON.parse(await AsyncStorage.getItem('activity_entries') || '[]');
    if (!rows.some(row => row.id === id)) { rows.push(entry); await AsyncStorage.setItem('activity_entries', JSON.stringify(rows)); }
    const saved = await updateCardioSession(current => current?.id === s.id ? { ...current, status: 'saved', activityEntryId: id } : current);
    void fsUpsert('activityEntries', id, entry).catch(console.warn);
    return saved;
  });
}
export function manualCardio(config: CardioConfig, durationMin: number, distanceKm: number) {
  return serial(async () => {
    if (!Number.isFinite(durationMin) || durationMin < 1 || durationMin > 600 || !Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 100) throw Error('Enter 1–600 minutes and a valid optional distance (up to 100 km).');
    const now = Date.now(), session = createCardioSession({ ...config, gps: false, goal: 'free', intervals: null }, await currentCardioWeight(), now - durationMin * 60000);
    return updateCardioSession(current => {
      if (current && current.status !== 'saved') throw Error('Finish/save or discard the current session first.');
      return { ...session, status: 'finished', endedAt: now, runningSince: null, elapsedMs: durationMin * 60000, distanceM: distanceKm * 1000, manual: true };
    });
  });
}
export function handleCardioNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;
  const action = response.actionIdentifier;
  if (!data || typeof data.sessionId !== 'string') return Promise.resolve(null);
  if (action === 'CARDIO_PAUSE') return controlCardio('pause', data.sessionId);
  if (action === 'CARDIO_RESUME') return controlCardio('resume', data.sessionId);
  if (action === 'CARDIO_FINISH') return controlCardio('finish', data.sessionId);
  return Promise.resolve(null);
}
export function recoverCardioTracking() {
  return serial(async () => {
    if (AppState.currentState !== 'active') return;
    const s = await loadCardioSession();
    if (s?.status === 'running') {
      await track(s).catch(async error => { await updateCardioSession(current => current?.id === s.id ? { ...current, gpsError: String(error), lastFix: null } : current); });
    }
  });
}
export function resetForegroundCardioAnchor() {
  return serial(async () => {
    if (AppState.currentState === 'active') return;
    const s = await loadCardioSession();
    if (s?.tracking === 'foreground') { watcher?.remove(); watcher = null; await updateCardioSession(current => current?.id === s.id ? { ...current, lastFix: null, speedMps: 0 } : current); }
  });
}
