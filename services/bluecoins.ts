import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';

const FOLDER_KEY = 'bluecoins_folder_uri_v1';
const CACHE_NAME = 'bluecoins-dashboard-cache.fydb';
const AMOUNT_SCALE = 1_000_000;
const MONTHLY_BUDGET_KEY = 'bluecoins_monthly_budget_v1';
const PAYDAY_KEY = 'bluecoins_payday_v1';

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
  monthly: {
    spent: number;
    budget: number;
    budgetIsSuggested: boolean;
    remaining: number;
    safeToday: number;
    projected: number;
    previousMonth: number;
    cycleStart: string;
    cycleEnd: string;
    payday: number;
    noSpendDays: number;
    daysElapsed: number;
    daysInMonth: number;
    topCategories: { name: string; amount: number; share: number; subcategories: { name: string; amount: number; share: number }[] }[];
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

  const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri);
  const backups = entries
    .filter((uri) => fileNameFromUri(uri).toLowerCase().endsWith('.fydb'))
    .sort((a, b) => fileNameFromUri(b).localeCompare(fileNameFromUri(a)));

  if (!backups.length) throw new Error('NO_BLUECOINS_BACKUP');

  const sourceUri = backups[0];
  const sourceName = fileNameFromUri(sourceUri);
  const sourceDate = backupDateFromName(sourceName);
  const localUri = `${FileSystem.documentDirectory}${CACHE_NAME}`;

  const cached = await FileSystem.getInfoAsync(localUri);
  if (cached.exists) await FileSystem.deleteAsync(localUri, { idempotent: true });
  await FileSystem.copyAsync({ from: sourceUri, to: localUri });

  const db = await SQLite.openDatabaseAsync(
    CACHE_NAME,
    { useNewConnection: true },
    FileSystem.documentDirectory || undefined,
  );

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
    const monthlyCategoriesRows = await db.getAllAsync<{ category: string; subcategory: string; rawSpent: number }>(
      `SELECT COALESCE(pc.parentCategoryName, cc.childCategoryName, 'Uncategorised') AS category,
              COALESCE(cc.childCategoryName, pc.parentCategoryName, 'Uncategorised') AS subcategory,
              COALESCE(SUM(ABS(t.amount)), 0) AS rawSpent
       FROM TRANSACTIONSTABLE t
       LEFT JOIN CHILDCATEGORYTABLE cc ON cc.categoryTableID = t.categoryID
       LEFT JOIN PARENTCATEGORYTABLE pc ON pc.parentCategoryTableID = cc.parentCategoryID
       WHERE t.deletedTransaction = 6
         AND t.transactionTypeID = 3
         AND t.reminderTransaction IS NULL
         AND substr(t.date, 1, 10) BETWEEN ? AND ?
       GROUP BY category, subcategory
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
    const projected = daysElapsed ? (monthSpent / daysElapsed) * daysInMonth : monthSpent;
    const savedBudget = Number(await AsyncStorage.getItem(MONTHLY_BUDGET_KEY));
    const suggestedBudgetBase = previousMonth > 0 ? previousMonth : projected;
    const suggestedBudget = Math.max(100, Math.ceil(suggestedBudgetBase / 100) * 100);
    const budget = savedBudget > 0 ? savedBudget : suggestedBudget;
    const remaining = budget - monthSpent;
    const daysRemaining = Math.max(1, daysInMonth - daysElapsed + 1);
    const activeDays = new Set([...monthRows.map((row) => row.day), ...liabilityRows.map((row) => row.day)]).size;
    const noSpendDays = Math.max(0, daysElapsed - activeDays);
    const categoryMap = new Map<string, { name: string; amount: number; subcategories: { name: string; amount: number; share: number }[] }>();
    monthlyCategoriesRows.forEach((item) => {
      const amount = item.rawSpent / AMOUNT_SCALE;
      const category = categoryMap.get(item.category) || { name: item.category, amount: 0, subcategories: [] };
      category.amount += amount;
      category.subcategories.push({ name: item.subcategory, amount, share: 0 });
      categoryMap.set(item.category, category);
    });
    liabilityRows.forEach((item) => {
      const amount = item.rawSpent / AMOUNT_SCALE;
      const category = categoryMap.get('Debt commitments') || { name: 'Debt commitments', amount: 0, subcategories: [] };
      category.amount += amount;
      const existing = category.subcategories.find((sub) => sub.name === item.liability);
      if (existing) existing.amount += amount;
      else category.subcategories.push({ name: item.liability, amount, share: 0 });
      categoryMap.set('Debt commitments', category);
    });
    const monthlyTopCategories = [...categoryMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((category) => ({
        ...category,
        share: monthSpent > 0 ? (category.amount / monthSpent) * 100 : 0,
        subcategories: category.subcategories
          .sort((a, b) => b.amount - a.amount)
          .map((sub) => ({ ...sub, share: category.amount > 0 ? (sub.amount / category.amount) * 100 : 0 })),
      }));
    const alerts: string[] = [];
    if (projected > budget) alerts.push(`At this pace, spending may exceed budget by RM ${(projected - budget).toFixed(0)}.`);
    else alerts.push(`Current pace is RM ${(budget - projected).toFixed(0)} below the monthly budget.`);
    if (monthlyTopCategories[0]?.share >= 40) alerts.push(`${monthlyTopCategories[0].name} makes up ${monthlyTopCategories[0].share.toFixed(0)}% of this salary cycle's spending.`);
    if (previousMonth > 0) {
      const paceVsPrevious = ((projected - previousMonth) / previousMonth) * 100;
      alerts.push(`Projected month-end is ${Math.abs(paceVsPrevious).toFixed(0)}% ${paceVsPrevious > 0 ? 'higher' : 'lower'} than last month.`);
    }

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
      monthly: {
        spent: monthSpent,
        budget,
        budgetIsSuggested: !(savedBudget > 0),
        remaining,
        safeToday: Math.max(0, remaining / daysRemaining),
        projected,
        previousMonth,
        cycleStart: monthStart,
        cycleEnd,
        payday,
        noSpendDays,
        daysElapsed,
        daysInMonth,
        topCategories: monthlyTopCategories,
        alerts,
      },
    };
  } finally {
    await db.closeAsync();
  }
}
