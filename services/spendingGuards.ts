import AsyncStorage from '@react-native-async-storage/async-storage';

let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch {}

const GUARDS_KEY = 'bluecoins_spending_guards_v1';
const GUARDS_INITIALISED_KEY = 'bluecoins_spending_guards_initialised_v1';
const ALERT_STATE_KEY = 'bluecoins_spending_guard_alerts_v1';
const CASH_REALITY_ALERT_KEY = 'bluecoins_cash_reality_alert_v1';
export const PINNED_GUARD_KEY = 'bluecoins_pinned_spending_guard_v1';
export const WIDGET_GUARD_KEY = 'widget_spending_guard_snapshot_v1';
export const WIDGET_CASH_REALITY_KEY = 'widget_cash_reality_snapshot_v1';
const CHANNEL = 'spending-guard-v1';

export type GuardScope = 'account' | 'category' | 'subcategory';
export type GuardCycle = 'salary' | 'calendar';
export type GuardTone = 'normal' | 'firm' | 'karen';

export interface SpendingGuard {
  id: string;
  name: string;
  scope: GuardScope;
  target: string;
  limit: number;
  cycle: GuardCycle;
  thresholds: number[];
  tone: GuardTone;
  enabled: boolean;
}

export interface GuardTransaction {
  date: string;
  amount: number;
  category: string;
  subcategory: string;
  note: string;
}

export interface SpendingGuardResult extends SpendingGuard {
  spent: number;
  remaining: number;
  percent: number;
  projected: number;
  level: 'safe' | 'heads-up' | 'slow-down' | 'danger' | 'breached';
  cycleStart: string;
  cycleEnd: string;
  transactions: GuardTransaction[];
  breakdown: { name: string; amount: number; share: number }[];
}

export interface WidgetGuardSnapshot {
  id: string;
  name: string;
  spent: number;
  limit: number;
  remaining: number;
  percent: number;
  level: SpendingGuardResult['level'];
  sourceDate: string;
}

