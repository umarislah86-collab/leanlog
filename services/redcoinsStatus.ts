import type { RedCoinsEntry, RedCoinsState } from './redcoins';

/** Bluecoins None is not Pending. Status is review metadata, not a balance gate. */
export function bluecoinsReviewStatus(value: number | null | undefined): NonNullable<RedCoinsEntry['status']> {
  return value === 1 ? 'cleared' : value === 2 ? 'reconciled' : value === 3 ? 'void' : 'none';
}

/** No FYDB reads or balance replay; old lossy mappings cannot prove Cleared. */
export function repairLegacyBluecoinsStatuses(state: RedCoinsState) {
  if (state.statusMappingVersion === 1) return false;
  for (const entry of state.entries) {
    if (entry.origin !== 'bluecoins' || entry.editedAt || entry.statusMappingVersion === 1) continue;
    if (entry.sourceStatus != null) entry.status = bluecoinsReviewStatus(entry.sourceStatus);
    else if (entry.status === 'pending') {
      entry.status = 'none';
      entry.legacyStatusUnknown = true;
    }
    entry.statusMappingVersion = 1;
  }
  state.statusMappingVersion = 1;
  return true;
}
