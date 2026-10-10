import AsyncStorage from '@react-native-async-storage/async-storage';
import { fsUpsert, fsFetchAll } from '../firebase';
import type { FoodEntry, UserProfile } from '../types';

export const PROTEIN_HISTORY_KEY = 'protein_target_history_v1';
export const proteinDayKey = (date = new Date()) => `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
export function proteinTarget(profile: UserProfile | null, calories = 2000) {
  if (!profile) return Math.round(calories * .25 / 4);
  const settings = profile.protein;
  const weight = settings?.referenceWeight ?? profile.weight;
  if (settings?.mode === 'fixed') return Math.round(settings.grams || 0);
  const factor = settings?.mode === 'strength' ? 1.6 : settings?.mode === 'factor' ? settings.factor ?? 1.2 : 1.2;
  return Math.round(weight * factor);
}
export function validateProteinSettings(settings: NonNullable<UserProfile['protein']>, weight: number, calories: number) {
  if (!['auto', 'strength', 'factor', 'fixed'].includes(settings.mode)) throw new Error('Pilih mode protein.');
  if (settings.referenceWeight !== undefined && (!Number.isFinite(settings.referenceWeight) || settings.referenceWeight <= 0)) throw new Error('Berat rujukan mesti nombor positif.');
  if (settings.mode === 'factor' && (!Number.isFinite(settings.factor) || settings.factor! < .1 || settings.factor! > 3)) throw new Error('Faktor protein mesti antara 0.1 dan 3.');
  const target = proteinTarget({ weight, protein: settings } as UserProfile);
  if (!Number.isFinite(target) || target <= 0 || target * 4 >= calories) throw new Error('Semak target protein: mesti positif dan tinggalkan ruang dalam target kalori untuk karbohidrat/lemak.');
}
export function macroTargets(profile: UserProfile | null, calories: number) {
  const protein = proteinTarget(profile, calories);
  const remaining = Math.max(0, calories - protein * 4);
  return { protein, carbs: Math.round(remaining * .6 / 4), fat: Math.round(remaining * .4 / 9) };
}
export type ProteinHistory = Record<string, { target: number; weight: number; capturedAt: string }>;
export async function loadProteinHistory(): Promise<ProteinHistory> {
  const raw = await AsyncStorage.getItem(PROTEIN_HISTORY_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    const history: ProteinHistory = {};
    for (const [key, value] of Object.entries(parsed || {})) {
      const row = value as ProteinHistory[string];
      if (row && Number.isFinite(row.target) && row.target > 0) history[key] = row;
    }
    return history;
  }
  const records = await fsFetchAll<any>('proteinTargets');
  const history: ProteinHistory = {};
  for (const row of records) if (typeof row.date === 'string' && Number.isFinite(row.target) && row.target > 0) history[row.date] = { target: row.target, weight: row.weight, capturedAt: row.capturedAt };
  return history;
}
let writes: Promise<unknown> = Promise.resolve();
export function snapshotProteinTarget(profile: UserProfile, date = new Date()): Promise<ProteinHistory> {
  const key = proteinDayKey(date), target = proteinTarget(profile);
  const work = async () => {
    const history = await loadProteinHistory();
    if (history[key]?.target !== target && Number.isFinite(target) && target > 0) {
      history[key] = { target, weight: profile.protein?.referenceWeight ?? profile.weight, capturedAt: date.toISOString() };
      await AsyncStorage.setItem(PROTEIN_HISTORY_KEY, JSON.stringify(history));
      void fsUpsert('proteinTargets', key.replace(/\//g, '-'), { date: key, ...history[key] }).catch(console.warn);
    }
    return history;
  };
  const result = writes.catch(() => {}).then(work); writes = result.catch(() => {}); return result;
}
export function proteinForDay(food: FoodEntry[], key: string) {
  const rows = food.filter(row => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(row.date)) { const [year, month, day] = row.date.split('-').map(Number); return `${day}/${month}/${year}` === key; }
    const parts = row.date.split('/').map(Number);
    return parts.length === 3 && `${parts[0]}/${parts[1]}/${parts[2]}` === key;
  });
  const protein = rows.reduce((sum, row) => sum + (row.items || []).reduce((total, item) => total + (Number.isFinite(item.protein) && item.protein > 0 ? item.protein : 0), 0), 0);
  return { rows, protein: Math.round(protein * 10) / 10 };
}
export function proteinLevel(logged: boolean, protein: number, target?: number) {
  if (!logged) return 'unlogged';
  if (!target || target <= 0) return 'unknown';
  const fraction = protein / target;
  return fraction >= 1 ? 'met' : fraction >= .8 ? 'close' : fraction >= .5 ? 'medium' : 'low';
}
