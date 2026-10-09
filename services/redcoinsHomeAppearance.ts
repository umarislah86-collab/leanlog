import type { AppPalette } from './appTheme';
/** Small Home labels need financial foregrounds, not chart fill colours. */
export function homeColours(p: AppPalette) {
  return { surface: p.surface, text: p.text, muted: p.muted, border: p.border,
    expense: p.dark ? p.expense : '#B52D36', income: p.dark ? p.income : '#146B50', transfer: p.dark ? p.transfer : '#245FBD' };
}
export function homeStyleOverrides(p: AppPalette) {
  if (p.id === 'cream') return {};
  const c = homeColours(p);
  return {
    dashCard: { backgroundColor: c.surface, borderColor: c.border },
    summaryLine: { flexWrap: 'wrap', gap: 6 },
    weekBar: { backgroundColor: c.expense }, budgetFill: { backgroundColor: c.expense },
    weekAmount: { color: c.text, fontSize: 10 }, weekLabel: { color: c.muted, fontSize: 10 },
    summaryMuted: { color: c.muted, fontSize: 11 }, summaryExpense: { color: c.expense, fontSize: 11 },
    calendarKeyText: { color: c.expense, fontSize: 10 }, calendarWeek: { color: c.muted, fontSize: 10 },
    calendarNumber: { color: c.text, fontSize: 12 },
    legendName: { color: c.text, fontSize: 11 }, legendValue: { color: c.text, fontSize: 11 },
    donutLabel: { color: c.muted, fontSize: 9 }, donutValue: { color: c.text, fontSize: 11 },
    favoriteName: { color: c.text, fontSize: 13 }, favoriteBalance: { color: c.income, fontSize: 13 },
    favoriteTotal: { color: c.income, fontSize: 13 }, balanceSheetText: { color: c.text, fontSize: 10 },
  };
}
export function applyHomeAppearance<T extends Record<string, object>>(base: T, p: AppPalette): T {
  if (p.id === 'cream') return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(homeStyleOverrides(p))) {
    if (key in base) (result as Record<string, object>)[key] = { ...base[key], ...value };
  }
  return result;
}
