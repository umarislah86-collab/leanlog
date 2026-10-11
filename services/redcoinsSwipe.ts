export const redcoinsSections = ['home', 'activity', 'accounts', 'plan', 'reports'] as const;
export function redcoinsPageTarget(position: number): { route: 'Coach' | 'Settings' } | { section: typeof redcoinsSections[number] } | null {
  if (!Number.isInteger(position) || position < 0 || position > redcoinsSections.length + 1) return null;
  if (position === 0) return { route: 'Coach' } as const;
  if (position === redcoinsSections.length + 1) return { route: 'Settings' } as const;
  return { section: redcoinsSections[position - 1] } as const;
}
