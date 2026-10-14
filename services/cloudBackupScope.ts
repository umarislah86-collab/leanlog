/** Finance is backed up separately through RedCoins JSON, never LeanLog cloud. */
export function shouldCloudBackupKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/^@/, '');
  if (lower.startsWith('redcoins') || lower.startsWith('bluecoins')) return false;
  if (lower.includes('firebase') || lower.includes('cache') || lower.includes('widget') || lower.includes('notification_state')) return false;
  if (['last_uid', 'nag_mode_schedule_v1', 'nag_mode_last_snooze_action_v1'].includes(lower)) return false;
  return true;
}

export function filterCloudState(state: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(state).filter(([key]) => shouldCloudBackupKey(key)));
}
