import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './widgets/widget-task-handler';
import './services/notificationTasks';
import { ensureBluecoinsBackgroundSync } from './services/bluecoinsBackground';

registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
ensureBluecoinsBackgroundSync().catch(() => {});
