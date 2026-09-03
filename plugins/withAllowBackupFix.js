const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAllowBackupFix(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];

    application.$['android:allowBackup'] = 'false'; // or 'true', your choice
    application.$['tools:replace'] = 'android:allowBackup';

    // make sure xmlns:tools is declared on the root <manifest> tag
    config.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    return config;
  });
};