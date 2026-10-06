import AsyncStorage from '@react-native-async-storage/async-storage';
import { readBluecoinsImport } from './bluecoins';
import { getRedCoinsSummary, loadRedCoins, saveRedCoins } from './redcoins';
import { prepareRedCoinsImport } from './redcoinsImportPlan';
import { migrateAccountPreferences } from './redcoinsAccountIdentity';
import { syncRedCoinsLedger } from './redcoinsLedger';
import { emitRedCoinsChange } from './redcoinsEvents';

type ImportPreview = Awaited<ReturnType<typeof stageRedCoinsImport>>;
let committing = false;
export async function stageRedCoinsImport(folder?: string | null) {
  // FYDB parsing is confined to this explicit user operation.
  const incoming = await readBluecoinsImport(folder);
  const current = await loadRedCoins();
  return { sourceName: incoming.sourceName, original: JSON.stringify(current), incoming, plan: prepareRedCoinsImport(current, incoming) };
}
export async function commitRedCoinsImport(preview: ImportPreview) {
  if (committing) throw new Error('An import is already running.');
  committing = true;
  try {
    const current = await loadRedCoins();
    if (JSON.stringify(current) !== preview.original) throw new Error('RedCoins changed while this preview was open. Preview the import again.');
    await AsyncStorage.setItem('redcoins_before_import_v2', preview.original);
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key === 'bluecoins_cash_reality_accounts_v1' || key === 'bluecoins_spending_guards_v1' || key.startsWith('widget_daily_preferences_') || key.startsWith('widget_account_snapshot_'));
    const preferences = await Promise.all(keys.map(async key => [key, await AsyncStorage.getItem(key)]));
    await AsyncStorage.setItem('redcoins_before_import_preferences_v2', JSON.stringify(Object.fromEntries(preferences)));
    // Recheck after the backup write; never overwrite a concurrently saved edit.
    const latest = await loadRedCoins();
    if (JSON.stringify(latest) !== preview.original) throw new Error('RedCoins changed. Import cancelled safely; preview it again.');
    const plan = prepareRedCoinsImport(latest, preview.incoming);
    await saveRedCoins(plan.state);
    // Durable save is the commit point. Query/index/widget repairs are not
    // grounds for claiming the accepted import was cancelled or replaying it.
    const warnings: string[] = [];
    try { await migrateAccountPreferences(plan.aliases, plan.redirects); } catch { warnings.push('Account display preferences need refreshing.'); }
    try { await syncRedCoinsLedger(plan.state.entries); } catch { warnings.push('Ledger saved; search index will retry when RedCoins opens.'); }
    try { await getRedCoinsSummary(plan.state); } catch { warnings.push('Ledger saved; summary/widget refresh will retry.'); }
    emitRedCoinsChange('state');
    return { ...plan, warnings };
  } finally { committing = false; }
}
