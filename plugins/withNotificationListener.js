const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * react-native-android-notification-listener autolinks its native module,
 * but Android still requires the NotificationListenerService itself to be
 * declared explicitly in AndroidManifest.xml with the
 * BIND_NOTIFICATION_LISTENER_SERVICE permission — this is a system-level
 * requirement, not something autolinking can safely inject on its own.
 * This plugin adds that <service> entry on `expo prebuild`, so the manifest
 * doesn't have to be hand-edited after every clean prebuild.
 */
const SERVICE_NAME = 'com.reactlibrary.RNAndroidNotificationListener';
const SERVICE_ACTION = 'android.service.notification.NotificationListenerService';

function withNotificationListener(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // Declare the tools namespace on <manifest> if it isn't already there.
    manifest.manifest['$'] = manifest.manifest['$'] || {};
    manifest.manifest['$']['xmlns:tools'] =
      manifest.manifest['$']['xmlns:tools'] || 'http://schemas.android.com/tools';

    const application = manifest.manifest.application[0];

    // The listener library ships allowBackup="false" in its own manifest,
    // which conflicts with the app's allowBackup="true". Tell the merger
    // to keep the app's value.
    application['$']['tools:replace'] = application['$']['tools:replace']
      ? `${application['$']['tools:replace']},android:allowBackup`
      : 'android:allowBackup';

    application.service = application.service || [];

    const alreadyDeclared = application.service.some(
      (service) => service['$']['android:name'] === SERVICE_NAME
    );

    if (!alreadyDeclared) {
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:label': 'Sentry Relay Notification Listener',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': SERVICE_ACTION,
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = withNotificationListener;
