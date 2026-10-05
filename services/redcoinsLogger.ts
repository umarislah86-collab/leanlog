import type { RedCoinsCategory, RedCoinsEntry, RedCoinsType } from './redcoins';

export function loggerCategories(categories: RedCoinsCategory[], entries: RedCoinsEntry[], type: RedCoinsType) {
  if (type === 'transfer') return [];
  return categories.map((category) => ({
    ...category,
    subcategories: category.subcategories.filter((sub) => {
      const declared = category.subcategoryTypes?.[sub];
      if (declared?.length) return declared.includes(type);
      const observed = new Set(entries.filter((entry) => entry.category === category.name && entry.subcategory === sub && entry.type !== 'transfer').map((entry) => entry.type));
      // Legacy/custom categories without a declared type use ledger evidence.
      // Unclassified pairs stay hidden rather than leaking into both pickers.
      return observed.has(type);
    }),
  })).filter((category) => category.subcategories.length);
}

export function loggerSuggestions(entries: RedCoinsEntry[], text: string, type: RedCoinsType, now = Date.now()) {
  const query = text.trim().toLowerCase();
  if (!query) return [];
  const stats = new Map<string, { entry: RedCoinsEntry; usageCount: number }>();
  entries.filter((entry) => entry.type === type && new Date(entry.date).getTime() <= now).forEach((entry) => {
    const key = entry.item.trim().toLowerCase();
    if (!key || !key.includes(query)) return;
    const current = stats.get(key);
    if (!current) stats.set(key, { entry, usageCount: 1 });
    else {
      current.usageCount += 1;
      if (entry.date > current.entry.date) current.entry = entry;
    }
  });
  const score = (name: string) => name === query ? 4 : name.startsWith(query) ? 3 : name.split(/\s+/).some((word) => word.startsWith(query)) ? 2 : 1;
  return [...stats.values()].sort((a, b) => score(b.entry.item.toLowerCase()) - score(a.entry.item.toLowerCase()) || b.usageCount - a.usageCount || b.entry.date.localeCompare(a.entry.date))
    .slice(0, 6).map(({ entry, usageCount }) => ({ ...entry, usageCount }));
}
