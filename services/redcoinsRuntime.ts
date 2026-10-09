import { AppRegistry, AppState } from 'react-native';
import { hasSavedRedCoins, loadRedCoins } from './redcoins';
import { syncRedCoinsLedger } from './redcoinsLedger';
import { syncReminderNotifications } from './redcoinsReminders';
import { refreshLeanLogWidget } from './widget';

let running: Promise<void> | null = null;
export function processRedCoinsDue() {
  if (running) return running;
  running = (async () => {
    if (!await hasSavedRedCoins()) return;
    const state = await loadRedCoins();
    await syncRedCoinsLedger(state.entries);
    await syncReminderNotifications(state.reminders);
    await refreshLeanLogWidget();
  })().finally(() => { running = null; });
  return running;
}

AppRegistry.registerHeadlessTask('LeanLogRedCoinsDue', () => processRedCoinsDue);
AppState.addEventListener('change', (status) => {
  if (status === 'active') void processRedCoinsDue().catch(console.warn);
});
