import type { redcoinsSections } from './redcoinsSwipe';

export type RedCoinsSection = typeof redcoinsSections[number];
type MoneyNavigation = { section: RedCoinsSection; select: (section: RedCoinsSection) => void };

// Only the small dock subscribes. Publishing a highlight must not rerender the
// finance screen (or wait for its report/ledger render to finish).
export function createNavigationDock() {
  let snapshot: MoneyNavigation | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    showSection: (section: RedCoinsSection) => {
      if (!snapshot || snapshot.section === section) return;
      snapshot = { ...snapshot, section };
      notify();
    },
    connect: (section: RedCoinsSection, select: MoneyNavigation['select']) => {
      snapshot = { section, select };
      notify();
      return () => {
        if (snapshot?.select !== select) return;
        snapshot = null;
        notify();
      };
    },
  };
}
