import type { RedCoinsEntry } from './redcoins';
import type { SpendingGuard, SpendingGuardResult } from './spendingGuards';

const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function evaluateRedCoinsGuards(configs: SpendingGuard[], entries: RedCoinsEntry[], salaryCycle: { cycleStart: string; cycleEnd: string }, now = new Date()): SpendingGuardResult[] {
  return configs.map((config) => {
    const cycleStart = config.cycle === 'calendar' ? localDay(new Date(now.getFullYear(), now.getMonth(), 1)) : salaryCycle.cycleStart;
    const cycleEnd = config.cycle === 'calendar' ? localDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) : salaryCycle.cycleEnd;
    const start = new Date(`${cycleStart}T00:00:00`);
    const end = new Date(`${cycleEnd}T23:59:59`);
    const rows = entries.filter((entry) => entry.type === 'expense' && new Date(entry.date) >= start && new Date(entry.date) <= end && new Date(entry.date) <= now &&
      (config.scope === 'account' ? entry.account === config.target : config.scope === 'category' ? entry.category === config.target : entry.subcategory === config.target));
    const spent = rows.reduce((sum, entry) => sum + entry.amount, 0);
    const percent = config.limit ? spent / config.limit * 100 : 0;
    const breakdown = new Map<string, number>();
    rows.forEach((entry) => { const key = config.scope === 'subcategory' ? entry.item : entry.subcategory; breakdown.set(key, (breakdown.get(key) || 0) + entry.amount); });
    return {
      ...config, cycleStart, cycleEnd, spent, percent, remaining: config.limit - spent,
      projected: spent / Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1) * Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1),
      level: percent >= 100 ? 'breached' : percent >= 85 ? 'danger' : percent >= 70 ? 'slow-down' : percent >= 50 ? 'heads-up' : 'safe',
      breakdown: [...breakdown].map(([name, amount]) => ({ name, amount, share: spent ? amount / spent * 100 : 0 })).sort((a, b) => b.amount - a.amount).slice(0, 6),
      transactions: rows.map((entry) => ({ date: localDay(new Date(entry.date)), amount: entry.amount, itemName: entry.item, category: entry.category, subcategory: entry.subcategory, note: entry.note || '', origin: entry.origin })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100),
    };
  });
}
