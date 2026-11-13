import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RedCoinsAccount, RedCoinsCategory, RedCoinsEntry, RedCoinsState } from './redcoins';
import { readRedCoinsSql, writeRedCoinsSql } from './redcoinsSqlStore';
import { emitRedCoinsChange } from './redcoinsEvents';
import { auth } from '../firebase';

export const DEFAULT_PB_SYNC_URL = 'http://192.168.100.232:8090';
const STORAGE_KEY_URL = '@redcoins_pb_sync_url';
const STORAGE_KEY_LAST_SYNC = '@redcoins_pb_last_sync';

export function getCurrentUserEmail(): string {
  return auth.currentUser?.email?.trim().toLowerCase() || 'default_user';
}

export async function getPocketBaseSyncUrl(): Promise<string> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY_URL);
    return val?.trim() || DEFAULT_PB_SYNC_URL;
  } catch {
    return DEFAULT_PB_SYNC_URL;
  }
}

export async function setPocketBaseSyncUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_URL, url.trim());
}

export async function getPocketBaseLastSync(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY_LAST_SYNC);
  } catch {
    return null;
  }
}

export async function checkPocketBaseConnection(customUrl?: string): Promise<{ ok: boolean; message: string }> {
  const base = customUrl?.trim() || (await getPocketBaseSyncUrl());
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(`${base}/api/health`, { signal: ctrl.signal });
    clearTimeout(timeout);
    if (res.ok) {
      return { ok: true, message: 'Online · TX3 Mini' };
    }
    return { ok: false, message: `Server error: HTTP ${res.status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Cannot connect to ${base} (${msg})` };
  }
}

/**
 * Exports all mobile accounts, categories, and entries to PocketBase for current user.
 */
