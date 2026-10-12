export type CardioMode = 'auto' | 'walk' | 'jog' | 'run';
export type CardioConfig = {
  mode: CardioMode; gps: boolean; goal: 'free' | 'time' | 'distance'; target: number;
  intervals: { walkSeconds: number; effortSeconds: number; rounds: number } | null;
  voice: boolean; vibrate: boolean; keepAwake: boolean;
};
export type CardioFix = { latitude: number; longitude: number; accuracy: number; timestamp: number; speed?: number };
export type CardioSession = {
  id: string; config: CardioConfig; weightKg: number; startedAt: number; endedAt?: number;
  status: 'running' | 'paused' | 'finished' | 'saved'; elapsedMs: number; runningSince: number | null;
  tracking: 'off' | 'foreground' | 'background'; distanceM: number; lastFix: CardioFix | null;
  route: CardioFix[]; splits: { km: number; elapsedSeconds: number; seconds: number }[];
  speedMps: number; goalAnnounced: boolean; activityEntryId?: string; manual?: boolean; gpsError?: string;
  calorieVersion?: 2;
  gpsEnergy?: { netMetSeconds: number; seconds: number };
};
export const cardioNames: Record<CardioMode, string> = { auto: 'Walk / Jog / Run', walk: 'Brisk walk', jog: 'Jog', run: 'Run' };
// 2024 Adult Compendium: brisk walk 17200, jogging 12020, running 12045.
// Timer-only fallback. New estimates subtract resting energy; legacy sessions
// retain their original total-energy calculation so saved history stays stable.
export const cardioMET: Record<CardioMode, number> = { auto: 4.8, walk: 4.8, jog: 7.5, run: 9.0 };
/** Level-ground Compendium speed bands; an approximation, not gait detection.
 * Walking: 17151/17152/17170/17190/17200/17220/17230/17231.
 * Running: 12028 onwards. Below 6.4 km/h use the walking-pace approximation
 * instead of assuming the whole session is general jogging at 7.5 MET.
 */
