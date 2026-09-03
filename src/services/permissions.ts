import { Platform } from 'react-native';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';
import type { PermissionStatus } from '@/types';

export async function checkNotificationPermission(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') return 'denied';
  try {
    const status = await RNAndroidNotificationListener.getPermissionStatus();
    return status as PermissionStatus;
  } catch {
    return 'unknown';
  }
}

/** Opens the Android system settings screen where the user grants notification access. */
export function openNotificationAccessSettings(): void {
  if (Platform.OS !== 'android') return;
  RNAndroidNotificationListener.requestPermission();
}
