import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

/**
 * Thin wrapper around the custom native module injected by
 * plugins/withForegroundService.js during `expo prebuild`. That module is
 * only present in a native Android build (not Expo Go), so every call here
 * is defensive — falling back to a no-op (or a JS-only approximation) if
 * the native side isn't linked yet, e.g. mid-development before a rebuild.
 */
const { RelayNative } = NativeModules as {
  RelayNative?: {
    startForegroundService(): void;
    stopForegroundService(): void;
    isIgnoringBatteryOptimizations(): Promise<boolean>;
    requestIgnoreBatteryOptimizations(): void;
    scheduleRetry(eventId: string, delayMillis: number): void;
    cancelRetry(eventId: string): void;
  };
};

function warnMissingNative(method: string) {
  if (__DEV__) {
    console.warn(
      `[relayNative] RelayNative.${method} called but the native module isn't linked. ` +
        'Run `npx expo prebuild -p android` and rebuild the dev client.'
    );
  }
}

/** Starts the persistent foreground service + notification that keeps the
 * process (and therefore the notification listener) alive under aggressive
 * OEM battery managers. Safe to call repeatedly; Android no-ops a
 * re-started foreground service. */
export async function startForegroundMonitoring(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!RelayNative) return warnMissingNative('startForegroundService');

  // Android 13+ (API 33) requires runtime consent for ANY notification,
  // including the persistent one a foreground service must show. Without
  // this, startForegroundService() still keeps the process alive but the
  // notification itself silently fails to display on API 33+.
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    } catch {
      // Proceed regardless — the foreground service still protects the
      // process even if the user declines to see its notification.
    }
  }

  RelayNative.startForegroundService();
}

export function stopForegroundMonitoring(): void {
  if (Platform.OS !== 'android') return;
  if (!RelayNative) return warnMissingNative('stopForegroundService');
  RelayNative.stopForegroundService();
}

export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (!RelayNative) {
    warnMissingNative('isIgnoringBatteryOptimizations');
    return false;
  }
  try {
    return await RelayNative.isIgnoringBatteryOptimizations();
  } catch {
    return false;
  }
}

/** Launches the system dialog asking the user to exempt this app from
 * battery optimization (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`). */
export function requestIgnoreBatteryOptimizations(): void {
  if (Platform.OS !== 'android') return;
  if (!RelayNative) return warnMissingNative('requestIgnoreBatteryOptimizations');
  RelayNative.requestIgnoreBatteryOptimizations();
}

/**
 * Schedules a single retry attempt through WorkManager, which survives
 * process death / Doze / app-standby far more reliably than a JS
 * `setTimeout`. When it fires, Android starts `RetryTaskService`, which runs
 * the `RetryDeliveryTask` headless JS task registered in index.js.
 *
 * Falls back to `setTimeout` (best-effort only, lost if the JS thread is
 * killed) when the native module isn't available, e.g. running in Expo Go.
 */
export function scheduleRetry(
  eventId: string,
  delayMillis: number,
  fallback: () => void
): void {
  if (Platform.OS === 'android' && RelayNative) {
    RelayNative.scheduleRetry(eventId, delayMillis);
    return;
  }
  warnMissingNative('scheduleRetry (falling back to setTimeout — not crash-safe)');
  setTimeout(fallback, delayMillis);
}

export function cancelRetry(eventId: string): void {
  if (Platform.OS !== 'android' || !RelayNative) return;
  RelayNative.cancelRetry(eventId);
}
