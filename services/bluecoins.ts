import AsyncStorage from '@react-native-async-storage/async-storage';
import BluecoinsDriveReader from 'bluecoins-drive-reader';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import type { SpendingGuardResult } from './spendingGuards';
import type { RedCoinsState } from './redcoins';
import { buildRedCoinsSummary } from './redcoinsSummary';
import { bluecoinsReviewStatus } from './redcoinsStatus';

const FOLDER_KEY = 'bluecoins_folder_uri_v1';
const CACHE_NAME = 'bluecoins-dashboard-cache.fydb';
const SOURCE_META_KEY = 'bluecoins_source_metadata_v1';
export const BLUECOINS_AUTO_SYNC_KEY = 'bluecoins_auto_sync_v1';
export const bluecoinsAutoSyncEnabled = async () => (await AsyncStorage.getItem(BLUECOINS_AUTO_SYNC_KEY)) === 'true';
export const getBluecoinsSourceMetadata = async () => {
  const raw = await AsyncStorage.getItem(SOURCE_META_KEY);
  return raw ? JSON.parse(raw) as { name: string; sourceDate: string; syncedAt: string } : null;
};
const AMOUNT_SCALE = 1_000_000;
const MONTHLY_BUDGET_KEY = 'bluecoins_monthly_budget_v1';
const PAYDAY_KEY = 'bluecoins_payday_v1';
const CASH_ACCOUNTS_KEY = 'bluecoins_cash_reality_accounts_v1';
const CASH_ACCOUNTS_INITIALISED_KEY = 'bluecoins_cash_reality_accounts_initialised_v1';
const SAFETY_BUFFER_KEY = 'bluecoins_cash_reality_buffer_v1';
const FIXED_COMMITMENTS_KEY = 'bluecoins_fixed_commitments_v1';

export interface BluecoinsDay {
  date: string;
  spent: number;
  transactions: number;
}

export interface BluecoinsSummary {
  sourceName: string;
  sourceDate: string;
  syncedAt: string;
  total: number;
  average: number;
  transactionCount: number;
  topCategory: string;
  topCategoryAmount: number;
  topCategories: { name: string; amount: number }[];
  previousTotal: number;
  changePercent: number | null;
  days: BluecoinsDay[];
  guardOptions: {
    accounts: string[];
    categories: string[];
    subcategories: string[];
  };
  spendingGuards: SpendingGuardResult[];
  cashReality: {
    liquidBalance: number;
    cardOutstanding: number;
    safetyBuffer: number;
    trueSpendable: number;
    coveragePercent: number;
    selectedAccounts: string[];
    cashAccounts: { name: string; balance: number; selected: boolean }[];
    creditCards: { name: string; outstanding: number; creditLimit: number; cutOffDay: number; dueDay: number }[];
  };
  monthly: {
    spent: number;
    budget: number;
    budgetIsSuggested: boolean;
    remaining: number;
    safeToday: number;
    projected: number;
    projectedLow: number;
    projectedHigh: number;
    projectionConfidence: 'low' | 'medium' | 'high';
    projectionCycles: number;
    historicalMean: number;
    historicalMedian: number;
    previousMonth: number;
    cycleStart: string;
    cycleEnd: string;
    cycleStartInstant?: string;
    cycleEndExclusive?: string;
    salarySourceLabel?: string;
    payday: number;
    noSpendDays: number;
    daysElapsed: number;
    daysInMonth: number;
    topCategories: { name: string; amount: number; share: number; details: { subcategory: string; item: string; amount: number; share: number; transactions: number }[] }[];
    fixedCommitments: { total: number; items: { name: string; amount: number; transactions: number }[] };
    fixedCommitmentOptions: { key: string; label: string; category: string; selected: boolean; amount: number; lastAmount: number; lastUsed: string; lifetimeTransactions: number }[];
    expectedFixedCommitments: {
      total: number;
      paid: number;
      remaining: number;
      items: { key: string; label: string; category: string; expectedAmount: number; currentAmount: number; lastUsed: string; status: 'paid' | 'due' }[];
    };
    fixedCommitmentSelection: string[];
    alerts: string[];
  };
  redcoins: {
    accounts: { name: string; sourceAccountId?: string; type: 'Bank' | 'Cash' | 'Credit card' | 'Liability' | 'Investment'; balance: number; limit: number }[];
    categories: { name: string; subcategories: string[]; subcategoryTypes?: Record<string, Array<'income' | 'expense'>> }[];
    entries: { id: string; type: 'expense' | 'income' | 'transfer'; item: string; amount: number; date: string; account: string; toAccount?: string; sourceAccountId?: string; sourceToAccountId?: string; category: string; subcategory: string; note: string; status: 'none' | 'cleared' | 'pending' | 'reconciled' | 'void'; sourceStatus?: number; statusMappingVersion?: 1; origin: 'bluecoins' }[];
  };
}

