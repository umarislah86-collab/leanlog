import type { RedCoinsCategory, RedCoinsEntry, RedCoinsType } from './redcoins';

/** Income and expense share the entire saved category tree.
 * Metadata stays intact for imports/reports; it no longer restricts manual choice.
 */
export function loggerCategories(categories: RedCoinsCategory[], _entries: RedCoinsEntry[], type: RedCoinsType) {
  return type === 'transfer' ? [] : categories;
}

export function loggerSuggestions(entries: RedCoinsEntry[], text: string, type: RedCoinsType, now = Date.now()) {
  const query = text.trim().toLowerCase();
  if (!query) return [];
  const stats = new Map<string, { entry: RedCoinsEntry; usageCount: number }>();
  for (const entry of entries) {
    if (entry.type !== type) continue;
    const key = entry.item.trim().toLowerCase();
    if (!key || !key.includes(query) || !(new Date(entry.date).getTime() <= now)) continue;
    const current = stats.get(key);
    if (!current) stats.set(key, { entry, usageCount: 1 });
    else {
      current.usageCount += 1;
      if (entry.date > current.entry.date) current.entry = entry;
    }
  }
  const score = (name: string) => name === query ? 4 : name.startsWith(query) ? 3 : name.split(/\s+/).some((word) => word.startsWith(query)) ? 2 : 1;
  return [...stats.values()].sort((a, b) => score(b.entry.item.toLowerCase()) - score(a.entry.item.toLowerCase()) || b.usageCount - a.usageCount || b.entry.date.localeCompare(a.entry.date))
    .slice(0, 6).map(({ entry, usageCount }) => ({ ...entry, usageCount }));
}
