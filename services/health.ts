import {
  aggregateRecord,
  getGrantedPermissions,
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';
import type { ActivityEntry } from '../types';

export interface HealthSnapshot {
  steps: number;
  sleepMinutes: number;
  averageBpm: number;
  sourceLabel: string;
}

const READ_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'SleepSession' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
];

const EXERCISE_NAMES: Record<number, string> = {
  0: 'Workout', 8: 'Cycling', 9: 'Indoor cycling', 11: 'Boxing', 16: 'Dancing',
  25: 'Elliptical', 26: 'Exercise class', 34: 'Gymnastics', 36: 'HIIT', 37: 'Hiking',
  41: 'Jump rope', 48: 'Pilates', 53: 'Rowing', 54: 'Rowing machine', 56: 'Running',
  57: 'Treadmill', 68: 'Stair climbing', 69: 'Stair machine', 70: 'Strength training',
  71: 'Stretching', 73: 'Open-water swim', 74: 'Pool swimming', 79: 'Walking',
  81: 'Weightlifting', 83: 'Yoga',
};

const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  return {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
};

const lastNightRange = () => {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  return {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
};

const recentRange = () => {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  const end = new Date();
  return { operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() };
};

async function findMiFitnessOrigin() {
  const results = await Promise.all([
    readRecords('Steps', { timeRangeFilter: recentRange() }).catch(() => ({ records: [] })),
    readRecords('SleepSession', { timeRangeFilter: recentRange() }).catch(() => ({ records: [] })),
    readRecords('HeartRate', { timeRangeFilter: recentRange() }).catch(() => ({ records: [] })),
  ]);
  const origins = results.flatMap((result) => result.records.map((record: any) => record.metadata?.dataOrigin || ''));
  return origins.find((origin) => /xiaomi|wearable|mifitness/i.test(origin)) || null;
}

export async function healthIsConnected() {
  try {
    if (!await initialize()) return false;
    const granted = await getGrantedPermissions();
    return READ_PERMISSIONS.every((permission) => granted.some(
      (item: any) => item.accessType === permission.accessType && item.recordType === permission.recordType,
    ));
  } catch {
    return false;
  }
}

export async function connectHealth() {
  if (!await initialize()) throw new Error('HEALTH_CONNECT_UNAVAILABLE');
  const granted = await requestPermission(READ_PERMISSIONS);
  return READ_PERMISSIONS.every((permission) => granted.some(
    (item: any) => item.accessType === permission.accessType && item.recordType === permission.recordType,
  ));
}

export async function readHealthSnapshot(): Promise<HealthSnapshot> {
  if (!await initialize()) throw new Error('HEALTH_CONNECT_UNAVAILABLE');
  const miFitnessOrigin = await findMiFitnessOrigin();
  const dataOriginFilter = miFitnessOrigin ? [miFitnessOrigin] : undefined;
  const [stepsResult, heartResult, sleepResult] = await Promise.all([
    aggregateRecord({ recordType: 'Steps', timeRangeFilter: todayRange(), dataOriginFilter }),
    aggregateRecord({ recordType: 'HeartRate', timeRangeFilter: todayRange(), dataOriginFilter }).catch(() => null),
    readRecords('SleepSession', { timeRangeFilter: lastNightRange(), dataOriginFilter }).catch(() => ({ records: [] })),
  ]);

  const sleepMinutes = sleepResult.records.reduce((sum, record) => {
    const duration = new Date(record.endTime).getTime() - new Date(record.startTime).getTime();
    return sum + Math.max(0, duration / 60000);
  }, 0);

  return {
    steps: Math.round(stepsResult.COUNT_TOTAL || 0),
    sleepMinutes: Math.round(sleepMinutes),
    averageBpm: Math.round(heartResult?.BPM_AVG || 0),
    sourceLabel: miFitnessOrigin ? 'Mi Fitness via Health Connect' : 'Health Connect',
  };
}

export async function readRecentHealthWorkouts(): Promise<ActivityEntry[]> {
  if (!await initialize()) throw new Error('HEALTH_CONNECT_UNAVAILABLE');
  const miFitnessOrigin = await findMiFitnessOrigin();
  const dataOriginFilter = miFitnessOrigin ? [miFitnessOrigin] : undefined;
  const [sessions, calories] = await Promise.all([
    readRecords('ExerciseSession', { timeRangeFilter: recentRange(), dataOriginFilter }).catch(() => ({ records: [] })),
    readRecords('ActiveCaloriesBurned', { timeRangeFilter: recentRange(), dataOriginFilter }).catch(() => ({ records: [] })),
  ]);
  return [...sessions.records].sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map((session: any) => {
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    const overlappingCalories = calories.records.filter((record: any) =>
      new Date(record.startTime) < end && new Date(record.endTime) > start
    );
    const caloriesBurned = Math.round(overlappingCalories.reduce(
      (sum: number, record: any) => sum + Number(record.energy?.inKilocalories || 0), 0,
    ));
    const origin = session.metadata?.dataOrigin || 'health-connect';
    const recordId = session.metadata?.id || `${session.startTime}-${session.exerciseType}`;
    return {
      type: 'activity' as const,
      id: `health-${origin}-${recordId}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      name: session.title || EXERCISE_NAMES[session.exerciseType] || 'Workout',
      duration: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)),
      caloriesBurned,
      time: start.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
      date: start.toLocaleDateString('ms-MY'),
    };
  });
}
