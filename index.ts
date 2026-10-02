import { registerRootComponent } from 'expo';
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './widgets/widget-task-handler';
import { WidgetConfigurationScreen } from './widgets/WidgetConfigurationScreen';
import './services/notificationTasks';
import { ensureBluecoinsBackgroundSync } from './services/bluecoinsBackground';

registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
registerWidgetConfigurationScreen(WidgetConfigurationScreen);
ensureBluecoinsBackgroundSync().catch(() => {});
