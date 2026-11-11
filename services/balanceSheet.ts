import type { RedCoinsAccount, RedCoinsAccountType, RedCoinsEntry } from './redcoins';

export type ComparisonPreset =
  | 'end_of_last_week'
  | 'end_of_two_weeks_ago'
  | 'end_of_last_month'
  | 'same_time_last_month'
  | 'end_of_last_quarter'
  | 'end_of_last_year'
  | 'same_time_last_year'
  | 'ends_this_month';

export interface PresetOption {
  id: ComparisonPreset;
  label: string;
}

export const PRESET_OPTIONS: PresetOption[] = [
  { id: 'end_of_last_week', label: 'End of Last Week' },
  { id: 'end_of_two_weeks_ago', label: 'End of Two Weeks Ago' },
  { id: 'end_of_last_month', label: 'End of Last Month' },
  { id: 'same_time_last_month', label: 'Same Time Last Month' },
  { id: 'end_of_last_quarter', label: 'End of Last Quarter' },
  { id: 'end_of_last_year', label: 'End of Last Year' },
  { id: 'same_time_last_year', label: 'Same Time Last Year' },
  { id: 'ends_this_month', label: 'Ends - This Month' },
];

/**
 * Resolves comparison date based on preset relative to reference date.
 */
export function resolveComparisonDate(preset: ComparisonPreset, ref: Date = new Date()): Date {
  const d = new Date(ref);

  switch (preset) {
    case 'end_of_last_week': {
      // Last Sunday at 23:59:59.999
      const day = d.getDay(); // 0 is Sunday
      const diff = day === 0 ? 7 : day;
      const target = new Date(d);
      target.setDate(d.getDate() - diff);
      target.setHours(23, 59, 59, 999);
      return target;
    }
    case 'end_of_two_weeks_ago': {
      const day = d.getDay();
      const diff = (day === 0 ? 7 : day) + 7;
      const target = new Date(d);
      target.setDate(d.getDate() - diff);
      target.setHours(23, 59, 59, 999);
      return target;
    }
    case 'end_of_last_month': {
      // Day 0 of current month = last day of previous month
      return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);
    }
    case 'same_time_last_month': {
      const target = new Date(d);
      target.setMonth(d.getMonth() - 1);
      return target;
    }
    case 'end_of_last_quarter': {
      const currentQuarter = Math.floor(d.getMonth() / 3);
      // Quarter start months: Q0: 0 (Jan), Q1: 3 (Apr), Q2: 6 (Jul), Q3: 9 (Oct)
      const lastQuarterEndMonth = currentQuarter * 3; // Day 0 of this month is end of prev quarter
      return new Date(d.getFullYear(), lastQuarterEndMonth, 0, 23, 59, 59, 999);
    }
    case 'end_of_last_year': {
      return new Date(d.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    }
    case 'same_time_last_year': {
      const target = new Date(d);
      target.setFullYear(d.getFullYear() - 1);
      return target;
    }
    case 'ends_this_month': {
      // Day 0 of next month is end of this month
      return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    default:
      return new Date(d);
  }
}

/**
 * Calculates snapshot balances for all accounts at targetDate.
 */
export function calculateAccountBalancesAtDate(
  accounts: RedCoinsAccount[],
  entries: RedCoinsEntry[],
  targetDate: Date,
  now: Date = new Date()
): Map<string, number> {
  const balanceMap = new Map<string, number>(accounts.map((a) => [a.name, a.balance]));
  const targetTime = targetDate.getTime();
  const nowTime = now.getTime();

  if (targetTime <= nowTime) {
    // Target is in the past or now:
    // Rewind all entries that occurred after targetDate up to now
    entries.forEach((entry) => {
      const entryTime = new Date(entry.date).getTime();
      if (entryTime > targetTime && entryTime <= nowTime && entry.balanceEffectApplied !== false) {
        if (entry.type === 'expense') {
          balanceMap.set(entry.account, (balanceMap.get(entry.account) || 0) + entry.amount);
        } else if (entry.type === 'income') {
          balanceMap.set(entry.account, (balanceMap.get(entry.account) || 0) - entry.amount);
        } else if (entry.type === 'transfer') {
          balanceMap.set(entry.account, (balanceMap.get(entry.account) || 0) + entry.amount);
          if (entry.toAccount) {
            balanceMap.set(entry.toAccount, (balanceMap.get(entry.toAccount) || 0) - entry.amount);
          }
        }
      }
    });
  } else {
    // Target is in the future:
    // Apply future scheduled entries between now and targetDate
    entries.forEach((entry) => {
      const entryTime = new Date(entry.date).getTime();
      if (entryTime > nowTime && entryTime <= targetTime) {
        if (entry.type === 'expense') {
          balanceMap.set(entry.account, (balanceMap.get(entry.account) || 0) - entry.amount);
        } else if (entry.type === 'income') {
          balanceMap.set(entry.account, (balanceMap.get(entry.account) || 0) + entry.amount);
        } else if (entry.type === 'transfer') {
          balanceMap.set(entry.account, (balanceMap.get(entry.account) || 0) - entry.amount);
          if (entry.toAccount) {
            balanceMap.set(entry.toAccount, (balanceMap.get(entry.toAccount) || 0) + entry.amount);
          }
        }
      }
    });
  }

  return balanceMap;
}

export type TrendDirection = 'up' | 'down' | 'same';

export interface AccountItemSnapshot {
  id: string;
  name: string;
  type: RedCoinsAccountType;
  pastBalance: number;
  currentBalance: number;
  delta: number;
  percentOfGroup: number;
  percentOfSection: number;
  trend: TrendDirection;
}

export interface AccountGroupSnapshot {
  type: RedCoinsAccountType;
  pastTotal: number;
  currentTotal: number;
  delta: number;
  percentOfSection: number;
  trend: TrendDirection;
  accounts: AccountItemSnapshot[];
}

export interface SectionSnapshot {
  title: 'Assets' | 'Liabilities';
  pastTotal: number;
  currentTotal: number;
  delta: number;
  trend: TrendDirection;
  groups: AccountGroupSnapshot[];
}

export interface BalanceSheetData {
  referenceDate: Date;
  comparisonDate: Date;
  preset: ComparisonPreset;
  assets: SectionSnapshot;
  liabilities: SectionSnapshot;
  netWorth: {
    past: number;
    current: number;
    delta: number;
    trend: TrendDirection;
  };
}

export function computeBalanceSheet(
  accounts: RedCoinsAccount[],
  entries: RedCoinsEntry[],
  comparisonDate: Date,
  referenceDate: Date = new Date(),
  preset: ComparisonPreset = 'same_time_last_month'
): BalanceSheetData {
  const pastBalances = calculateAccountBalancesAtDate(accounts, entries, comparisonDate, referenceDate);
  const currentBalances = calculateAccountBalancesAtDate(accounts, entries, referenceDate, referenceDate);

  const isLiability = (type: RedCoinsAccountType) => type === 'Credit card' || type === 'Liability';

  // Group accounts by type
  const groupOrder: RedCoinsAccountType[] = ['Bank', 'Cash', 'Investment', 'Credit card', 'Liability'];
  const assetTypes = new Set<RedCoinsAccountType>(['Bank', 'Cash', 'Investment']);
  const liabilityTypes = new Set<RedCoinsAccountType>(['Credit card', 'Liability']);

  // Calculate totals first for percentage calculations
  let assetPastTotal = 0;
  let assetCurrentTotal = 0;
  let liabilityPastTotal = 0;
  let liabilityCurrentTotal = 0;

  accounts.forEach((a) => {
    const past = pastBalances.get(a.name) || 0;
    const curr = currentBalances.get(a.name) || 0;

    if (liabilityTypes.has(a.type)) {
      // In balance sheet, liabilities are shown as positive obligations/debt
      const pastDebt = past < 0 ? Math.abs(past) : past;
      const currDebt = curr < 0 ? Math.abs(curr) : curr;
      liabilityPastTotal += pastDebt;
      liabilityCurrentTotal += currDebt;
    } else {
      assetPastTotal += past;
      assetCurrentTotal += curr;
    }
  });

  const getTrend = (current: number, past: number, isDebt = false): TrendDirection => {
    const diff = current - past;
    if (Math.abs(diff) < 0.01) return 'same';
    if (isDebt) {
      // For debt: more debt is bad (up), less debt is good (down)
      return diff > 0 ? 'up' : 'down';
    }
    return diff > 0 ? 'up' : 'down';
  };

  const buildGroup = (
    type: RedCoinsAccountType,
    sectionCurrentTotal: number,
    sectionIsLiability: boolean
  ): AccountGroupSnapshot => {
    const groupAccounts = accounts.filter((a) => a.type === type);
    let pastTotal = 0;
    let currentTotal = 0;

    const items: AccountItemSnapshot[] = groupAccounts.map((a) => {
      let past = pastBalances.get(a.name) || 0;
      let curr = currentBalances.get(a.name) || 0;

      if (sectionIsLiability) {
        past = past < 0 ? Math.abs(past) : past;
        curr = curr < 0 ? Math.abs(curr) : curr;
      }

      pastTotal += past;
      currentTotal += curr;
      const delta = curr - past;

      return {
        id: a.id,
        name: a.name,
        type: a.type,
        pastBalance: past,
        currentBalance: curr,
        delta,
        percentOfGroup: 0,
        percentOfSection: sectionCurrentTotal > 0 ? Math.round((curr / sectionCurrentTotal) * 100) : 0,
        trend: getTrend(curr, past, sectionIsLiability),
      };
    });

    items.forEach((item) => {
      item.percentOfGroup = currentTotal > 0 ? Math.round((item.currentBalance / currentTotal) * 100) : 0;
    });

    const delta = currentTotal - pastTotal;

    return {
      type,
      pastTotal,
      currentTotal,
      delta,
      percentOfSection: sectionCurrentTotal > 0 ? Math.round((currentTotal / sectionCurrentTotal) * 100) : 0,
      trend: getTrend(currentTotal, pastTotal, sectionIsLiability),
      accounts: items,
    };
  };

  const assetGroups = groupOrder
    .filter((t) => assetTypes.has(t) && accounts.some((a) => a.type === t))
    .map((t) => buildGroup(t, assetCurrentTotal, false));

  const liabilityGroups = groupOrder
    .filter((t) => liabilityTypes.has(t) && accounts.some((a) => a.type === t))
    .map((t) => buildGroup(t, liabilityCurrentTotal, true));

  const netWorthPast = assetPastTotal - liabilityPastTotal;
  const netWorthCurrent = assetCurrentTotal - liabilityCurrentTotal;

  return {
    referenceDate,
    comparisonDate,
    preset,
    assets: {
      title: 'Assets',
      pastTotal: assetPastTotal,
      currentTotal: assetCurrentTotal,
      delta: assetCurrentTotal - assetPastTotal,
      trend: getTrend(assetCurrentTotal, assetPastTotal, false),
      groups: assetGroups,
    },
    liabilities: {
      title: 'Liabilities',
      pastTotal: liabilityPastTotal,
      currentTotal: liabilityCurrentTotal,
      delta: liabilityCurrentTotal - liabilityPastTotal,
      trend: getTrend(liabilityCurrentTotal, liabilityPastTotal, true),
      groups: liabilityGroups,
    },
    netWorth: {
      past: netWorthPast,
      current: netWorthCurrent,
      delta: netWorthCurrent - netWorthPast,
      trend: getTrend(netWorthCurrent, netWorthPast, false),
    },
  };
}
