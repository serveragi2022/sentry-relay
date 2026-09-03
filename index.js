import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import { RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';
import App from './App';
import { handleIncomingNotification, retryDeliveryTask } from './src/services/notificationProcessor';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App),
// and wraps it so Expo Go / dev builds behave the same as a bare RN app.
registerRootComponent(App);

/**
 * Registers the headless task that Android invokes whenever an authorized
 * notification arrives, even while the app is backgrounded or closed. This
 * MUST be required early (here, in index.js) so the JS engine has it wired
 * up before the native side ever tries to invoke it.
 *
 * The task function must resolve its promise — handleIncomingNotification
 * awaits the full parse -> filter -> queue -> deliver (with retries) flow
 * before returning, so Android knows when the task is actually done.
 */
AppRegistry.registerHeadlessTask(
  RNAndroidNotificationListenerHeadlessJsName,
  () => handleIncomingNotification
);

/**
 * Registers the retry headless task. Invoked by the native `RetryTaskService`
 * whenever a WorkManager-scheduled retry job fires (see
 * plugins/withForegroundService.js / src/services/relayNative.ts). Unlike a
 * plain setTimeout loop, WorkManager persists this schedule across process
 * death, so a retry that was due while the app was killed in the background
 * still runs once Android wakes the process back up.
 */
AppRegistry.registerHeadlessTask('RetryDeliveryTask', () => retryDeliveryTask);