const fileNameFromUri = (uri: string) => {
  const decoded = decodeURIComponent(uri);
  return decoded.split('/').pop()?.split(':').pop() || 'Bluecoins backup';
};

const backupDateFromName = (name: string) => {
  const match = name.match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return new Date().toISOString().slice(0, 10);
};

export const getBluecoinsFolder = () => AsyncStorage.getItem(FOLDER_KEY);
export const setBluecoinsMonthlyBudget = (budget: number) => AsyncStorage.setItem(MONTHLY_BUDGET_KEY, String(Math.max(0, budget)));
export const setBluecoinsPayday = (day: number) => AsyncStorage.setItem(PAYDAY_KEY, String(Math.max(1, Math.min(28, Math.round(day)))));
export const setBluecoinsFixedCommitments = (keys: string[]) => AsyncStorage.setItem(FIXED_COMMITMENTS_KEY, JSON.stringify([...new Set(keys)]));
export async function setCashRealityAccounts(accounts: string[]) {
  await Promise.all([
    AsyncStorage.setItem(CASH_ACCOUNTS_KEY, JSON.stringify([...new Set(accounts)])),
    AsyncStorage.setItem(CASH_ACCOUNTS_INITIALISED_KEY, 'true'),
  ]);
}
export const setCashRealitySafetyBuffer = (amount: number) => AsyncStorage.setItem(SAFETY_BUFFER_KEY, String(Math.max(0, amount)));

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function copyProviderFileToLocal(sourceUri: string, localUri: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      if (sourceUri.startsWith('content://') && BluecoinsDriveReader) {
        await BluecoinsDriveReader.copyContentUriToFileAsync(sourceUri, localUri);
      } else {
        await FileSystem.copyAsync({ from: sourceUri, to: localUri });
      }
      const copied = await FileSystem.getInfoAsync(localUri);
      if (!copied.exists || !('size' in copied) || !copied.size) {
        throw new Error('Google Drive returned an empty file');
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 900);
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError || 'unknown provider error');
  throw new Error(`BLUECOINS_PROVIDER_COPY_FAILED|${detail}`);
}

export async function disconnectBluecoins() {
  await AsyncStorage.removeItem(FOLDER_KEY);
}

export async function chooseBluecoinsFolder() {
  const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!result.granted) return null;
  await AsyncStorage.setItem(FOLDER_KEY, result.directoryUri);
  return result.directoryUri;
}

