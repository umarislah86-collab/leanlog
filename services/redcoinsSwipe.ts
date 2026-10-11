export const redcoinsSections = ['home', 'activity', 'accounts', 'plan', 'reports'] as const;
export function redcoinsSwipeTarget(section: typeof redcoinsSections[number], dx: number, dy: number) {
  if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 2) return null;
  const next = redcoinsSections.indexOf(section) + (dx < 0 ? 1 : -1);
  if (next < 0) return { route: 'Coach' } as const;
  if (next >= redcoinsSections.length) return { route: 'Settings' } as const;
  return { section: redcoinsSections[next] } as const;
}
