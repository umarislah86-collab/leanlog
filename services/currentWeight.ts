import AsyncStorage from '@react-native-async-storage/async-storage';
import { fsSetSettings } from '../firebase';
import type { UserProfile, WeightEntry } from '../types';

export function latestLoggedWeight(rows: WeightEntry[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let latest: WeightEntry | null = null;
  let latestDay = -Infinity;
  for (const row of rows) {
    if (!row || !Number.isFinite(row.weight) || row.weight <= 0 || typeof row.date !== 'string') continue;
    const parts = row.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!parts) continue;
    const [, day, month, year] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    const time = date.getTime();
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || time > today) continue;
    if (time > latestDay || time === latestDay && Number(row.id) > Number(latest?.id)) { latest = row; latestDay = time; }
  }
  return latest?.weight ?? null;
}
export function profileWithLoggedWeight(profile: UserProfile, rows: WeightEntry[], now = new Date()): UserProfile {
  const weight = latestLoggedWeight(rows, now);
  return weight === null || weight === profile.weight ? profile : { ...profile, weight };
}
/** Called after the weight history is saved; never creates an incomplete profile. */
export async function syncProfileWeight(rows: WeightEntry[]) {
  const raw = await AsyncStorage.getItem('user_profile');
  if (!raw) return null;
  const original: UserProfile = JSON.parse(raw);
  const profile = profileWithLoggedWeight(original, rows);
  if (profile !== original) {
    await AsyncStorage.setItem('user_profile', JSON.stringify(profile));
    void fsSetSettings({ profile }).catch(console.warn);
  }
  return profile;
}
