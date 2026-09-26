import AsyncStorage from '@react-native-async-storage/async-storage';
import BluecoinsDriveReader from 'bluecoins-drive-reader';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import {
  ensureDefaultCreditCardGuard,
  SpendingGuard,
  SpendingGuardResult,
  WIDGET_CASH_REALITY_KEY,
} from './spendingGuards';

const FOLDER_KEY = 'bluecoins_folder_uri_v1';
const CACHE_NAME = 'bluecoins-dashboard-cache.fydb';
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
    payday: number;
    noSpendDays: number;
    daysElapsed: number;
    daysInMonth: number;
    topCategories: { name: string; amount: number; share: number; details: { subcategory: string; item: string; amount: number; share: number; transactions: number }[] }[];
    fixedCommitments: { total: number; items: { name: string; amount: number; transactions: number }[] };
    fixedCommitmentOptions: { key: string; label: string; category: string; selected: boolean; amount: number }[];
    fixedCommitmentSelection: string[];
    alerts: string[];
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

const dateWindow = (endDate: string) => {
  const end = new Date(`${endDate}T12:00:00`);
  const dates: string[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - offset);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
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

const localIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const salaryCycle = (source: Date, payday: number) => {
  const start = new Date(source.getFullYear(), source.getMonth() - (source.getDate() < payday ? 1 : 0), payday, 12);
  const nextStart = new Date(start.getFullYear(), start.getMonth() + 1, payday, 12);
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  const previousStart = new Date(start.getFullYear(), start.getMonth() - 1, payday, 12);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  return { start, end, previousStart, previousEnd };
};

const calendarCycle = (source: Date) => {
  const start = new Date(source.getFullYear(), source.getMonth(), 1, 12);
  const end = new Date(source.getFullYear(), source.getMonth() + 1, 0, 12);
  return { start, end };
};

const average = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;

const median = (values: number[]) => {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

const guardLevel = (percent: number): SpendingGuardResult['level'] => {
  if (percent >= 100) return 'breached';
  if (percent >= 85) return 'danger';
  if (percent >= 70) return 'slow-down';
  if (percent >= 50) return 'heads-up';
  return 'safe';
};

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

export async function refreshBluecoinsSummary(folderUri?: string | null): Promise<BluecoinsSummary> {
  const directoryUri = folderUri || await getBluecoinsFolder();
  if (!directoryUri) throw new Error('BLUECOINS_FOLDER_NOT_CONNECTED');

  let backups: Array<{ uri: string; name: string; lastModified: number }>;
  try {
    if (directoryUri.startsWith('content://') && BluecoinsDriveReader) {
      backups = (await BluecoinsDriveReader.listFydbFilesAsync(directoryUri))
        .map((file) => ({ uri: file.uri, name: file.name, lastModified: file.lastModified }));
    } else {
      const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri);
      backups = entries
        .filter((uri) => fileNameFromUri(uri).toLowerCase().endsWith('.fydb'))
        .map((uri) => ({ uri, name: fileNameFromUri(uri), lastModified: 0 }));
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || 'unknown provider error');
    throw new Error(`BLUECOINS_PROVIDER_LIST_FAILED|${detail}`);
  }
  backups.sort((a, b) => b.lastModified - a.lastModified || b.name.localeCompare(a.name));

  if (!backups.length) throw new Error('NO_BLUECOINS_BACKUP');

  const sourceUri = backups[0].uri;
  const sourceName = backups[0].name;
  const sourceDate = backupDateFromName(sourceName);
  const localUri = `${FileSystem.documentDirectory}${CACHE_NAME}`;

  await copyProviderFileToLocal(sourceUri, localUri);

  let db: SQLite.SQLiteDatabase;
  try {
    db = await SQLite.openDatabaseAsync(
      CACHE_NAME,
      { useNewConnection: true },
      FileSystem.documentDirectory || undefined,
    );
    await db.getFirstAsync('PRAGMA schema_version');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || 'unknown SQLite error');
    throw new Error(`BLUECOINS_DATABASE_UNREADABLE|${detail}`);
  }

  try {
    const dates = dateWindow(sourceDate);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const baseWhere = `
      t.deletedTransaction = 6
      AND t.transactionTypeID = 3
      AND t.reminderTransaction IS NULL
      AND substr(t.date, 1, 10) BETWEEN ? AND ?
    `;

    const dailyRows = await db.getAllAsync<{ day: string; rawSpent: number; tx: number }>(
      `SELECT substr(t.date, 1, 10) AS day,
              COALESCE(SUM(ABS(t.amount)), 0) AS rawSpent,
              COUNT(*) AS tx
       FROM TRANSACTIONSTABLE t
       WHERE ${baseWhere}
       GROUP BY substr(t.date, 1, 10)
       ORDER BY day`,
      startDate,
      endDate,
    );

    const categories = await db.getAllAsync<{ category: string; rawSpent: number }>(
      `SELECT COALESCE(pc.parentCategoryName, cc.childCategoryName, 'Uncategorised') AS category,
              COALESCE(SUM(ABS(t.amount)), 0) AS rawSpent
       FROM TRANSACTIONSTABLE t
       LEFT JOIN CHILDCATEGORYTABLE cc ON cc.categoryTableID = t.categoryID
       LEFT JOIN PARENTCATEGORYTABLE pc ON pc.parentCategoryTableID = cc.parentCategoryID
       WHERE ${baseWhere}
       GROUP BY category
       ORDER BY rawSpent DESC
       LIMIT 3`,
      startDate,
      endDate,
    );

    const previousEnd = new Date(`${startDate}T12:00:00`);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 6);
    const previous = await db.getFirstAsync<{ rawSpent: number }>(
      `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS rawSpent
       FROM TRANSACTIONSTABLE t
       WHERE t.deletedTransaction = 6
         AND t.transactionTypeID = 3
         AND t.reminderTransaction IS NULL
         AND substr(t.date, 1, 10) BETWEEN ? AND ?`,
      previousStart.toISOString().slice(0, 10),
      previousEnd.toISOString().slice(0, 10),
    );

    const source = new Date(`${sourceDate}T12:00:00`);
    const payday = Math.max(1, Math.min(28, Number(await AsyncStorage.getItem(PAYDAY_KEY)) || 25));
    const cycle = salaryCycle(source, payday);
    const monthStart = localIso(cycle.start);
    const cycleEnd = localIso(cycle.end);
    const previousMonthStart = localIso(cycle.previousStart);
    const previousMonthEnd = localIso(cycle.previousEnd);
    const accountOptions = await db.getAllAsync<{ name: string }>(
      `SELECT accountName AS name FROM ACCOUNTSTABLE
       WHERE accountsTableID > 0 AND accountName NOT LIKE '(No Account)'
       ORDER BY accountName`,
    );
    const categoryOptions = await db.getAllAsync<{ category: string; subcategory: string }>(
      `SELECT DISTINCT COALESCE(pc.parentCategoryName, cc.childCategoryName, 'Uncategorised') AS category,
              COALESCE(cc.childCategoryName, pc.parentCategoryName, 'Uncategorised') AS subcategory
       FROM CHILDCATEGORYTABLE cc
       LEFT JOIN PARENTCATEGORYTABLE pc ON pc.parentCategoryTableID = cc.parentCategoryID
       ORDER BY category, subcategory`,
    );
    const accountBalances = await db.getAllAsync<{
      name: string; accountType: number; balanceRaw: number; creditLimitRaw: number; cutOffDay: number; dueDay: number;
    }>(
      `SELECT a.accountName AS name, a.accountTypeID AS accountType,
              COALESCE(SUM(CASE WHEN t.deletedTransaction = 6 AND t.reminderTransaction IS NULL THEN t.amount ELSE 0 END), 0) AS balanceRaw,
              COALESCE(a.creditLimit, 0) AS creditLimitRaw,
              COALESCE(a.cutOffDa, 0) AS cutOffDay,
              COALESCE(a.creditCardDueDate, 0) AS dueDay
       FROM ACCOUNTSTABLE a
       LEFT JOIN TRANSACTIONSTABLE t ON t.accountID = a.accountsTableID
       WHERE a.accountsTableID > 0
       GROUP BY a.accountsTableID
       ORDER BY a.accountName`,
    );
    const cashCandidates = accountBalances.filter((account) => [3, 4].includes(account.accountType));
    const accountsInitialised = (await AsyncStorage.getItem(CASH_ACCOUNTS_INITIALISED_KEY)) === 'true';
    const savedAccountsRaw = await AsyncStorage.getItem(CASH_ACCOUNTS_KEY);
    let selectedAccounts: string[] = savedAccountsRaw ? JSON.parse(savedAccountsRaw) : [];
    if (!accountsInitialised) {
      const preferred = ['cimb', 'maybank', 'rhb', 'aeon'];
      selectedAccounts = cashCandidates.filter((account) => preferred.includes(account.name.toLowerCase())).map((account) => account.name);
      if (!selectedAccounts.length) selectedAccounts = cashCandidates.map((account) => account.name);
      await setCashRealityAccounts(selectedAccounts);
    }
    const cashAccounts = cashCandidates.map((account) => ({
      name: account.name,
      balance: account.balanceRaw / AMOUNT_SCALE,
      selected: selectedAccounts.includes(account.name),
    }));
    const creditCards = accountBalances.filter((account) =>
      account.accountType === 8 || /cimb\s*platinum|credit\s*card/i.test(account.name)
    ).map((account) => ({
      name: account.name,
      outstanding: Math.max(0, -account.balanceRaw / AMOUNT_SCALE),
      creditLimit: account.creditLimitRaw / AMOUNT_SCALE,
      cutOffDay: account.cutOffDay,
      dueDay: account.dueDay,
    }));
    const liquidBalance = cashAccounts.filter((account) => account.selected).reduce((sum, account) => sum + account.balance, 0);
    const cardOutstanding = creditCards.reduce((sum, card) => sum + card.outstanding, 0);
    const safetyBuffer = Math.max(0, Number(await AsyncStorage.getItem(SAFETY_BUFFER_KEY)) || 0);
    const trueSpendable = liquidBalance - cardOutstanding - safetyBuffer;
    const cashReality = {
      liquidBalance,
      cardOutstanding,
      safetyBuffer,
      trueSpendable,
      coveragePercent: cardOutstanding > 0 ? (liquidBalance / cardOutstanding) * 100 : 100,
      selectedAccounts,
      cashAccounts,
      creditCards,
    };
    await AsyncStorage.setItem(WIDGET_CASH_REALITY_KEY, JSON.stringify({ ...cashReality, sourceDate }));
    const monthRows = await db.getAllAsync<{ day: string; rawSpent: number; tx: number }>(
      `SELECT substr(t.date, 1, 10) AS day,
              COALESCE(SUM(ABS(t.amount)), 0) AS rawSpent,
              COUNT(*) AS tx
       FROM TRANSACTIONSTABLE t
       WHERE t.deletedTransaction = 6
         AND t.transactionTypeID = 3
         AND t.reminderTransaction IS NULL
         AND substr(t.date, 1, 10) BETWEEN ? AND ?
       GROUP BY substr(t.date, 1, 10)`,
      monthStart,
      sourceDate,
    );
    // Bluecoins records a loan/mortgage repayment as two transfer rows rather
    // than an expense. Count only the negative (source-account) side whose
    // destination is a liability account, so repayments are not missed or
    // double-counted.
    const liabilityRows = await db.getAllAsync<{ day: string; liability: string; rawSpent: number; tx: number }>(
      `SELECT substr(t.date, 1, 10) AS day,
              COALESCE(destination.accountName, 'Debt repayment') AS liability,
              COALESCE(SUM(ABS(t.amount)), 0) AS rawSpent,
              COUNT(*) AS tx
       FROM TRANSACTIONSTABLE t
       JOIN ACCOUNTSTABLE destination ON destination.accountsTableID = t.accountPairID
       WHERE t.deletedTransaction = 6
         AND t.transactionTypeID = 5
         AND t.amount < 0
         AND destination.accountTypeID IN (9, 11)
         AND t.reminderTransaction IS NULL
         AND substr(t.date, 1, 10) BETWEEN ? AND ?
       GROUP BY day, liability`,
      monthStart,
      sourceDate,
    );
    const monthlyCategoriesRows = await db.getAllAsync<{ category: string; subcategory: string; item: string; rawSpent: number; tx: number }>(
      `SELECT COALESCE(pc.parentCategoryName, cc.childCategoryName, 'Uncategorised') AS category,
              COALESCE(cc.childCategoryName, pc.parentCategoryName, 'Uncategorised') AS subcategory,
              COALESCE(NULLIF(TRIM(i.itemName), ''), 'Unnamed entry') AS item,
              COALESCE(SUM(ABS(t.amount)), 0) AS rawSpent,
              COUNT(*) AS tx
       FROM TRANSACTIONSTABLE t
       LEFT JOIN CHILDCATEGORYTABLE cc ON cc.categoryTableID = t.categoryID
       LEFT JOIN PARENTCATEGORYTABLE pc ON pc.parentCategoryTableID = cc.parentCategoryID
       LEFT JOIN ITEMTABLE i ON i.itemTableID = t.itemID
       WHERE t.deletedTransaction = 6
         AND t.transactionTypeID = 3
         AND t.reminderTransaction IS NULL
         AND substr(t.date, 1, 10) BETWEEN ? AND ?
       GROUP BY category, subcategory, item
       ORDER BY rawSpent DESC`,
      monthStart,
      sourceDate,
    );
    const previousMonthRow = await db.getFirstAsync<{ rawSpent: number }>(
      `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS rawSpent
       FROM TRANSACTIONSTABLE t
       WHERE t.deletedTransaction = 6
         AND t.transactionTypeID = 3
         AND t.reminderTransaction IS NULL
         AND substr(t.date, 1, 10) BETWEEN ? AND ?`,
      previousMonthStart,
      previousMonthEnd,
    );
    const previousLiabilityRow = await db.getFirstAsync<{ rawSpent: number }>(
      `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS rawSpent
       FROM TRANSACTIONSTABLE t
       JOIN ACCOUNTSTABLE destination ON destination.accountsTableID = t.accountPairID
       WHERE t.deletedTransaction = 6
         AND t.transactionTypeID = 5
         AND t.amount < 0
         AND destination.accountTypeID IN (9, 11)
         AND t.reminderTransaction IS NULL
         AND substr(t.date, 1, 10) BETWEEN ? AND ?`,
      previousMonthStart,
      previousMonthEnd,
    );

    const byDate = new Map(dailyRows.map((row) => [row.day, row]));
    const days = dates.map((date) => {
      const row = byDate.get(date);
      return {
        date,
        spent: (row?.rawSpent || 0) / AMOUNT_SCALE,
        transactions: row?.tx || 0,
      };
    });
    const total = days.reduce((sum, day) => sum + day.spent, 0);
    const transactionCount = days.reduce((sum, day) => sum + day.transactions, 0);
    const previousTotal = (previous?.rawSpent || 0) / AMOUNT_SCALE;
    const topCategories = categories.map((item) => ({
      name: item.category,
      amount: item.rawSpent / AMOUNT_SCALE,
    }));
    const liabilitySpent = liabilityRows.reduce((sum, row) => sum + row.rawSpent / AMOUNT_SCALE, 0);
    const monthSpent = monthRows.reduce((sum, row) => sum + row.rawSpent / AMOUNT_SCALE, 0) + liabilitySpent;
    const previousMonth = ((previousMonthRow?.rawSpent || 0) + (previousLiabilityRow?.rawSpent || 0)) / AMOUNT_SCALE;
    const daysElapsed = Math.floor((source.getTime() - cycle.start.getTime()) / 86400000) + 1;
    const daysInMonth = Math.floor((cycle.end.getTime() - cycle.start.getTime()) / 86400000) + 1;
    // Build a robust forecast from the five most recent completed salary
    // cycles. Comparing the same point in each cycle prevents a one-off loan
    // or card payment on payday from being multiplied by every day remaining.
    const historicalCycles: { total: number; samePoint: number }[] = [];
    for (let offset = 1; offset <= 5; offset += 1) {
      const historicalStart = new Date(cycle.start.getFullYear(), cycle.start.getMonth() - offset, payday, 12);
      const historicalNextStart = new Date(historicalStart.getFullYear(), historicalStart.getMonth() + 1, payday, 12);
      const historicalEnd = new Date(historicalNextStart);
      historicalEnd.setDate(historicalEnd.getDate() - 1);
      const comparableEnd = new Date(historicalStart);
      comparableEnd.setDate(comparableEnd.getDate() + Math.min(daysElapsed, daysInMonth) - 1);
      if (comparableEnd > historicalEnd) comparableEnd.setTime(historicalEnd.getTime());

      const historyStart = localIso(historicalStart);
      const historyEnd = localIso(historicalEnd);
      const historyComparableEnd = localIso(comparableEnd);
      const expense = await db.getFirstAsync<{ fullRaw: number; samePointRaw: number }>(
        `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS fullRaw,
                COALESCE(SUM(CASE WHEN substr(t.date, 1, 10) <= ? THEN ABS(t.amount) ELSE 0 END), 0) AS samePointRaw
         FROM TRANSACTIONSTABLE t
         WHERE t.deletedTransaction = 6 AND t.transactionTypeID = 3
           AND t.reminderTransaction IS NULL AND substr(t.date, 1, 10) BETWEEN ? AND ?`,
        historyComparableEnd,
        historyStart,
        historyEnd,
      );
      const debt = await db.getFirstAsync<{ fullRaw: number; samePointRaw: number }>(
        `SELECT COALESCE(SUM(ABS(t.amount)), 0) AS fullRaw,
                COALESCE(SUM(CASE WHEN substr(t.date, 1, 10) <= ? THEN ABS(t.amount) ELSE 0 END), 0) AS samePointRaw
         FROM TRANSACTIONSTABLE t
         JOIN ACCOUNTSTABLE destination ON destination.accountsTableID = t.accountPairID
         WHERE t.deletedTransaction = 6 AND t.transactionTypeID = 5 AND t.amount < 0
           AND destination.accountTypeID IN (9, 11) AND t.reminderTransaction IS NULL
           AND substr(t.date, 1, 10) BETWEEN ? AND ?`,
        historyComparableEnd,
        historyStart,
        historyEnd,
      );
      const total = ((expense?.fullRaw || 0) + (debt?.fullRaw || 0)) / AMOUNT_SCALE;
      const samePoint = ((expense?.samePointRaw || 0) + (debt?.samePointRaw || 0)) / AMOUNT_SCALE;
      if (total > 0) historicalCycles.push({ total, samePoint });
    }

    const historicalTotals = historicalCycles.map((item) => item.total);
    const historicalMean = average(historicalTotals);
    const historicalMedian = median(historicalTotals);
    const recencyWeights = historicalCycles.map((_, index) => historicalCycles.length - index);
    const weightedMean = historicalCycles.length
      ? historicalCycles.reduce((sum, item, index) => sum + item.total * recencyWeights[index], 0)
        / recencyWeights.reduce((sum, weight) => sum + weight, 0)
      : 0;
    const historicalBaseline = historicalCycles.length
      ? historicalMedian * 0.5 + weightedMean * 0.3 + historicalMean * 0.2
      : monthSpent;
    const completionRatios = historicalCycles
      .filter((item) => item.total > 0 && item.samePoint > 0)
      .map((item) => Math.min(1, item.samePoint / item.total));
    const expectedCompletion = median(completionRatios);
    const rawPaceForecast = expectedCompletion > 0 ? monthSpent / expectedCompletion : historicalBaseline;
    const historicalCeiling = historicalTotals.length
      ? Math.max(...historicalTotals) * 1.25
      : rawPaceForecast;
    const historicalFloor = historicalMedian > 0 ? historicalMedian * 0.6 : monthSpent;
    const paceForecast = Math.max(historicalFloor, Math.min(historicalCeiling, rawPaceForecast));
    const cycleProgress = Math.min(1, daysElapsed / Math.max(1, daysInMonth));
    // The first few days commonly contain salary-day commitments. Let history
    // lead until enough variable-spending days exist, then blend live pace in.
    const currentWeight = historicalCycles.length >= 3
      ? daysElapsed < 5 ? 0 : Math.min(0.7, ((daysElapsed - 4) / Math.max(1, daysInMonth - 4)) * 0.7)
      : 1;
    const projected = Math.max(monthSpent,
      historicalBaseline * (1 - currentWeight) + paceForecast * currentWeight);
    const deviations = historicalTotals.map((value) => Math.abs(value - historicalMedian));
    const robustSpread = Math.max(median(deviations) * 1.4826, historicalMean * 0.08);
    const uncertainty = robustSpread * (1.15 - cycleProgress * 0.45);
    const projectedLow = Math.max(monthSpent, projected - uncertainty);
    const projectedHigh = Math.max(projected, projected + uncertainty);
    const projectionConfidence: 'low' | 'medium' | 'high' = historicalCycles.length < 3 || daysElapsed < 5
      ? 'low'
      : daysElapsed < 14 ? 'medium' : 'high';
    const savedBudget = Number(await AsyncStorage.getItem(MONTHLY_BUDGET_KEY));
    const suggestedBudgetBase = historicalMedian > 0 ? historicalMedian : previousMonth > 0 ? previousMonth : projected;
    const suggestedBudget = Math.max(100, Math.ceil(suggestedBudgetBase / 100) * 100);
    const budget = savedBudget > 0 ? savedBudget : suggestedBudget;
    const remaining = budget - monthSpent;
    const daysRemaining = Math.max(1, daysInMonth - daysElapsed + 1);
    const activeDays = new Set([...monthRows.map((row) => row.day), ...liabilityRows.map((row) => row.day)]).size;
    const noSpendDays = Math.max(0, daysElapsed - activeDays);
    const selectedFixedRaw = await AsyncStorage.getItem(FIXED_COMMITMENTS_KEY);
    const selectedFixed = new Set<string>(selectedFixedRaw ? JSON.parse(selectedFixedRaw) : []);
    const fixedKey = (subcategory: string, item: string) => `${subcategory}::${item}`;
    const customCommitmentMap = new Map<string, { name: string; amount: number; transactions: number }>();
    const fixedCommitmentOptions = monthlyCategoriesRows.map((row) => {
      const key = fixedKey(row.subcategory, row.item);
      return { key, label: `${row.subcategory} | ${row.item}`, category: row.category, selected: selectedFixed.has(key), amount: row.rawSpent / AMOUNT_SCALE };
    }).sort((a, b) => Number(b.selected) - Number(a.selected) || b.amount - a.amount);
    const categoryMap = new Map<string, { name: string; amount: number; details: { subcategory: string; item: string; amount: number; share: number; transactions: number }[] }>();
    monthlyCategoriesRows.forEach((item) => {
      const amount = item.rawSpent / AMOUNT_SCALE;
      if (selectedFixed.has(fixedKey(item.subcategory, item.item))) {
        const current = customCommitmentMap.get(item.item) || { name: item.item, amount: 0, transactions: 0 };
        current.amount += amount;
        current.transactions += item.tx;
        customCommitmentMap.set(item.item, current);
        return;
      }
      const category = categoryMap.get(item.category) || { name: item.category, amount: 0, details: [] };
      category.amount += amount;
      category.details.push({ subcategory: item.subcategory, item: item.item, amount, share: 0, transactions: item.tx });
      categoryMap.set(item.category, category);
    });
    const controllableSpent = [...categoryMap.values()].reduce((sum, category) => sum + category.amount, 0);
    const monthlyTopCategories = [...categoryMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((category) => ({
        ...category,
        share: controllableSpent > 0 ? (category.amount / controllableSpent) * 100 : 0,
        details: category.details
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 12)
          .map((detail) => ({ ...detail, share: category.amount > 0 ? (detail.amount / category.amount) * 100 : 0 })),
      }));
    const fixedCommitmentMap = new Map<string, { name: string; amount: number; transactions: number }>();
    liabilityRows.forEach((row) => {
      const current = fixedCommitmentMap.get(row.liability) || { name: row.liability, amount: 0, transactions: 0 };
      current.amount += row.rawSpent / AMOUNT_SCALE;
      current.transactions += row.tx;
      fixedCommitmentMap.set(row.liability, current);
    });
    const fixedCommitments = {
      total: liabilitySpent + [...customCommitmentMap.values()].reduce((sum, item) => sum + item.amount, 0),
      items: [...fixedCommitmentMap.values(), ...customCommitmentMap.values()].sort((a, b) => b.amount - a.amount),
    };
    const alerts: string[] = [];
    if (cashReality.trueSpendable < 0) alerts.push(`Cash illusion alert: selected banks are RM ${Math.abs(cashReality.trueSpendable).toFixed(0)} short after reserving unpaid card debt${cashReality.safetyBuffer > 0 ? ' and your safety buffer' : ''}.`);
    else if (cashReality.cardOutstanding > 0) alerts.push(`After reserving RM ${cashReality.cardOutstanding.toFixed(0)} for unpaid cards, your true spendable cash is RM ${cashReality.trueSpendable.toFixed(0)}.`);
    if (projected > budget) alerts.push(`At this pace, spending may exceed budget by RM ${(projected - budget).toFixed(0)}.`);
    else alerts.push(`Current pace is RM ${(budget - projected).toFixed(0)} below the monthly budget.`);
    if (monthlyTopCategories[0]?.share >= 40) alerts.push(`${monthlyTopCategories[0].name} makes up ${monthlyTopCategories[0].share.toFixed(0)}% of this salary cycle's spending.`);
    if (previousMonth > 0) {
      const paceVsPrevious = ((projected - previousMonth) / previousMonth) * 100;
      alerts.push(`Projected month-end is ${Math.abs(paceVsPrevious).toFixed(0)}% ${paceVsPrevious > 0 ? 'higher' : 'lower'} than last month.`);
    }

    const guardConfigs = await ensureDefaultCreditCardGuard(accountOptions.map((item) => item.name));
    const evaluateGuard = async (guard: SpendingGuard): Promise<SpendingGuardResult> => {
      const selectedCycle = guard.cycle === 'calendar' ? calendarCycle(source) : cycle;
      const guardStart = localIso(selectedCycle.start);
      const guardEnd = localIso(selectedCycle.end);
      const elapsedEnd = sourceDate < guardEnd ? sourceDate : guardEnd;
      const filter = guard.scope === 'account'
        ? 'a.accountName = ?'
        : guard.scope === 'category'
          ? `COALESCE(pc.parentCategoryName, cc.childCategoryName, 'Uncategorised') = ?`
          : `COALESCE(cc.childCategoryName, pc.parentCategoryName, 'Uncategorised') = ?`;
      const joins = `LEFT JOIN ACCOUNTSTABLE a ON a.accountsTableID = t.accountID
        LEFT JOIN CHILDCATEGORYTABLE cc ON cc.categoryTableID = t.categoryID
        LEFT JOIN PARENTCATEGORYTABLE pc ON pc.parentCategoryTableID = cc.parentCategoryID`;
      const rows = await db.getAllAsync<{ date: string; rawAmount: number; itemName: string; category: string; subcategory: string; note: string }>(
        `SELECT substr(t.date, 1, 10) AS date, ABS(t.amount) AS rawAmount,
                COALESCE(NULLIF(TRIM(i.itemName), ''), 'Unnamed transaction') AS itemName,
                COALESCE(pc.parentCategoryName, cc.childCategoryName, 'Uncategorised') AS category,
                COALESCE(cc.childCategoryName, pc.parentCategoryName, 'Uncategorised') AS subcategory,
                COALESCE(t.notes, '') AS note
         FROM TRANSACTIONSTABLE t ${joins}
         LEFT JOIN ITEMTABLE i ON i.itemTableID = t.itemID
         WHERE t.deletedTransaction = 6 AND t.transactionTypeID = 3
           AND t.reminderTransaction IS NULL AND substr(t.date, 1, 10) BETWEEN ? AND ?
           AND ${filter}
         ORDER BY t.date DESC`,
        guardStart,
        elapsedEnd,
        guard.target,
      );
      const spent = rows.reduce((sum, row) => sum + row.rawAmount / AMOUNT_SCALE, 0);
      const breakdownMap = new Map<string, number>();
      rows.forEach((row) => {
        const key = guard.scope === 'account' ? row.subcategory : row.category;
        breakdownMap.set(key, (breakdownMap.get(key) || 0) + row.rawAmount / AMOUNT_SCALE);
      });
      const elapsed = Math.max(1, Math.floor((source.getTime() - selectedCycle.start.getTime()) / 86400000) + 1);
      const cycleDays = Math.max(1, Math.floor((selectedCycle.end.getTime() - selectedCycle.start.getTime()) / 86400000) + 1);
      const percent = guard.limit > 0 ? (spent / guard.limit) * 100 : 0;
      return {
        ...guard,
        spent,
        remaining: guard.limit - spent,
        percent,
        projected: (spent / elapsed) * cycleDays,
        level: guardLevel(percent),
        cycleStart: guardStart,
        cycleEnd: guardEnd,
        transactions: rows.slice(0, 8).map((row) => ({
          date: row.date,
          amount: row.rawAmount / AMOUNT_SCALE,
          itemName: row.itemName,
          category: row.category,
          subcategory: row.subcategory,
          note: row.note,
        })),
        breakdown: [...breakdownMap.entries()]
          .map(([name, amount]) => ({ name, amount, share: spent > 0 ? (amount / spent) * 100 : 0 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 6),
      };
    };
    const spendingGuards = await Promise.all(guardConfigs.map(evaluateGuard));

    return {
      sourceName,
      sourceDate,
      syncedAt: new Date().toISOString(),
      total,
      average: total / dates.length,
      transactionCount,
      topCategory: topCategories[0]?.name || 'No spending',
      topCategoryAmount: topCategories[0]?.amount || 0,
      topCategories,
      previousTotal,
      changePercent: previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null,
      days,
      guardOptions: {
        accounts: accountOptions.map((item) => item.name),
        categories: [...new Set(categoryOptions.map((item) => item.category))],
        subcategories: [...new Set(categoryOptions.map((item) => item.subcategory))],
      },
      spendingGuards,
      cashReality,
      monthly: {
        spent: monthSpent,
        budget,
        budgetIsSuggested: !(savedBudget > 0),
        remaining,
        safeToday: Math.max(0, remaining / daysRemaining),
        projected,
        projectedLow,
        projectedHigh,
        projectionConfidence,
        projectionCycles: historicalCycles.length,
        historicalMean,
        historicalMedian,
        previousMonth,
        cycleStart: monthStart,
        cycleEnd,
        payday,
        noSpendDays,
        daysElapsed,
        daysInMonth,
        topCategories: monthlyTopCategories,
        fixedCommitments,
        fixedCommitmentOptions,
        fixedCommitmentSelection: [...selectedFixed],
        alerts,
      },
    };
  } finally {
    await db.closeAsync();
  }
}
