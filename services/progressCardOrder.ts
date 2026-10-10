import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROGRESS_CARD_ORDER_KEY = 'leanlog_progress_cards_v1';
export const progressCardIds = ['protein', 'weight', 'timeline', 'brief', 'export', 'calendar'] as const;
export type ProgressCardId = typeof progressCardIds[number];
export function normalizeProgressOrder(value: unknown): ProgressCardId[] {
  const valid = Array.isArray(value) ? value.filter((id): id is ProgressCardId => progressCardIds.includes(id)) : [];
  return [...new Set([...valid, ...progressCardIds])];
}
export function moveProgressCard(order: ProgressCardId[], id: ProgressCardId, direction: -1 | 1): ProgressCardId[] {
  const next = normalizeProgressOrder(order), index = next.indexOf(id), destination = index + direction;
  if (index < 0 || destination < 0 || destination >= next.length) return next;
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}
export async function loadProgressOrder(): Promise<ProgressCardId[]> {
  const raw = await AsyncStorage.getItem(PROGRESS_CARD_ORDER_KEY);
  try { return normalizeProgressOrder(raw ? JSON.parse(raw) : null); }
  catch { return normalizeProgressOrder(null); }
}
export async function saveProgressOrder(order: ProgressCardId[]): Promise<ProgressCardId[]> {
  const normalized = normalizeProgressOrder(order);
  await AsyncStorage.setItem(PROGRESS_CARD_ORDER_KEY, JSON.stringify(normalized));
  return normalized;
}
