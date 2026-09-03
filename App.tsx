import React, { useCallback, useEffect, useState } from 'react';
import { View, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as useInterFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAppStore } from '@/store/useAppStore';
import { checkNotificationPermission } from '@/services/permissions';
import { startForegroundMonitoring, stopForegroundMonitoring } from '@/services/relayNative';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });
  const setPermissionStatus = useAppStore((s) => s.setPermissionStatus);
  const purgeExpired = useAppStore((s) => s.purgeExpired);
  const permissionStatus = useAppStore((s) => s.permissionStatus);
  const forwardingEnabled = useAppStore((s) => s.settings.forwardingEnabled);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const status = await checkNotificationPermission();
      setPermissionStatus(status);
      purgeExpired();
      setReady(true);
    })();
  }, []);

  // Re-check permission status whenever the app comes back to the
  // foreground — e.g. returning from the Android notification-access
  // settings screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        const status = await checkNotificationPermission();
        setPermissionStatus(status);
      }
    });
    return () => sub.remove();
  }, []);

  // Keep the foreground service running exactly while monitoring is
  // actually meaningful: notification access granted AND forwarding not
  // switched off via the master kill switch. This is what keeps the
  // process (and the notification listener binding) alive under
  // aggressive OEM battery managers when the app is idle in the
  // background.
  useEffect(() => {
    if (!ready) return;
    if (permissionStatus === 'authorized' && forwardingEnabled) {
      startForegroundMonitoring();
    } else {
      stopForegroundMonitoring();
    }
  }, [ready, permissionStatus, forwardingEnabled]);

  const onLayout = useCallback(async () => {
    if (fontsLoaded && ready) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <StatusBar style="dark" />
        <RootNavigator />
      </View>
    </SafeAreaProvider>
  );
}
