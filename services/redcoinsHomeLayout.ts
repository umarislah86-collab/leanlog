export const HOME_LAYOUT_KEY = 'redcoins_home_layout_v1';
export const homeCardIds = ['daily', 'calendar', 'budget', 'favorites', 'flow', 'cash'] as const;
export type HomeCardId = typeof homeCardIds[number];
export const homeCardLabels: Record<HomeCardId, string> = { daily: 'Daily Summary', calendar: 'Calendar', budget: 'Budget Summary', favorites: 'Favorite Accounts', flow: 'Cash Flow', cash: 'Cash Reality' };
export function normalizeHomeOrder(value: unknown): HomeCardId[] {
  const valid = Array.isArray(value) ? value.filter((id): id is HomeCardId => homeCardIds.includes(id)) : [];
  return [...new Set([...valid, ...homeCardIds])];
}
export function moveHomeCard(order: HomeCardId[], id: HomeCardId, direction: -1 | 1): HomeCardId[] {
  const next = normalizeHomeOrder(order); const from = next.indexOf(id); const to = from + direction;
  if (from >= 0 && to >= 0 && to < next.length) [next[from], next[to]] = [next[to], next[from]];
  return next;
}