export async function exportAllToPocketBase(
  state: RedCoinsState,
  onProgress?: (done: number, total: number, message: string) => void
): Promise<{
  success: boolean;
  accountsExported: number;
  categoriesExported: number;
  entriesExported: number;
  error?: string;
}> {
  const base = await getPocketBaseSyncUrl();
  const userEmail = getCurrentUserEmail();

  try {
    // 1. Sync Accounts
    onProgress?.(0, 3, 'Syncing accounts to TX3 Mini...');
    const accListRes = await fetch(
      `${base}/api/collections/redcoins_accounts/records?filter=(userEmail='${userEmail}')&perPage=200`
    );
    const accListData = await accListRes.json();
    const existingAccounts = new Map<string, string>(); // name -> pb id
    if (Array.isArray(accListData?.items)) {
      accListData.items.forEach((item: { id: string; name: string }) => {
        existingAccounts.set(item.name.toLowerCase(), item.id);
      });
    }

    let accCount = 0;
    for (const acc of state.accounts) {
      const payload = {
        name: acc.name,
        type: acc.type,
        balance: acc.balance,
        icon: acc.icon || '',
        localId: acc.id,
        userEmail,
      };

      const existingId = existingAccounts.get(acc.name.toLowerCase());
      if (existingId) {
        await fetch(`${base}/api/collections/redcoins_accounts/records/${existingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${base}/api/collections/redcoins_accounts/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      accCount++;
    }

    // 2. Sync Categories
    onProgress?.(1, 3, 'Syncing categories to TX3 Mini...');
    const catListRes = await fetch(
      `${base}/api/collections/redcoins_categories/records?filter=(userEmail='${userEmail}')&perPage=200`
    );
    const catListData = await catListRes.json();
    const existingCats = new Map<string, string>();
    if (Array.isArray(catListData?.items)) {
      catListData.items.forEach((item: { id: string; name: string }) => {
        existingCats.set(item.name.toLowerCase(), item.id);
      });
    }

    let catCount = 0;
    for (const cat of state.categories) {
      const payload = {
        name: cat.name,
        icon: cat.icon || '',
        subcategories: cat.subcategories || [],
        subcategoryTypes: cat.subcategoryTypes || {},
        userEmail,
      };

      const existingId = existingCats.get(cat.name.toLowerCase());
      if (existingId) {
        await fetch(`${base}/api/collections/redcoins_categories/records/${existingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${base}/api/collections/redcoins_categories/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      catCount++;
    }

    // 3. Sync Entries
    onProgress?.(2, 3, 'Fetching existing ledger entries on TX3 Mini...');
    const existingEntries = new Map<string, string>(); // localId -> pb record id
    let page = 1;
    let totalPages = 1;
    do {
      const res = await fetch(
        `${base}/api/collections/redcoins_entries/records?filter=(userEmail='${userEmail}')&page=${page}&perPage=500&fields=id,localId`
      );
      const data = await res.json();
      if (Array.isArray(data?.items)) {
        data.items.forEach((item: { id: string; localId?: string }) => {
          if (item.localId) existingEntries.set(item.localId, item.id);
        });
      }
      totalPages = data?.totalPages || 1;
      page++;
    } while (page <= totalPages);

    const totalEntries = state.entries.length;
    let entriesDone = 0;
    const batchSize = 15;

    for (let i = 0; i < totalEntries; i += batchSize) {
      const slice = state.entries.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (entry) => {
          const payload = {
            item: entry.item,
            amount: entry.amount,
            type: entry.type,
            date: entry.date,
            account: entry.account || '',
            toAccount: entry.toAccount || '',
            category: entry.category || '',
            subcategory: entry.subcategory || '',
            status: entry.status || '',
            labels: entry.labels || [],
            origin: entry.origin || 'redcoins',
            notes: entry.note || '',
            localId: entry.id,
            userEmail,
            deleted: false,
          };

          const pbId = existingEntries.get(entry.id);
          if (pbId) {
            await fetch(`${base}/api/collections/redcoins_entries/records/${pbId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } else {
            await fetch(`${base}/api/collections/redcoins_entries/records`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          }
        })
      );

      entriesDone += slice.length;
      onProgress?.(entriesDone, totalEntries, `Exporting entries (${entriesDone}/${totalEntries})...`);
    }

    const nowIso = new Date().toISOString();
    await AsyncStorage.setItem(STORAGE_KEY_LAST_SYNC, nowIso);

    return {
      success: true,
      accountsExported: accCount,
      categoriesExported: catCount,
      entriesExported: entriesDone,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      accountsExported: 0,
      categoriesExported: 0,
      entriesExported: 0,
      error: msg,
    };
  }
}

/**
 * Bidirectional Pull: checks for entries created, modified, or deleted on Web App for current user.
 */
export async function pullFromPocketBase(): Promise<{
  success: boolean;
  entriesUpdated: number;
  entriesAdded: number;
  entriesDeleted: number;
  error?: string;
}> {
  const base = await getPocketBaseSyncUrl();
  const userEmail = getCurrentUserEmail();

  try {
    const currentState = await readRedCoinsSql(false);
    if (!currentState) {
      return {
        success: false,
        entriesUpdated: 0,
        entriesAdded: 0,
        entriesDeleted: 0,
        error: 'No local RedCoins state found',
      };
    }

    const allPbEntries: Array<{
      id: string;
      localId?: string;
      item: string;
      amount: number;
      type: 'expense' | 'income' | 'transfer';
      date: string;
      account?: string;
      toAccount?: string;
      category?: string;
      subcategory?: string;
      status?: string;
      notes?: string;
      labels?: string[];
      origin?: string;
      deleted?: boolean;
    }> = [];

    let page = 1;
    let totalPages = 1;
    do {
      const res = await fetch(
        `${base}/api/collections/redcoins_entries/records?filter=(userEmail='${userEmail}')&page=${page}&perPage=200`
      );
      const data = await res.json();
      if (Array.isArray(data?.items)) {
        allPbEntries.push(...data.items);
      }
      totalPages = data?.totalPages || 1;
      page++;
    } while (page <= totalPages);

    const localMap = new Map<string, RedCoinsEntry>(currentState.entries.map((e) => [e.id, e]));
    let entriesAdded = 0;
    let entriesUpdated = 0;
    let entriesDeleted = 0;

    allPbEntries.forEach((pbEntry) => {
      const targetId = pbEntry.localId || pbEntry.id;
      const existing = localMap.get(targetId);

      // Check soft delete
      if (pbEntry.deleted) {
        if (existing) {
          currentState.entries = currentState.entries.filter((e) => e.id !== targetId);
          localMap.delete(targetId);
          entriesDeleted++;
        }
        return;
      }

      if (!existing) {
        // New entry created from web app
        const newEntry: RedCoinsEntry = {
          id: targetId,
          item: pbEntry.item,
          amount: Number(pbEntry.amount) || 0,
          type: pbEntry.type,
          date: pbEntry.date,
          account: pbEntry.account || '',
          toAccount: pbEntry.toAccount || '',
          category: pbEntry.category || '',
          subcategory: pbEntry.subcategory || '',
          status: (pbEntry.status as RedCoinsEntry['status']) || 'none',
          note: pbEntry.notes || '',
          origin: (pbEntry.origin as 'redcoins' | 'bluecoins') || 'redcoins',
          labels: pbEntry.labels || [],
        };
        currentState.entries.unshift(newEntry);
        localMap.set(targetId, newEntry);
        entriesAdded++;
      } else {
        // Existing entry: check if modified on web app
        let modified = false;
        if (existing.item !== pbEntry.item) {
          existing.item = pbEntry.item;
          modified = true;
        }
        if (Number(existing.amount) !== Number(pbEntry.amount)) {
          existing.amount = Number(pbEntry.amount);
          modified = true;
        }
        if (existing.account !== pbEntry.account) {
          existing.account = pbEntry.account || '';
          modified = true;
        }
        if (existing.toAccount !== pbEntry.toAccount) {
          existing.toAccount = pbEntry.toAccount || '';
          modified = true;
        }
        if (existing.category !== pbEntry.category) {
          existing.category = pbEntry.category || '';
          modified = true;
        }
        if (existing.subcategory !== pbEntry.subcategory) {
          existing.subcategory = pbEntry.subcategory || '';
          modified = true;
        }
        if (existing.status !== pbEntry.status && pbEntry.status) {
          existing.status = pbEntry.status as RedCoinsEntry['status'];
          modified = true;
        }
        if (modified) {
          entriesUpdated++;
        }
      }
    });

    if (entriesAdded > 0 || entriesUpdated > 0 || entriesDeleted > 0) {
      await writeRedCoinsSql(currentState);
      emitRedCoinsChange();
    }

    const nowIso = new Date().toISOString();
    await AsyncStorage.setItem(STORAGE_KEY_LAST_SYNC, nowIso);

    return {
      success: true,
      entriesAdded,
      entriesUpdated,
      entriesDeleted,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      entriesAdded: 0,
      entriesUpdated: 0,
      entriesDeleted: 0,
      error: msg,
    };
  }
}

/**
 * Non-blocking background push of a single created/updated entry.
 */
export async function autoPushEntryToPocketBase(entry: RedCoinsEntry): Promise<void> {
  try {
    const base = await getPocketBaseSyncUrl();
    const userEmail = getCurrentUserEmail();

    // Check if exists
    const checkRes = await fetch(
      `${base}/api/collections/redcoins_entries/records?filter=(userEmail='${userEmail}'%26%26localId='${entry.id}')&perPage=1`
    );
    const checkData = await checkRes.json();
    const existingId = checkData?.items?.[0]?.id;

    const payload = {
      item: entry.item,
      amount: entry.amount,
      type: entry.type,
      date: entry.date,
      account: entry.account || '',
      toAccount: entry.toAccount || '',
      category: entry.category || '',
      subcategory: entry.subcategory || '',
      status: entry.status || '',
      labels: entry.labels || [],
      origin: entry.origin || 'redcoins',
      notes: entry.note || '',
      localId: entry.id,
      userEmail,
      deleted: false,
    };

    if (existingId) {
      await fetch(`${base}/api/collections/redcoins_entries/records/${existingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${base}/api/collections/redcoins_entries/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  } catch {
    // Non-blocking: failures stay local until next pull/push
  }
}

/**
 * Non-blocking background soft-delete of an entry on PocketBase.
 */
export async function autoDeleteEntryFromPocketBase(entryId: string): Promise<void> {
  try {
    const base = await getPocketBaseSyncUrl();
    const userEmail = getCurrentUserEmail();

    const checkRes = await fetch(
      `${base}/api/collections/redcoins_entries/records?filter=(userEmail='${userEmail}'%26%26localId='${entryId}')&perPage=1`
    );
    const checkData = await checkRes.json();
    const existingId = checkData?.items?.[0]?.id;

    if (existingId) {
      await fetch(`${base}/api/collections/redcoins_entries/records/${existingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted: true }),
      });
    }
  } catch {
    // Non-blocking
  }
}