export const defaultCreditCardGuard = (accountName: string): SpendingGuard => ({
  id: `guard_account_${accountName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
  name: accountName,
  scope: 'account',
  target: accountName,
  limit: 1400,
  cycle: 'salary',
  thresholds: [50, 70, 85, 100],
  tone: 'karen',
  enabled: true,
});

export async function loadSpendingGuards(): Promise<SpendingGuard[]> {
  const raw = await AsyncStorage.getItem(GUARDS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function saveSpendingGuards(guards: SpendingGuard[]) {
  await Promise.all([
    AsyncStorage.setItem(GUARDS_KEY, JSON.stringify(guards)),
    AsyncStorage.setItem(GUARDS_INITIALISED_KEY, 'true'),
  ]);
}

export async function ensureDefaultCreditCardGuard(accountNames: string[]) {
  const guards = await loadSpendingGuards();
  if (guards.length || (await AsyncStorage.getItem(GUARDS_INITIALISED_KEY)) === 'true') return guards;
  const platinum = accountNames.find((name) => /platinum/i.test(name))
    || accountNames.find((name) => /credit|card|kad/i.test(name));
  if (!platinum) return guards;
  const seeded = [defaultCreditCardGuard(platinum)];
  await saveSpendingGuards(seeded);
  await AsyncStorage.setItem(PINNED_GUARD_KEY, seeded[0].id);
  return seeded;
}

export const getPinnedSpendingGuardId = () => AsyncStorage.getItem(PINNED_GUARD_KEY);

export async function pinSpendingGuard(id: string | null) {
  if (id) await AsyncStorage.setItem(PINNED_GUARD_KEY, id);
  else await AsyncStorage.removeItem(PINNED_GUARD_KEY);
}

export async function syncPinnedGuardSnapshot(results: SpendingGuardResult[], sourceDate: string) {
  let pinnedId = await getPinnedSpendingGuardId();
  let pinned = results.find((guard) => guard.id === pinnedId && guard.enabled);
  if (!pinned) {
    pinned = results.find((guard) => guard.enabled);
    pinnedId = pinned?.id || null;
    await pinSpendingGuard(pinnedId);
  }
  if (!pinned) {
    await AsyncStorage.removeItem(WIDGET_GUARD_KEY);
    return null;
  }
  const snapshot: WidgetGuardSnapshot = {
    id: pinned.id,
    name: pinned.name,
    spent: pinned.spent,
    limit: pinned.limit,
    remaining: pinned.remaining,
    percent: pinned.percent,
    level: pinned.level,
    sourceDate,
  };
  await AsyncStorage.setItem(WIDGET_GUARD_KEY, JSON.stringify(snapshot));
  return pinned.id;
}

const notificationCopy = (guard: SpendingGuardResult, threshold: number) => {
  const amount = `RM ${guard.spent.toFixed(2)}`;
  const limit = `RM ${guard.limit.toFixed(0)}`;
  if (guard.tone === 'karen') {
    if (threshold >= 100) return [`🚨 ${guard.name}: limit breached`, `${amount} spent. Dah lebih ${limit}. Kad itu bukan duit tambahan, bro.`];
    if (threshold >= 85) return [`💳 ${guard.name}: danger zone`, `${amount} / ${limit}. Kita dah masuk zon “jangan buat-buat tak nampak”.`];
    if (threshold >= 70) return [`Slow down, champion.`, `${guard.name} dah ${guard.percent.toFixed(0)}%. Tinggal RM ${Math.max(0, guard.remaining).toFixed(2)}.`];
    return [`Spending Guard tengah memerhati.`, `${guard.name} dah guna ${guard.percent.toFixed(0)}% daripada ${limit}.`];
  }
  if (guard.tone === 'firm') return [`${guard.name}: ${threshold}% warning`, `${amount} spent daripada limit ${limit}. Baki RM ${Math.max(0, guard.remaining).toFixed(2)}.`];
  return [`Spending update · ${guard.name}`, `${amount} daripada ${limit} (${guard.percent.toFixed(0)}%).`];
};

export async function notifySpendingGuardChanges(results: SpendingGuardResult[]) {
  if (!Notifications) return;
  const permission = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permission?.granted) return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Spending Guard',
    description: 'Bluecoins account and category limit warnings',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
    vibrationPattern: [0, 180, 100, 260],
    sound: 'default',
  }).catch(() => {});
  const raw = await AsyncStorage.getItem(ALERT_STATE_KEY);
  const state: Record<string, string> = raw ? JSON.parse(raw) : {};
  for (const guard of results.filter((item) => item.enabled)) {
    const crossed = [...guard.thresholds].sort((a, b) => b - a).find((threshold) => guard.percent >= threshold);
    if (!crossed) continue;
    const alertKey = `${guard.cycleStart}:${crossed}:${Math.floor(Math.max(0, guard.spent - guard.limit) / 100)}`;
    if (state[guard.id] === alertKey) continue;
    const [title, body] = notificationCopy(guard, crossed);
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { kind: 'spending-guard', guardId: guard.id }, sound: true },
      trigger: null,
    }).catch(() => {});
    state[guard.id] = alertKey;
  }
  await AsyncStorage.setItem(ALERT_STATE_KEY, JSON.stringify(state));
}

export async function requestSpendingGuardNotifications() {
  if (!Notifications) return false;
  const permission = await Notifications.requestPermissionsAsync().catch(() => null);
  return !!permission?.granted;
}

export async function notifyCashRealityRisk(reality: { trueSpendable: number; liquidBalance: number; cardOutstanding: number }, sourceDate: string) {
  if (!Notifications || reality.cardOutstanding <= 0) return;
  const permission = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permission?.granted) return;
  const risk = reality.trueSpendable < 0 ? 'uncovered' : reality.cardOutstanding > reality.liquidBalance * 0.7 ? 'tight' : null;
  if (!risk) return;
  const key = `${sourceDate}:${risk}:${Math.floor(Math.abs(reality.trueSpendable) / 100)}`;
  if ((await AsyncStorage.getItem(CASH_REALITY_ALERT_KEY)) === key) return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Spending Guard', importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true, vibrationPattern: [0, 180, 100, 260], sound: 'default',
  }).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    content: {
      title: risk === 'uncovered' ? '🚨 Bank balance sedang menipu kau.' : '💳 Most of this cash is already spoken for.',
      body: risk === 'uncovered'
        ? `Card debt RM ${reality.cardOutstanding.toFixed(0)} belum fully covered. True cash: -RM ${Math.abs(reality.trueSpendable).toFixed(0)}.`
        : `Bank RM ${reality.liquidBalance.toFixed(0)}, tetapi RM ${reality.cardOutstanding.toFixed(0)} sudah reserved untuk card.`,
      data: { kind: 'cash-reality' }, sound: true,
    },
    trigger: null,
  }).catch(() => {});
  await AsyncStorage.setItem(CASH_REALITY_ALERT_KEY, key);
}
