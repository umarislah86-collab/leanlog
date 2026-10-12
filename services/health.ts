import {
  aggregateRecord,
  getGrantedPermissions,
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

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
];

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

/** Only today's positive step records can select the preferred watch source.
 * Read every page so a busy phone source cannot hide a later Mi Fitness record.
 */
async function todayMiStepsOrigin(timeRangeFilter: ReturnType<typeof todayRange>) {
  let pageToken: string | undefined;
  const seen = new Set<string>();
  do {
    const result = await readRecords('Steps', { timeRangeFilter, pageSize: 1000, pageToken });
    const record = result.records.find(item => {
      const origin = item.metadata?.dataOrigin || '';
      const start = new Date(item.startTime).getTime(), end = new Date(item.endTime).getTime();
      return /xiaomi|mifitness|^com\.mi\.wearable(?:$|\.)/i.test(origin) && item.count > 0
        && end > new Date(timeRangeFilter.startTime).getTime()
        && start < new Date(timeRangeFilter.endTime).getTime();
    });
    if (record) return record.metadata?.dataOrigin;
    pageToken = result.pageToken;
    if (pageToken && seen.has(pageToken)) break;
    if (pageToken) seen.add(pageToken);
  } while (pageToken);
  return undefined;
}

export async function readHealthSnapshot(): Promise<HealthSnapshot> {
  if (!await initialize()) throw new Error('HEALTH_CONNECT_UNAVAILABLE');
  const range = todayRange();
  // Sleep and heart-rate retain their existing source selection independently.
  const [miFitnessOrigin, stepsOrigin] = await Promise.all([
    findMiFitnessOrigin(), todayMiStepsOrigin(range).catch(() => undefined),
  ]);
  const dataOriginFilter = miFitnessOrigin ? [miFitnessOrigin] : undefined;
  const readSteps = async () => {
    if (stepsOrigin) {
      try {
        const preferred = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: range, dataOriginFilter: [stepsOrigin] });
        if (Number.isFinite(preferred.COUNT_TOTAL) && preferred.COUNT_TOTAL > 0) return { total: preferred.COUNT_TOTAL, preferred: true };
      } catch { /* A missing/failed preferred aggregate must not hide other steps. */ }
    }
    const fallback = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: range });
    return { total: fallback.COUNT_TOTAL || 0, preferred: false };
  };
  const [stepsResult, heartResult, sleepResult] = await Promise.all([
    readSteps(),
    aggregateRecord({ recordType: 'HeartRate', timeRangeFilter: range, dataOriginFilter }).catch(() => null),
    readRecords('SleepSession', { timeRangeFilter: lastNightRange(), dataOriginFilter }).catch(() => ({ records: [] })),
  ]);
  const sleepMinutes = sleepResult.records.reduce((sum, record) => {
    const duration = new Date(record.endTime).getTime() - new Date(record.startTime).getTime();
    return sum + Math.max(0, duration / 60000);
  }, 0);
  return {
    steps: Math.max(0, Math.round(stepsResult.total)),
    sleepMinutes: Math.round(sleepMinutes),
    averageBpm: Math.round(heartResult?.BPM_AVG || 0),
    sourceLabel: stepsResult.preferred ? 'Mi Fitness via Health Connect' : 'Health Connect',
  };
}
