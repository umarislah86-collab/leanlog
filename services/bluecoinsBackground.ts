import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
const BLUECOINS_BACKGROUND_TASK = 'leanlog-bluecoins-drive-sync-v1';
export const BLUECOINS_BACKGROUND_STATUS_KEY = 'bluecoins_background_sync_status_v1';
// Previously registered jobs are inert after migration. Import needs a preview.
if (!TaskManager.isTaskDefined(BLUECOINS_BACKGROUND_TASK)) {
  TaskManager.defineTask(BLUECOINS_BACKGROUND_TASK, async () => BackgroundTask.BackgroundTaskResult.Success);
}
export async function ensureBluecoinsBackgroundSync() {
  await AsyncStorage.setItem('bluecoins_auto_sync_v1', 'false');
  if (await TaskManager.isTaskRegisteredAsync(BLUECOINS_BACKGROUND_TASK)) await BackgroundTask.unregisterTaskAsync(BLUECOINS_BACKGROUND_TASK);
  return false;
}
