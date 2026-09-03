const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * react-native-android-notification-listener ships its own
 * AndroidManifest.xml with <service>, <receiver>, and permission entries —
 * these auto-merge into the app manifest via Gradle's manifest merger, no
 * manual injection needed.
 *
 * The one conflict it introduces is android:allowBackup="false" in its
 * manifest vs. the app's android:allowBackup="true", which fails the
 * merge. This plugin adds tools:replace so the app's value wins.
 */
function withNotificationListener(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    manifest.manifest['$'] = manifest.manifest['$'] || {};
    manifest.manifest['$']['xmlns:tools'] =
      manifest.manifest['$']['xmlns:tools'] || 'http://schemas.android.com/tools';

    const application = manifest.manifest.application[0];

    application['$']['android:allowBackup'] =
      application['$']['android:allowBackup'] || 'true';

    application['$']['tools:replace'] = application['$']['tools:replace']
      ? `${application['$']['tools:replace']},android:allowBackup`
      : 'android:allowBackup';

    return config;
  });
}

module.exports = withNotificationListener;