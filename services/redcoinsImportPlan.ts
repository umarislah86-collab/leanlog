import type { BluecoinsSummary } from './bluecoins';
import type { RedCoinsEntry, RedCoinsState } from './redcoins';
import { reconcileAccountIdentity } from './redcoinsAccountIdentity';

const key = (value: string) => value.trim().toLocaleLowerCase();
const same = (a: RedCoinsEntry, b: RedCoinsEntry) => a.type === b.type && Math.abs(a.amount - b.amount) < .005 && key(a.item) === key(b.item) && key(a.account) === key(b.account) && Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) <= 3 * 86400000;
const effect = (state: RedCoinsState, row: RedCoinsEntry, direction: number, now: Date, eligible?: Set<string>) => {
  if (new Date(row.date) > now) return;
  const source = state.accounts.find(a => a.name === row.account && (!eligible || eligible.has(a.id)));
  const target = state.accounts.find(a => a.name === row.toAccount && (!eligible || eligible.has(a.id)));
  if (source) source.balance += row.amount * direction * (row.type === 'income' ? 1 : -1);
  if (row.type === 'transfer' && target) target.balance += row.amount * direction;
};
export interface RedCoinsImportCounts { added: number; updated: number; removed: number; matched: number; protected: number; newAccounts: number }

/** Import is a staged delta to the live ledger, never a balance rebuild on open. */
export function prepareRedCoinsImport(original: RedCoinsState, incoming: BluecoinsSummary, now = new Date()) {
  if (!incoming.redcoins || !Array.isArray(incoming.redcoins.entries) || !Array.isArray(incoming.redcoins.accounts)) throw new Error('Invalid Bluecoins import');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incoming.sourceDate) || !Number.isFinite(new Date(incoming.sourceDate).getTime())) throw new Error('Invalid backup date');
  const acceptedDate = original.importSnapshot?.sourceDate || original.importedSource?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (acceptedDate && incoming.sourceDate < acceptedDate) throw new Error('This backup is older than your last accepted import. It cannot roll back RedCoins.');
  incoming.redcoins.accounts.forEach(account => {
    if (!account.name?.trim() || !Number.isFinite(account.balance)) throw new Error('Invalid source account');
  });
  const sourceIds = new Set<string>();
  incoming.redcoins.entries.forEach(row => {
    if (!row.id || sourceIds.has(row.id) || !Number.isFinite(row.amount) || row.amount < 0 || !Number.isFinite(new Date(row.date).getTime())) throw new Error('Invalid or duplicate source transaction');
    sourceIds.add(row.id);
  });
  const { state, aliases, redirects } = reconcileAccountIdentity(original, incoming.redcoins.accounts, incoming.redcoins.entries);
  const rename = (name?: string) => name ? aliases[key(name)] || name : name;
  const eligible = new Set(state.accounts.map(a => a.id));
  const counts: RedCoinsImportCounts = { added: 0, updated: 0, removed: 0, matched: 0, protected: 0, newAccounts: 0 };
  const blockedNames = new Set((state.deletedAccountNames || []).map(key)), blockedIds = new Set(state.deletedSourceAccountIds || []);
  incoming.redcoins.accounts.forEach(account => {
    if (blockedNames.has(key(account.name)) || account.sourceAccountId && blockedIds.has(account.sourceAccountId)) return;
    if (state.accounts.some(a => account.sourceAccountId && a.sourceAccountId === account.sourceAccountId || key(a.name) === key(account.name))) return;
    state.accounts.push({ ...account, id: `import-account-${account.sourceAccountId || account.name}-${now.getTime()}` }); counts.newAccounts++;
  });
  // A new source account starts at the imported balance; deltas are applied
  // only to existing accounts, whose saved balance (including adjustments) wins.
  const blockedCategories = new Set((state.deletedCategoryNames || []).map(key));
  incoming.redcoins.categories.forEach(category => {
    if (blockedCategories.has(key(category.name))) return;
    const blockedSubs = new Set((state.deletedSubcategories?.[key(category.name)] || []).map(key));
    const existing = state.categories.find(c => key(c.name) === key(category.name));
    if (!existing) state.categories.push({ ...category, subcategories: category.subcategories.filter(sub => !blockedSubs.has(key(sub))), id: `import-category-${category.name}-${now.getTime()}`, icon: 'grid' });
    else {
      existing.subcategories = [...new Set([...existing.subcategories, ...category.subcategories.filter(sub => !blockedSubs.has(key(sub)))])];
      existing.subcategoryTypes = { ...category.subcategoryTypes, ...existing.subcategoryTypes };
    }
  });
  const incomingRows: RedCoinsEntry[] = incoming.redcoins.entries.map(row => ({ ...row, account: rename(row.account)!, toAccount: rename(row.toAccount), balanceEffectApplied: new Date(row.date) <= now }));
  const deleted = [...(state.deletedEntries || []), ...(state.trash || [])];
  const deletedIds = new Set(deleted.flatMap(row => [row.id, row.reconciledImportId || '']));
  const byId = new Map(state.entries.map(row => [row.id, row]));
  const own = state.entries.filter(row => row.origin !== 'bluecoins');
  const usedOwn = new Set<string>();
  const previousSnapshot = new Map((state.importSnapshot?.entries || []).map(row => [row.id, row]));
  const futureSourceEnd = new Date(`${incoming.sourceDate}T23:59:59.999`);
  // Imported account balances are as of the backup date. Bring newly created
  // accounts forward to now without applying future entries twice.
  const newAccounts = { ...state, accounts: state.accounts.filter(a => !eligible.has(a.id)) };
  incomingRows.filter(row => new Date(row.date) > futureSourceEnd && new Date(row.date) <= now).forEach(row => effect(newAccounts, row, 1, now));
  incomingRows.filter(row => new Date(row.date) > now && new Date(row.date) <= futureSourceEnd).forEach(row => effect(newAccounts, { ...row, date: now.toISOString() }, -1, now));
  for (const row of incomingRows) {
    if (deletedIds.has(row.id) || deleted.some(marker => (!marker.duplicateOfId || marker.exportedAt) && same(marker as RedCoinsEntry, row))) { effect(newAccounts, row, -1, now); counts.protected++; continue; }
    const stable = own.find(local => !usedOwn.has(local.id) && local.reconciledImportId === row.id);
    const possible = own.filter(local => !usedOwn.has(local.id) && (!local.duplicateOfId || local.exportedAt && row.id !== (own.find(original => original.id === local.duplicateOfId)?.reconciledImportId || local.duplicateOfId)) && same(local, row));
    const originals = possible.filter(local => !local.duplicateOfId);
    const candidates = stable ? [stable] : originals.length ? originals : possible;
    if (candidates.length > 1) { effect(newAccounts, row, -1, now); counts.protected++; continue; }
    if (candidates.length === 1) {
      const local = candidates[0]; usedOwn.add(local.id); local.reconciledImportId = row.id;
      counts.matched++;
      // Preserve local values and their already-applied effects. Newly added
      // imported accounts, however, need their raw matched effect removed.
      effect(newAccounts, row, -1, now);
      effect(newAccounts, local, 1, now);
      const old = byId.get(row.id);
      if (old && old.id !== local.id) { effect(state, old, -1, now, eligible); byId.delete(old.id); }
      continue;
    }
    const old = byId.get(row.id);
    if (old?.editedAt) { effect(newAccounts, row, -1, now); effect(newAccounts, old, 1, now); counts.protected++; continue; }
    if (old) {
      if (JSON.stringify([old.type, old.item, old.amount, old.date, old.account, old.toAccount, old.category, old.subcategory, old.note, old.status, old.sourceStatus, old.statusMappingVersion, old.legacyStatusUnknown]) !== JSON.stringify([row.type, row.item, row.amount, row.date, row.account, row.toAccount, row.category, row.subcategory, row.note, row.status, row.sourceStatus, row.statusMappingVersion, row.legacyStatusUnknown])) {
        const financialChanged = JSON.stringify([old.type, old.amount, old.date, old.account, old.toAccount]) !== JSON.stringify([row.type, row.amount, row.date, row.account, row.toAccount]);
        if (financialChanged) { effect(state, old, -1, now, eligible); effect(state, row, 1, now, eligible); }
        byId.set(row.id, { ...row, receipts: old.receipts }); counts.updated++;
      }
    } else { effect(state, row, 1, now, eligible); byId.set(row.id, row); counts.added++; }
  }
  // Only a previously accepted source snapshot can prove a source deletion.
  // A first import after migration never assumes missing legacy rows were deleted.
  for (const [id] of previousSnapshot) {
    if (sourceIds.has(id)) continue;
    const old = byId.get(id);
    if (!old || old.origin !== 'bluecoins') continue;
    if (old.editedAt) { counts.protected++; continue; }
    effect(state, old, -1, now, eligible); byId.delete(id); counts.removed++;
  }
  state.entries = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
  state.accounts.forEach(a => { a.balance = Math.round(a.balance * 100) / 100; });
  state.importedSource = incoming.sourceName;
  state.importSnapshot = { sourceName: incoming.sourceName, sourceDate: incoming.sourceDate, importedAt: now.toISOString(), entries: incomingRows.map(row => ({ id: row.id })) };
  state.storageVersion = 2;
  const balances = state.accounts.map(account => ({ name: account.name, before: original.accounts.find(old => old.id === account.id)?.balance ?? null, after: account.balance }));
  return { state, counts, aliases, redirects, balances };
}
