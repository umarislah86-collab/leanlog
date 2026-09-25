import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GymSession, UserProfile } from '../types';

let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch {}

export const WORKOUT_DRAFT_KEY = 'coach_active_workout_draft_v2';
const REST_CHANNEL = 'workout-rest-v1';

export interface CoachDraftSet { reps: string; weight: string; done: boolean; warmup?: boolean; rpe?: number; }
export interface CoachDraftExercise { name: string; restSeconds: number; notes?: string; sets: CoachDraftSet[]; }
export interface WorkoutDraft {
  dayLabel: string;
  dayIndex: number;
  modified: boolean;
  exercises: CoachDraftExercise[];
  startedAt: number;
  readiness?: { energy: number; soreness: number; sleepMinutes: number };
}

export const loadWorkoutDraft = async (): Promise<WorkoutDraft | null> => {
  const raw = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};
export const saveWorkoutDraft = (draft: WorkoutDraft) => AsyncStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(draft));
export const clearWorkoutDraft = () => AsyncStorage.removeItem(WORKOUT_DRAFT_KEY);

export async function loadGymHistory(): Promise<GymSession[]> {
  const raw = await AsyncStorage.getItem('gym_sessions');
  const sessions: GymSession[] = raw ? JSON.parse(raw) : [];
  return sessions.sort((a, b) => sessionTimestamp(b) - sessionTimestamp(a));
}

const sessionTimestamp = (session: GymSession) => {
  if (session.endedAt) return new Date(session.endedAt).getTime();
  const [day, month, year] = session.date.split('/').map(Number);
  return day && month && year ? new Date(year, month - 1, day, 12).getTime() : 0;
};

export function latestExercisePerformance(sessions: GymSession[], exerciseName: string) {
  const normalized = exerciseName.trim().toLowerCase();
  for (const session of sessions) {
    const exercise = session.exercises.find((item) => item.name.trim().toLowerCase() === normalized);
    if (!exercise) continue;
    const workSets = exercise.sets.filter((set) => set.done && !set.warmup);
    if (!workSets.length) continue;
    const volume = workSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
    const best = workSets.reduce((current, set) => set.weight * (1 + set.reps / 30) > current.weight * (1 + current.reps / 30) ? set : current, workSets[0]);
    return { session, sets: workSets, volume, estimated1RM: Math.round(best.weight * (1 + best.reps / 30)) };
  }
  return null;
}

export function progressionSuggestion(sessions: GymSession[], exerciseName: string) {
  const latest = latestExercisePerformance(sessions, exerciseName);
  if (!latest) return null;
  const completedAll = latest.sets.every((set) => set.reps >= 10);
  const maxWeight = Math.max(...latest.sets.map((set) => set.weight));
  return {
    label: completedAll && maxWeight > 0 ? `Try ${(maxWeight + 2.5).toFixed(1)}kg` : `Repeat ${maxWeight.toFixed(1)}kg and beat the last set`,
    weight: completedAll && maxWeight > 0 ? maxWeight + 2.5 : maxWeight,
    reps: completedAll ? 8 : Math.max(...latest.sets.map((set) => set.reps)),
  };
}

export function workoutHistorySummary(sessions: GymSession[]) {
  const since = Date.now() - 30 * 86400000;
  const recent = sessions.filter((session) => {
    const timestamp = sessionTimestamp(session);
    return timestamp >= since;
  });
  const volume = recent.reduce((total, session) => total + session.exercises.reduce(
    (exerciseTotal, exercise) => exerciseTotal + exercise.sets.filter((set) => set.done && !set.warmup).reduce((sum, set) => sum + set.weight * set.reps, 0), 0,
  ), 0);
  return { sessions: recent.length, minutes: recent.reduce((sum, session) => sum + session.durationMin, 0), volume };
}

export async function offlineWorkoutCalories(durationMin: number, exercises: CoachDraftExercise[]) {
  const profileRaw = await AsyncStorage.getItem('user_profile');
  const profile: UserProfile | null = profileRaw ? JSON.parse(profileRaw) : null;
  const weight = profile?.weight || 75;
  const completion = exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.done).length, 0);
  const met = completion >= 12 ? 6 : completion >= 6 ? 4.8 : 3.8;
  return Math.max(1, Math.round((met * 3.5 * weight / 200) * durationMin));
}

export async function scheduleRestFinished(seconds: number) {
  if (!Notifications) return null;
  const permission = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permission?.granted) return null;
  await Notifications.setNotificationChannelAsync(REST_CHANNEL, {
    name: 'Workout rest timer', importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: true, vibrationPattern: [0, 300, 130, 300], sound: 'default',
  }).catch(() => {});
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Rest over. Back to work. 💪', body: 'Your next set is waiting.', sound: true, data: { kind: 'workout-rest' } },
    trigger: { type: 'date', date: new Date(Date.now() + seconds * 1000), channelId: REST_CHANNEL },
  }).catch(() => null);
}

export async function cancelRestNotification(id: string | null) {
  if (Notifications && id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
