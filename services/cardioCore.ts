export type CardioMode = 'walk' | 'jog' | 'run';
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
};
export const cardioNames: Record<CardioMode, string> = { walk: 'Brisk walk', jog: 'Jog', run: 'Run' };
// 2024 Adult Compendium: brisk walk 17200, jogging 12020, running 12045.
// Total energy estimate; distance/pace is displayed separately, not invented.
export const cardioMET: Record<CardioMode, number> = { walk: 4.8, jog: 7.5, run: 9.0 };
export const defaultCardioConfig: CardioConfig = {
  mode: 'walk', gps: true, goal: 'time', target: 30, intervals: null, voice: true, vibrate: true, keepAwake: false,
};
export function validateCardioConfig(config: CardioConfig) {
  if (!['walk', 'jog', 'run'].includes(config.mode) || !['free', 'time', 'distance'].includes(config.goal)) throw Error('Choose an activity and target.');
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
    tracking: 'off', distanceM: 0, lastFix: null, route: [], splits: [], speedMps: 0, goalAnnounced: false };
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
  let metSeconds = seconds * cardioMET[session.config.mode];
  if (i) {
    const cycle = i.walkSeconds + i.effortSeconds, planned = Math.min(seconds, cycle * i.rounds), rounds = Math.floor(planned / cycle), remainder = planned % cycle;
    const walk = rounds * i.walkSeconds + Math.min(remainder, i.walkSeconds);
    const effort = planned - walk;
    metSeconds = walk * cardioMET.walk + (effort + Math.max(0, seconds - planned)) * cardioMET[session.config.mode];
  }
  return Math.max(0, Math.round(metSeconds / 60 * 3.5 * session.weightKg / 200));
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
  const limit = { walk: 3.5, jog: 6, run: 12 }[session.config.mode];
  if (metres / seconds > limit) return anchor;
  if (metres < Math.max(5, (fix.accuracy + previous.accuracy) * 0.5)) return session;
  const distanceM = session.distanceM + metres, elapsedSeconds = elapsedCardioMs(session, fix.timestamp) / 1000;
  const splits = [...session.splits];
  const previousElapsed = elapsedCardioMs(session, previous.timestamp) / 1000;
  for (let km = Math.floor(session.distanceM / 1000) + 1; km <= Math.floor(distanceM / 1000); km++) {
    const crossing = previousElapsed + (elapsedSeconds - previousElapsed) * ((km * 1000 - session.distanceM) / metres);
    splits.push({ km, elapsedSeconds: crossing, seconds: crossing - (splits.at(-1)?.elapsedSeconds || 0) });
  }
  return { ...session, distanceM, lastFix: fix, speedMps: metres / seconds, splits, route: [...session.route.slice(-2999), fix] };
}
export function cardioClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function cardioPace(secondsPerKm: number | null) {
  const rounded = Math.round(secondsPerKm || 0);
  return rounded > 0 && Number.isFinite(rounded) ? `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}` : '—';
}