export function cardioPaceMET(speedKmh: number, mode: CardioMode) {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return 1;
  const walking = speedKmh < 3.2 ? 2.3 : speedKmh < 4 ? 2.8 : speedKmh < 4.5 ? 3 : speedKmh < 5.6 ? 3.8 : speedKmh < 6.4 ? 4.8 : speedKmh < 7.2 ? 5.5 : speedKmh < 8 ? 7 : 8.5;
  if (mode === 'walk' || speedKmh < 6.4) return walking;
  return speedKmh < 6.9 ? 6.5 : speedKmh < 8 ? 7.8 : speedKmh < 8.8 ? 8.5 : speedKmh < 9.6 ? 9 : speedKmh < 10.4 ? 9.3 : speedKmh < 11.2 ? 10.5 : speedKmh < 12 ? 11 : speedKmh < 12.8 ? 11.8 : speedKmh < 13.6 ? 12 : speedKmh < 14.4 ? 12.5 : speedKmh < 15.2 ? 13 : speedKmh < 16.8 ? 14.8 : speedKmh < 17.6 ? 16.8 : 18.5;
}
export const defaultCardioConfig: CardioConfig = {
  mode: 'auto', gps: true, goal: 'time', target: 30, intervals: null, voice: true, vibrate: true, keepAwake: false,
};
export function validateCardioConfig(config: CardioConfig) {
  if (!['auto', 'walk', 'jog', 'run'].includes(config.mode) || !['free', 'time', 'distance'].includes(config.goal)) throw Error('Choose an activity and target.');
  if (config.goal !== 'free' && (!Number.isFinite(config.target) || config.target < (config.goal === 'time' ? 1 : 0.1) || config.target > (config.goal === 'time' ? 600 : 100))) throw Error('Target: 1–600 minutes or 0.1–100 km.');
  if (config.goal === 'distance' && !config.gps) throw Error('A distance target needs GPS. Choose a time target for timer-only sessions.');
  const i = config.intervals;
  if (i && (!Number.isInteger(i.rounds) || i.rounds < 1 || i.rounds > 30 || ![i.walkSeconds, i.effortSeconds].every(n => Number.isFinite(n) && n >= 10 && n <= 900))) throw Error('Intervals: 10–900 seconds each, 1–30 rounds.');
}
export function elapsedCardioMs(session: CardioSession, now = Date.now()) {
  return Math.max(0, session.elapsedMs + (session.status === 'running' && session.runningSince !== null ? Math.max(0, now - session.runningSince) : 0));
}
export function createCardioSession(config: CardioConfig, weightKg: number, now = Date.now()): CardioSession {
  validateCardioConfig(config);
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw Error('Update your current body weight in Profile before starting.');
  return { id: `cardio_${now}_${Math.random().toString(36).slice(2, 8)}`, config, weightKg, startedAt: now, status: 'running', elapsedMs: 0, runningSince: now,
    tracking: 'off', distanceM: 0, lastFix: null, route: [], splits: [], speedMps: 0, goalAnnounced: false,
    calorieVersion: 2, gpsEnergy: { netMetSeconds: 0, seconds: 0 } };
}
export function transitionCardio(session: CardioSession, action: 'pause' | 'resume' | 'finish', now = Date.now()): CardioSession {
  if (session.status === 'finished' || session.status === 'saved') return session;
  if (action === 'pause' && session.status === 'running') return { ...session, status: 'paused', elapsedMs: elapsedCardioMs(session, now), runningSince: null, lastFix: null, speedMps: 0 };
  if (action === 'resume' && session.status === 'paused') return { ...session, status: 'running', runningSince: now, lastFix: null };
  if (action === 'finish') return { ...session, status: 'finished', endedAt: now, elapsedMs: elapsedCardioMs(session, now), runningSince: null, lastFix: null, speedMps: 0 };
  return session;
}
export function cardioPhase(session: CardioSession, now = Date.now()) {
  const seconds = elapsedCardioMs(session, now) / 1000, i = session.config.intervals;
  if (!i) return { mode: session.config.mode, key: 'free', round: 0, remaining: 0, done: false };
  const cycle = i.walkSeconds + i.effortSeconds;
  if (seconds >= cycle * i.rounds) return { mode: session.config.mode, key: 'done', round: i.rounds, remaining: 0, done: true };
  const round = Math.floor(seconds / cycle), within = seconds % cycle, walking = within < i.walkSeconds;
  return { mode: walking ? 'walk' as const : session.config.mode, key: `${round}-${walking ? 'walk' : 'effort'}`, round: round + 1,
    remaining: Math.ceil((walking ? i.walkSeconds : cycle) - within), done: false };
}
export function cardioCalories(session: CardioSession, now = Date.now()) {
  const seconds = elapsedCardioMs(session, now) / 1000, i = session.config.intervals;
  if (session.calorieVersion === 2 && session.config.gps && !session.manual) {
    // Count accepted GPS segments only. Do not invent high-intensity energy
    // while stationary, waiting for a fix, or during a GPS outage.
    return Math.max(0, Math.round((session.gpsEnergy?.netMetSeconds || 0) / 60 * 3.5 * session.weightKg / 200));
  }
  if (session.calorieVersion === 2 && !session.config.gps) {
    if (session.distanceM <= 0 || seconds <= 0) return 0;
    const met = cardioPaceMET(session.distanceM / seconds * 3.6, 'auto');
    return Math.max(0, Math.round((met - 1) * seconds / 60 * 3.5 * session.weightKg / 200));
  }
  let metSeconds = seconds * cardioMET[session.config.mode];
  if (i) {
    const cycle = i.walkSeconds + i.effortSeconds, planned = Math.min(seconds, cycle * i.rounds), rounds = Math.floor(planned / cycle), remainder = planned % cycle;
    const walk = rounds * i.walkSeconds + Math.min(remainder, i.walkSeconds);
    const effort = planned - walk;
    metSeconds = walk * cardioMET.walk + (effort + Math.max(0, seconds - planned)) * cardioMET[session.config.mode];
  }
  return Math.max(0, Math.round((metSeconds - (session.calorieVersion === 2 ? seconds : 0)) / 60 * 3.5 * session.weightKg / 200));
}
export function cardioGoalProgress(session: CardioSession, now = Date.now()) {
  const { goal, target } = session.config;
  return goal === 'free' ? null : Math.max(0, Math.min(1, goal === 'time' ? elapsedCardioMs(session, now) / (target * 60000) : session.distanceM / (target * 1000)));
}
export function metresBetween(a: CardioFix, b: CardioFix) {
  const r = Math.PI / 180, dLat = (b.latitude - a.latitude) * r, dLng = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function recordCardioFix(session: CardioSession, fix: CardioFix): CardioSession {
  if (session.status !== 'running' || !session.config.gps || !Number.isFinite(fix.timestamp) || fix.timestamp < (session.runningSince ?? session.startedAt) ||
    !Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude) || Math.abs(fix.latitude) > 90 || Math.abs(fix.longitude) > 180 ||
    !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 35) return session;
  const previous = session.lastFix;
  if (previous && fix.timestamp <= previous.timestamp) return session;
  const anchor = { ...session, lastFix: fix, speedMps: 0 };
  if (!previous || fix.timestamp - previous.timestamp > 120000) return { ...anchor, route: [...session.route.slice(-2999), fix] };
  const metres = metresBetween(previous, fix), seconds = (fix.timestamp - previous.timestamp) / 1000;
  const limit = { auto: 12, walk: 3.5, jog: 6, run: 12 }[session.config.mode];
  if (metres / seconds > limit) return anchor;
  if (metres < Math.max(5, (fix.accuracy + previous.accuracy) * 0.5)) return session;
  const distanceM = session.distanceM + metres, elapsedSeconds = elapsedCardioMs(session, fix.timestamp) / 1000;
  const met = cardioPaceMET(metres / seconds * 3.6, 'auto');
  const gpsEnergy = session.calorieVersion === 2 ? {
    netMetSeconds: (session.gpsEnergy?.netMetSeconds || 0) + Math.max(0, met - 1) * seconds,
    seconds: (session.gpsEnergy?.seconds || 0) + seconds,
  } : session.gpsEnergy;
  const splits = [...session.splits];
  const previousElapsed = elapsedCardioMs(session, previous.timestamp) / 1000;
  for (let km = Math.floor(session.distanceM / 1000) + 1; km <= Math.floor(distanceM / 1000); km++) {
    const crossing = previousElapsed + (elapsedSeconds - previousElapsed) * ((km * 1000 - session.distanceM) / metres);
    splits.push({ km, elapsedSeconds: crossing, seconds: crossing - (splits.at(-1)?.elapsedSeconds || 0) });
  }
  return { ...session, distanceM, lastFix: fix, speedMps: metres / seconds, splits, route: [...session.route.slice(-2999), fix], gpsEnergy };
}
export function cardioCalorieNote(session: CardioSession, now = Date.now()) {
  if (session.calorieVersion !== 2) return 'Legacy estimate · total calories from fixed activity intensity, including resting energy.';
  if (session.config.gps && !session.manual) {
    const coverage = Math.min(100, Math.round((session.gpsEnergy?.seconds || 0) / Math.max(1, elapsedCardioMs(session, now) / 1000) * 100));
    return `Estimated active calories from accepted GPS pace and ${session.weightKg} kg. GPS coverage: ${coverage}% of active time; gaps are not filled. Level-ground approximation, not detection of walking versus jogging.`;
  }
  return session.distanceM > 0
    ? 'Estimated active calories from average pace and start weight. A mixed walk/jog session may differ; terrain and heart rate are not measured.'
    : 'Add the distance from your treadmill or watch before saving. Without GPS or distance, active calories cannot be estimated from pace.';
}
export function cardioClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function cardioPace(secondsPerKm: number | null) {
  const rounded = Math.round(secondsPerKm || 0);
  return rounded > 0 && Number.isFinite(rounded) ? `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}` : '—';
}
