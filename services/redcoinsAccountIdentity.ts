import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RedCoinsAccount, RedCoinsEntry, RedCoinsState } from './redcoins';

const key = (name: string) => name.trim().toLocaleLowerCase();
type ImportedAccount = Pick<RedCoinsAccount, 'name' | 'sourceAccountId'>;
type ImportedEntry = Pick<RedCoinsEntry, 'id' | 'account' | 'toAccount' | 'sourceAccountId' | 'sourceToAccountId'>;

/** No fuzzy account-name or balance matching. Legacy inference requires stable transaction IDs. */
export function reconcileAccountIdentity(original: RedCoinsState, incoming: ImportedAccount[], importedEntries: ImportedEntry[]) {
  const state: RedCoinsState = JSON.parse(JSON.stringify(original));
  const sources = new Map(incoming.filter(a => a.sourceAccountId).map(a => [a.sourceAccountId!, a]));
  const byName = new Map(incoming.map(a => [key(a.name), a]));
  const entriesById = new Map(importedEntries.map(entry => [entry.id, entry]));
  const evidence = new Map<string, Set<string>>();
  const record = (name: string | undefined, sourceId: string | undefined) => {
    if (!name || !sourceId || !sources.has(sourceId)) return;
    const candidates = evidence.get(key(name)) || new Set<string>();
    candidates.add(sourceId); evidence.set(key(name), candidates);
  };
  for (const entry of state.entries) {
    // Edited imported transactions can intentionally point to a replacement
    // local account. They are NOT evidence that the replacement is the import.
    if (entry.origin !== 'bluecoins' || entry.editedAt) continue;
    const current = entriesById.get(entry.id);
    if (!current) continue;
    record(entry.account, current.sourceAccountId || byName.get(key(current.account))?.sourceAccountId);
    if (entry.type === 'transfer' && current.toAccount) record(entry.toAccount, current.sourceToAccountId || byName.get(key(current.toAccount))?.sourceAccountId);
  }
  const infer = (name: string) => {
    const candidates = evidence.get(key(name));
    const exact = byName.get(key(name))?.sourceAccountId;
    if (candidates && (candidates.size !== 1 || exact && !candidates.has(exact))) return undefined;
    return candidates?.values().next().value || exact;
  };
  const blocked = new Set(state.deletedSourceAccountIds || []);
  for (const name of state.deletedAccountNames || []) { const sourceId = infer(name); if (sourceId) blocked.add(sourceId); }
  state.deletedSourceAccountIds = [...blocked];
  const groups = new Map<string, RedCoinsAccount[]>();
  const untouched: RedCoinsAccount[] = [];
  for (const account of state.accounts) {
    const sourceId = account.sourceAccountId || infer(account.name);
    if (!sourceId || !sources.has(sourceId)) { untouched.push(account); continue; }
    account.sourceAccountId = sourceId;
    const group = groups.get(sourceId) || []; group.push(account); groups.set(sourceId, group);
  }
  const aliases: Record<string, string> = {};
  const redirects: Record<string, string> = {};
  state.accounts = [...untouched];
  for (const [sourceId, group] of groups) {
    const source = sources.get(sourceId)!;
    if (blocked.has(sourceId)) continue;
    // Prefer the pre-rename account when a prior buggy sync created a second
    // copy. Keep its local ID, so Daily widget selection remains attached.
    group.sort((a, b) => Number(key(a.name) === key(source.name)) - Number(key(b.name) === key(source.name)));
    const canonical = { ...group[0], name: group[0].editedAt ? group[0].name : source.name };
    canonical.icon ||= group.find(account => account.icon)?.icon;
    for (const account of group) {
      if (account.name !== canonical.name) aliases[key(account.name)] = canonical.name;
      if (account.id !== canonical.id) redirects[account.id] = canonical.id;
    }
    if (source.name !== canonical.name) aliases[key(source.name)] = canonical.name;
    state.accounts.push(canonical);
  }
  const rename = (name?: string) => name ? aliases[key(name)] || name : name;
  state.entries = state.entries.map(entry => ({ ...entry, account: rename(entry.account)!, toAccount: rename(entry.toAccount) }));
  state.deletedEntries = (state.deletedEntries || []).map(entry => ({ ...entry, account: rename(entry.account)! }));
  state.reminders = state.reminders.map(reminder => ({ ...reminder, template: { ...reminder.template, account: rename(reminder.template.account)!, toAccount: rename(reminder.template.toAccount) } }));
  state.entryDefaults = Object.fromEntries(Object.entries(state.entryDefaults || {}).map(([type, defaults]) => [type, { ...defaults, account: rename(defaults?.account), toAccount: rename(defaults?.toAccount) }]));
  if (state.favoriteAccountIds !== undefined) state.favoriteAccountIds = [...new Set(state.favoriteAccountIds.map(id => redirects[id] || id))].filter(id => state.accounts.some(account => account.id === id));
  if (state.bankReviews) {
    const reviews: NonNullable<RedCoinsState['bankReviews']> = {};
    for (const [id, review] of Object.entries(state.bankReviews)) {
      const target = redirects[id] || id;
      if (!state.accounts.some(account => account.id === target)) continue;
      if (!reviews[target] || review.savedAt > reviews[target].savedAt) reviews[target] = review;
    }
    state.bankReviews = reviews;
  }
  return { state, aliases, redirects };
}

/** Update only account-reference fields, never arbitrary note/title strings. */
export async function migrateAccountPreferences(aliases: Record<string, string>, redirects: Record<string, string>) {
  if (!Object.keys(aliases).length && !Object.keys(redirects).length) return;
  const rename = (name: string) => aliases[key(name)] || name;
  for (const storageKey of await AsyncStorage.getAllKeys()) {
    const daily = storageKey.startsWith('widget_daily_preferences_');
    const snapshot = storageKey.startsWith('widget_account_snapshot_');
    const cash = storageKey === 'bluecoins_cash_reality_accounts_v1';
    const guards = storageKey === 'bluecoins_spending_guards_v1';
    if (!daily && !snapshot && !cash && !guards) continue;
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) continue;
    if (snapshot) { const next = rename(raw); if (next !== raw) await AsyncStorage.setItem(storageKey, next); continue; }
    let value: any;
    try { value = JSON.parse(raw); } catch { continue; }
    if (cash && Array.isArray(value)) value = [...new Set(value.filter(name => typeof name === 'string').map(rename))];
    if (daily && Array.isArray(value?.accountIds)) value = { ...value, accountIds: [...new Set(value.accountIds.map((id: string) => redirects[id] || id))] };
    if (guards && Array.isArray(value)) value = value.map(guard => guard.scope === 'account' && typeof guard.target === 'string' ? { ...guard, target: rename(guard.target), name: key(guard.name || '') === key(guard.target) ? rename(guard.name) : guard.name } : guard);
    const next = JSON.stringify(value);
    if (next !== raw) await AsyncStorage.setItem(storageKey, next);
  }
}
