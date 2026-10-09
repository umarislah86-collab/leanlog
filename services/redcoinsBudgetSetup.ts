import type { RedCoinsState } from './redcoins';
import { termBudgetSummary, validTermBudget, type TermBudget } from './redcoinsTermBudget';
export const setupKey = (category: string, subcategory: string) => `${category}\u0000${subcategory}`;
export function targetBudgetChoices(state: RedCoinsState, category: string, subcategory: string) {
  const cycle = subcategory ? state.subcategoryBudgets[setupKey(category,subcategory)] || 0 : 0;
  const periods = (state.termBudgets || []).filter(b => b.category === category && (b.subcategory || '') === subcategory);
  return { cycle, periods, conflict: (cycle > 0 ? 1 : 0)+periods.length > 1 };
}
export function periodMonthlyEquivalent(b: TermBudget, now = new Date()) {
  if (!validTermBudget(b) || !termBudgetSummary(b,[],now).active) return 0;
  if (b.months) return b.amount/b.months;
  const [sy,sm,sd]=b.startDay.split('-').map(Number),[ey,em,ed]=b.endDay.split('-').map(Number);
  const days=(Date.UTC(ey,em-1,ed)-Date.UTC(sy,sm-1,sd))/86400000+1;
  return b.amount*30.436875/days;
}
/** A planning equivalent, not a charge/reserve or actual period limit. Conflicts stay separate. */
export function periodAllocation(state: RedCoinsState, now = new Date(), category?: string) {
  return (state.termBudgets || []).reduce((sum,b) => {
    if (category && b.category !== category || targetBudgetChoices(state,b.category,b.subcategory || '').conflict) return sum;
    if (!state.categories.some(c=>c.name===b.category && (!b.subcategory || c.subcategories.includes(b.subcategory)))) return sum;
    const overlap = b.subcategory
      ? (state.termBudgets || []).some(other=>other.category===b.category && !other.subcategory)
      : (state.termBudgets || []).some(other=>other.category===b.category && !!other.subcategory) || Object.entries(state.subcategoryBudgets).some(([key,value])=>key.startsWith(`${b.category}\u0000`) && value>0);
    if (overlap) return sum;
    return sum+periodMonthlyEquivalent(b,now);
  },0);
}
export function replaceTargetBudget(state: RedCoinsState, category: string, subcategory: string, choice: { cycle: number } | { period: TermBudget } | null): RedCoinsState {
  const subcategoryBudgets={...state.subcategoryBudgets};delete subcategoryBudgets[setupKey(category,subcategory)];
  const termBudgets=(state.termBudgets || []).filter(b => !(b.category === category && (b.subcategory || '') === subcategory));
  if (choice) {
    const categoryWide = termBudgets.some(b=>b.category===category && !b.subcategory);
    const children = termBudgets.some(b=>b.category===category && !!b.subcategory) || Object.entries(subcategoryBudgets).some(([key,value])=>key.startsWith(`${category}\u0000`) && value>0);
    if (subcategory && categoryWide || !subcategory && children) throw new Error('Category-wide and subcategory budgets overlap. Remove the other level first; nothing was replaced.');
  }
  if (choice && 'cycle' in choice) {
    if (!subcategory || !Number.isFinite(choice.cycle) || choice.cycle <= 0) throw new Error('Choose a subcategory and positive cycle budget.');
    subcategoryBudgets[setupKey(category,subcategory)]=choice.cycle;
  } else if (choice) {
    if (!validTermBudget(choice.period) || choice.period.category !== category || (choice.period.subcategory || '') !== subcategory) throw new Error('Invalid period budget.');
    termBudgets.push(choice.period);
  }
  return {...state,subcategoryBudgets,termBudgets};
}
