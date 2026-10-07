import type { RedCoinsState } from './redcoins';

export const BACKUP_PREFERENCE_KEYS = [
  'bluecoins_monthly_budget_v1', 'bluecoins_payday_v1', 'bluecoins_cash_reality_buffer_v1',
  'bluecoins_cash_reality_accounts_v1', 'bluecoins_cash_reality_accounts_initialised_v1',
  'bluecoins_fixed_commitments_v1', 'bluecoins_spending_guards_v1',
  'bluecoins_spending_guards_initialised_v1', 'bluecoins_pinned_spending_guard_v1',
] as const;
export interface RedCoinsBackup { format: 'redcoins-backup'; version: 1; exportedAt: string; state: RedCoinsState; preferences?: Record<string, string> }
const object = (value: any) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validDate = (value: any) => typeof value === 'string' && Number.isFinite(new Date(value).getTime());
const text = (value: any) => typeof value === 'string';
const finite = (value: any) => typeof value === 'number' && Number.isFinite(value);
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function safeKeys(value: any): void {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    assert(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe backup field.');
    safeKeys(value[key]);
  }
}
export function parseRedCoinsBackup(contents: string): RedCoinsBackup {
  assert(contents.length <= 50 * 1024 * 1024, 'Backup is too large (maximum 50 MB).');
  let data: any;
  try { data = JSON.parse(contents); } catch { throw new Error('Not a valid JSON backup.'); }
  safeKeys(data);
  assert(object(data) && data.format === 'redcoins-backup' && data.version === 1, 'Choose a RedCoins JSON backup, not a Bluecoins file or another app backup.');
  assert(validDate(data.exportedAt), 'Backup export date is invalid.');
  const state = data.state;
  assert(object(state) && Array.isArray(state.accounts) && Array.isArray(state.entries) && Array.isArray(state.categories), 'Backup is missing accounts, transactions or categories.');
  assert(state.storageVersion === undefined || state.storageVersion === 2, 'This backup uses a newer unsupported storage version.');
  assert(finite(state.monthlyBudget) && state.monthlyBudget >= 0 && finite(state.payday) && state.payday >= 1 && state.payday <= 31 && finite(state.safetyBuffer) && state.safetyBuffer >= 0 && validDate(state.createdAt), 'Invalid budget, payday, buffer or creation date.');
  const unique = (rows: any[], label: string) => {
    const ids = new Set<string>();
    rows.forEach(row => { assert(object(row) && text(row.id) && row.id.length > 0 && !ids.has(row.id), `Invalid or duplicate ${label} ID.`); ids.add(row.id); });
  };
  unique(state.accounts, 'account'); unique(state.entries, 'transaction'); unique(state.categories, 'category');
  state.accounts.forEach((account: any) => {
    assert(text(account.name) && account.name.trim() && ['Bank', 'Cash', 'Credit card', 'Investment', 'Liability'].includes(account.type) && finite(account.balance), 'Invalid account name, type or balance.');
    for (const key of ['icon', 'sourceAccountId', 'editedAt']) if (account[key] !== undefined) assert(text(account[key]), `Invalid account ${key}.`);
    for (const key of ['limit', 'cutOffDay', 'dueDay']) if (account[key] !== undefined) assert(finite(account[key]), `Invalid account ${key}.`);
  });
  const entry = (row: any, template = false) => {
    assert(object(row) && ['income', 'expense', 'transfer'].includes(row.type) && text(row.item) && finite(row.amount) && row.amount >= 0 && text(row.account) && text(row.category) && text(row.subcategory), 'Invalid transaction fields.');
    if (!template) assert(validDate(row.date), 'Invalid transaction date.');
    if (row.type === 'transfer') assert(text(row.toAccount) && row.toAccount.trim(), 'Transfer is missing its destination account.');
    if (row.status !== undefined) assert(['none', 'cleared', 'pending', 'reconciled', 'void'].includes(row.status), 'Invalid transaction review status.');
    if (row.balanceEffectApplied !== undefined) assert(typeof row.balanceEffectApplied === 'boolean', 'Invalid transaction balance marker.');
    if (row.incomePeriod !== undefined) assert(text(row.incomePeriod) && /^\d{4}-(0[1-9]|1[0-2])$/.test(row.incomePeriod), 'Invalid income period.');
    for (const key of ['note', 'icon', 'sourceAccountId', 'sourceToAccountId', 'editedAt']) if (row[key] !== undefined) assert(text(row[key]), `Invalid ${key}.`);
    for (const key of ['labels', 'notificationIds', 'consumedOccurrenceKeys']) if (row[key] !== undefined) assert(Array.isArray(row[key]) && row[key].every(text), `Invalid ${key}.`);
  };
  state.entries.forEach((row: any) => entry(row));
  state.categories.forEach((category: any) => {
    assert(text(category.name) && Array.isArray(category.subcategories) && category.subcategories.every(text), 'Invalid category.');
    if (category.icon !== undefined) assert(text(category.icon), 'Invalid category icon.');
    if (category.subcategoryIcons !== undefined) assert(object(category.subcategoryIcons) && Object.values(category.subcategoryIcons).every(text), 'Invalid subcategory icons.');
    if (category.subcategoryTypes !== undefined) assert(object(category.subcategoryTypes) && Object.values(category.subcategoryTypes).every(types => Array.isArray(types) && types.every(type => ['income', 'expense'].includes(type))), 'Invalid subcategory types.');
  });
  state.reminders ||= [];
  assert(Array.isArray(state.reminders), 'Invalid reminder list.'); unique(state.reminders, 'reminder');
  state.reminders.forEach((reminder: any) => {
    assert(typeof reminder.enabled === 'boolean' && typeof reminder.automaticLog === 'boolean' && ['daily', 'weekly', 'monthly', 'yearly'].includes(reminder.frequency) && validDate(reminder.startDate) && finite(reminder.repeatEvery) && reminder.repeatEvery >= 1, 'Invalid reminder schedule.');
    entry(reminder.template, true);
    assert(['never', 'date', 'occurrences'].includes(reminder.endType) && ['before', 'after'].includes(reminder.weekendMove) && typeof reminder.excludeWeekend === 'boolean', 'Invalid reminder recurrence options.');
    if (reminder.endType === 'date') assert(validDate(reminder.endDate), 'Invalid reminder end date.');
    if (reminder.endType === 'occurrences') assert(finite(reminder.occurrences) && reminder.occurrences >= 1, 'Invalid reminder occurrence count.');
    if (reminder.consumedOccurrenceKeys !== undefined) assert(Array.isArray(reminder.consumedOccurrenceKeys) && reminder.consumedOccurrenceKeys.every(text), 'Invalid consumed reminder occurrences.');
    // Device notification IDs must never be restored onto another installation.
    delete reminder.notificationIds;
  });
  for (const key of ['deletedEntries', 'trash', 'exportBatches', 'deletedAccountNames', 'deletedSourceAccountIds', 'deletedCategoryNames', 'favoriteAccountIds']) if (state[key] !== undefined) assert(Array.isArray(state[key]), `Invalid ${key}.`);
  if (state.favoriteAccountIds) assert(state.favoriteAccountIds.every(text), 'Invalid favorite account IDs.');
  for (const key of ['deletedAccountNames', 'deletedSourceAccountIds', 'deletedCategoryNames']) if (state[key]) assert(state[key].every(text), `Invalid ${key}.`);
  if (state.trash) state.trash.forEach((row: any) => entry(row));
  if (state.deletedEntries) state.deletedEntries.forEach((row: any) => assert(object(row) && text(row.id) && text(row.item) && text(row.account) && validDate(row.date) && finite(row.amount) && ['income', 'expense', 'transfer'].includes(row.type), 'Invalid deletion marker.'));
  if (state.exportBatches) state.exportBatches.forEach((batch: any) => assert(object(batch) && text(batch.id) && validDate(batch.createdAt) && Array.isArray(batch.entryIds) && batch.entryIds.every(text), 'Invalid export batch.'));
  for (const key of ['subcategoryBudgets', 'deletedSubcategories', 'entryDefaults', 'bankReviews', 'analysisExpenseClasses']) if (state[key] !== undefined) assert(object(state[key]), `Invalid ${key}.`);
  if (state.subcategoryBudgets) Object.values(state.subcategoryBudgets).forEach(value => assert(finite(value) && Number(value) >= 0, 'Invalid subcategory budget.'));
  if (state.termBudgets !== undefined) {
    assert(Array.isArray(state.termBudgets), 'Invalid period budgets.');
    unique(state.termBudgets, 'period budget');
    state.termBudgets.forEach((b: any) => {
      const day = (value: any) => { if (!text(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const [y,m,d] = value.split('-').map(Number); const date = new Date(y,m-1,d); return date.getFullYear() === y && date.getMonth() === m-1 && date.getDate() === d; };
      assert(object(b) && text(b.id) && text(b.category) && (b.subcategory === undefined || text(b.subcategory)) && finite(b.amount) && b.amount > 0 && day(b.startDay) && day(b.endDay) && b.endDay >= b.startDay && ['repeat','carryForward','reserve'].every(key => typeof b[key] === 'boolean') && (b.months === undefined || Number.isInteger(b.months) && b.months >= 1 && b.months <= 120), 'Invalid period budget.');
    });
  }
  if (state.bankReviews) Object.values(state.bankReviews).forEach((review: any) => assert(object(review) && text(review.startDay) && text(review.endDay) && text(review.bankBalance) && text(review.savedAt) && object(review.matched) && Object.values(review.matched).every(text), 'Invalid saved bank review.'));
  if (state.deletedSubcategories) assert(Object.values(state.deletedSubcategories).every(rows => Array.isArray(rows) && rows.every(text)), 'Invalid deleted subcategories.');
  if (state.analysisExpenseClasses) assert(Object.values(state.analysisExpenseClasses).every(value => ['protected', 'flexible', 'unconfirmed'].includes(String(value))), 'Invalid expense classifications.');
  if (state.entryDefaults) Object.values(state.entryDefaults).forEach((defaults: any) => assert(object(defaults) && text(defaults.account) && text(defaults.category) && text(defaults.subcategory) && (defaults.toAccount === undefined || text(defaults.toAccount)), 'Invalid logger defaults.'));
  if (state.reportPreferences !== undefined) assert(object(state.reportPreferences) && ['salary-cycle', 'custom'].includes(state.reportPreferences.mode) && ['salarySource', 'customStart', 'customEnd'].every(key => text(state.reportPreferences[key])), 'Invalid report preferences.');
  if (state.importSnapshot !== undefined) assert(object(state.importSnapshot) && text(state.importSnapshot.sourceName) && validDate(state.importSnapshot.importedAt) && Array.isArray(state.importSnapshot.entries) && state.importSnapshot.entries.every((row: any) => object(row) && text(row.id)), 'Invalid import snapshot.');
  if (data.preferences !== undefined) {
    assert(object(data.preferences), 'Invalid backup preferences.');
    for (const [key, value] of Object.entries(data.preferences)) {
      assert((BACKUP_PREFERENCE_KEYS as readonly string[]).includes(key) && text(value), 'Backup contains unsupported settings.');
      if (key.includes('accounts_v1') || key.includes('commitments')) { const parsed = JSON.parse(value as string); assert(Array.isArray(parsed) && parsed.every(text), 'Invalid account/commitment settings.'); }
      if (key.includes('guards_v1')) { const guards = JSON.parse(value as string); assert(Array.isArray(guards) && guards.every((guard: any) => object(guard) && text(guard.id) && text(guard.name) && text(guard.target) && finite(guard.limit) && typeof guard.enabled === 'boolean' && ['normal', 'firm', 'karen'].includes(guard.tone) && ['account', 'category', 'subcategory'].includes(guard.scope) && ['salary', 'calendar'].includes(guard.cycle) && Array.isArray(guard.thresholds) && guard.thresholds.every(finite)), 'Invalid spending guards.'); }
      if (key.endsWith('initialised_v1')) assert(value === 'true' || value === 'false', 'Invalid settings marker.');
      if (['bluecoins_monthly_budget_v1', 'bluecoins_cash_reality_buffer_v1', 'bluecoins_payday_v1'].includes(key)) assert(Number.isFinite(Number(value)) && Number(value) >= 0, 'Invalid budget setting.');
    }
  }
  return data as RedCoinsBackup;
}
