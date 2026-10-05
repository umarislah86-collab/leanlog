import { registerRootComponent } from 'expo';
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './widgets/widget-task-handler';
import { WidgetConfigurationScreen } from './widgets/WidgetConfigurationScreen';
import './services/notificationTasks';
import { ensureBluecoinsBackgroundSync } from './services/bluecoinsBackground';
import { processRedCoinsDue } from './services/redcoinsRuntime';

registerRootComponent(App);
registerWidgetTaskHandler(widgetTaskHandler);
registerWidgetConfigurationScreen(WidgetConfigurationScreen);
ensureBluecoinsBackgroundSync().catch(() => {});
processRedCoinsDue().catch(console.warn);
