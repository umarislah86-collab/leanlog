import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { markLazyDay } from './nagging';

const NAG_ACTION_TASK = 'LEANLOG_NAG_ACTION_TASK';

if (!TaskManager.isTaskDefined(NAG_ACTION_TASK)) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(NAG_ACTION_TASK, async ({ data, error }) => {
    if (error || !data || !('actionIdentifier' in data)) return;
    const response = data as Notifications.NotificationResponse;
    if (response.actionIdentifier === 'NAG_LAZY') {
      await markLazyDay();
    }
  });
}

Notifications.registerTaskAsync(NAG_ACTION_TASK).catch(() => {});