/** Parse FYDB only during an explicit staged import. Never used on app open. */
export async function readBluecoinsImport(folderUri?: string | null): Promise<BluecoinsSummary> {
  const directoryUri = folderUri || await getBluecoinsFolder();
  if (!directoryUri) throw new Error('BLUECOINS_FOLDER_NOT_CONNECTED');
  let backups: Array<{ uri: string; name: string; lastModified: number }>;
  try {
    if (directoryUri.startsWith('content://') && BluecoinsDriveReader) {
      backups = (await BluecoinsDriveReader.listFydbFilesAsync(directoryUri)).map(file => ({ uri: file.uri, name: file.name, lastModified: file.lastModified }));
    } else {
      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri);
      backups = files.filter(uri => fileNameFromUri(uri).toLowerCase().endsWith('.fydb')).map(uri => ({ uri, name: fileNameFromUri(uri), lastModified: 0 }));
    }
  } catch (error) { throw new Error(`BLUECOINS_PROVIDER_LIST_FAILED|${String(error)}`); }
  backups.sort((a, b) => b.lastModified - a.lastModified || b.name.localeCompare(a.name));
  if (!backups.length) throw new Error('NO_BLUECOINS_BACKUP');
  const sourceName = backups[0].name, sourceDate = backupDateFromName(sourceName);
  const localUri = `${FileSystem.documentDirectory}${CACHE_NAME}`;
  await copyProviderFileToLocal(backups[0].uri, localUri);
  const db = await SQLite.openDatabaseAsync(CACHE_NAME, { useNewConnection: true }, FileSystem.documentDirectory || undefined);
  try {
    const categoryOptions = await db.getAllAsync<{ category: string; subcategory: string; groupId: number }>(
      `SELECT DISTINCT COALESCE(pc.parentCategoryName, cc.childCategoryName, 'Uncategorised') AS category,
              COALESCE(cc.childCategoryName, pc.parentCategoryName, 'Uncategorised') AS subcategory,
              pc.categoryGroupID AS groupId
       FROM CHILDCATEGORYTABLE cc
       LEFT JOIN PARENTCATEGORYTABLE pc ON pc.parentCategoryTableID = cc.parentCategoryID
       ORDER BY category, subcategory`,
    );
    const accountBalances = await db.getAllAsync<{
      sourceAccountId: number; name: string; accountType: number; balanceRaw: number; creditLimitRaw: number; cutOffDay: number; dueDay: number;
    }>(
      `SELECT a.accountsTableID AS sourceAccountId, a.accountName AS name, a.accountTypeID AS accountType,
              COALESCE(SUM(CASE WHEN t.deletedTransaction = 6 AND t.reminderTransaction IS NULL AND substr(t.date, 1, 10) <= ? THEN t.amount ELSE 0 END), 0) AS balanceRaw,
              COALESCE(a.creditLimit, 0) AS creditLimitRaw,
              COALESCE(a.cutOffDa, 0) AS cutOffDay,
              COALESCE(a.creditCardDueDate, 0) AS dueDay
       FROM ACCOUNTSTABLE a
       LEFT JOIN TRANSACTIONSTABLE t ON t.accountID = a.accountsTableID
       WHERE a.accountsTableID > 0
       GROUP BY a.accountsTableID
      ORDER BY a.accountName`,
      sourceDate,
    );
    const ledgerRows = await db.getAllAsync<{
      id: number; transactionType: number; rawAmount: number; date: string; item: string; account: string;
      toAccount: string; sourceAccountId: number; sourceToAccountId: number | null; category: string; subcategory: string; note: string; status: number;
    }>(
      `SELECT t.transactionsTableID AS id, t.transactionTypeID AS transactionType,
              ABS(t.amount) AS rawAmount, t.date AS date,
              COALESCE(NULLIF(TRIM(i.itemName), ''), 'Unnamed transaction') AS item,
              COALESCE(a.accountName, '(No Account)') AS account, t.accountID AS sourceAccountId,
              COALESCE(pair.accountName, '') AS toAccount, t.accountPairID AS sourceToAccountId,
              COALESCE(pc.parentCategoryName, cc.childCategoryName, 'Uncategorised') AS category,
              COALESCE(cc.childCategoryName, pc.parentCategoryName, 'Uncategorised') AS subcategory,
              COALESCE(t.notes, '') AS note, COALESCE(t.status, 0) AS status
       FROM TRANSACTIONSTABLE t
       LEFT JOIN ITEMTABLE i ON i.itemTableID = t.itemID
       LEFT JOIN ACCOUNTSTABLE a ON a.accountsTableID = t.accountID
       LEFT JOIN ACCOUNTSTABLE pair ON pair.accountsTableID = t.accountPairID
       LEFT JOIN CHILDCATEGORYTABLE cc ON cc.categoryTableID = t.categoryID
       LEFT JOIN PARENTCATEGORYTABLE pc ON pc.parentCategoryTableID = cc.parentCategoryID
       WHERE t.deletedTransaction = 6 AND t.reminderTransaction IS NULL
         AND t.transactionTypeID IN (3, 4, 5)
         AND (t.transactionTypeID != 5 OR t.accountReference = 1)
       ORDER BY t.date DESC`,
    );

    const redcoinsAccountType = (account: typeof accountBalances[number]) => {
      if (account.accountType === 8 || /credit|platinum/i.test(account.name)) return 'Credit card' as const;
      if ([9, 11].includes(account.accountType) || /persona|prima|loan|mortgage/i.test(account.name)) return 'Liability' as const;
      if (/epf|tabung haji|investment/i.test(account.name)) return 'Investment' as const;
      if (/wallet|cash/i.test(account.name)) return 'Cash' as const;
      return 'Bank' as const;
    };
    const redcoins = {
      accounts: accountBalances.map((account) => ({
        name: account.name,
        sourceAccountId: String(account.sourceAccountId),
        type: redcoinsAccountType(account),
        balance: account.balanceRaw / AMOUNT_SCALE,
        limit: account.creditLimitRaw / AMOUNT_SCALE,
        cutOffDay: account.cutOffDay,
        dueDay: account.dueDay,
      })),
      categories: [...categoryOptions.reduce((map, row) => {
        const values = map.get(row.category) || [];
        if (!values.includes(row.subcategory)) values.push(row.subcategory);
        map.set(row.category, values);
        return map;
      }, new Map<string, string[]>())].map(([name, subcategories]) => ({
        name, subcategories,
        subcategoryTypes: Object.fromEntries(subcategories.map((sub) => [sub,
          [...new Set(categoryOptions.filter((row) => row.category === name && row.subcategory === sub)
            .flatMap((row): Array<'income' | 'expense'> => row.groupId === 2 ? ['income'] : row.groupId === 3 ? ['expense'] : []))],
        ])),
      })),
      entries: ledgerRows.map((row) => ({
        id: `bluecoins-${row.id}`,
        type: row.transactionType === 5 ? 'transfer' as const : row.transactionType === 4 ? 'income' as const : 'expense' as const,
        item: row.item,
        amount: row.rawAmount / AMOUNT_SCALE,
        date: row.date.replace(' ', 'T'),
        account: row.account,
        sourceAccountId: String(row.sourceAccountId),
        toAccount: row.transactionType === 5 ? row.toAccount : undefined,
        sourceToAccountId: row.transactionType === 5 && row.sourceToAccountId ? String(row.sourceToAccountId) : undefined,
        category: row.transactionType === 5 ? '(Transfer)' : row.category,
        subcategory: row.transactionType === 5 ? '(Transfer)' : row.subcategory,
        note: row.note,
        status: bluecoinsReviewStatus(row.status),
        sourceStatus: row.status,
        statusMappingVersion: 1 as const,
        origin: 'bluecoins' as const,
      })),
    };

    const temporary: RedCoinsState = {
      accounts: redcoins.accounts.map((account, index) => ({ ...account, id: `source-${account.sourceAccountId || index}` })),
      categories: redcoins.categories.map((category, index) => ({ ...category, id: `category-${index}`, icon: 'grid' })),
      entries: redcoins.entries, reminders: [], deletedEntries: [], exportBatches: [], subcategoryBudgets: {},
      monthlyBudget: Number(await AsyncStorage.getItem(MONTHLY_BUDGET_KEY)) || 2000,
      payday: Number(await AsyncStorage.getItem(PAYDAY_KEY)) || 25,
      safetyBuffer: Math.max(0, Number(await AsyncStorage.getItem(SAFETY_BUFFER_KEY)) || 0),
      importedSource: sourceName, createdAt: new Date().toISOString(),
    };
    const summary = buildRedCoinsSummary(temporary, { selectedAccounts: [], fixedCommitments: [], guards: [] }, new Date(`${sourceDate}T23:59:59.999`));
    summary.redcoins = redcoins;
    await AsyncStorage.setItem(SOURCE_META_KEY, JSON.stringify({ name: sourceName, sourceDate, syncedAt: new Date().toISOString() }));
    return summary;
  } finally { await db.closeAsync(); }
}
