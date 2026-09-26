import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { getBluecoinsFolder, refreshBluecoinsSummary } from './bluecoins';
import { syncPinnedGuardSnapshot } from './spendingGuards';
import { refreshLeanLogWidget } from './widget';

const BLUECOINS_BACKGROUND_TASK = 'leanlog-bluecoins-drive-sync-v1';
export const BLUECOINS_BACKGROUND_STATUS_KEY = 'bluecoins_background_sync_status_v1';

if (!TaskManager.isTaskDefined(BLUECOINS_BACKGROUND_TASK)) {
  TaskManager.defineTask(BLUECOINS_BACKGROUND_TASK, async () => {
    try {
      const folder = await getBluecoinsFolder();
      if (!folder) return BackgroundTask.BackgroundTaskResult.Success;

      const summary = await refreshBluecoinsSummary(folder);
      await syncPinnedGuardSnapshot(summary.spendingGuards, summary.sourceDate);
      await AsyncStorage.setItem(BLUECOINS_BACKGROUND_STATUS_KEY, JSON.stringify({
        ok: true,
        sourceName: summary.sourceName,
        sourceDate: summary.sourceDate,
        syncedAt: summary.syncedAt,
      }));
      await refreshLeanLogWidget();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      await AsyncStorage.setItem(BLUECOINS_BACKGROUND_STATUS_KEY, JSON.stringify({
        ok: false,
        syncedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }));
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function ensureBluecoinsBackgroundSync() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  await BackgroundTask.registerTaskAsync(BLUECOINS_BACKGROUND_TASK, { minimumInterval: 15 });
  return true;
}
