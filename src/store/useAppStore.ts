import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AppSettings,
  ForwardedEvent,
  NotificationSource,
  PermissionStatus,
} from '@/types';

const DEFAULT_SOURCES: NotificationSource[] = [
  { packageName: 'com.google.android.apps.messaging', label: 'SMS Notifications', enabled: true },
  { packageName: 'com.viber.voip', label: 'Viber Notifications', enabled: true },
];

const DEFAULT_SETTINGS: AppSettings = {
  forwardingEnabled: true,
  webhookUrl: '',
  webhookSecret: '',
  storeHistoryLocally: true,
  retentionDays: 7,
  showContentInHistory: false,
};

const MAX_STORED_EVENTS = 500;

interface AppState {
  hasHydrated: boolean;
  permissionStatus: PermissionStatus;
  settings: AppSettings;
  sources: NotificationSource[];
  events: ForwardedEvent[];

  setHasHydrated: (value: boolean) => void;
  setPermissionStatus: (status: PermissionStatus) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  toggleSource: (packageName: string) => void;
  addSource: (packageName: string, label: string) => void;

  addEvent: (event: ForwardedEvent) => void;
  updateEvent: (id: string, patch: Partial<ForwardedEvent>) => void;
  clearHistory: () => void;
  purgeExpired: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      permissionStatus: 'unknown',
      settings: DEFAULT_SETTINGS,
      sources: DEFAULT_SOURCES,
      events: [],

      setHasHydrated: (value) => set({ hasHydrated: value }),

      setPermissionStatus: (status) => set({ permissionStatus: status }),

      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      toggleSource: (packageName) =>
        set((state) => ({
          sources: state.sources.map((s) =>
            s.packageName === packageName ? { ...s, enabled: !s.enabled } : s
          ),
        })),

      addSource: (packageName, label) =>
        set((state) => {
          if (state.sources.some((s) => s.packageName === packageName)) return state;
          return { sources: [...state.sources, { packageName, label, enabled: true }] };
        }),

      addEvent: (event) =>
        set((state) => {
          if (!state.settings.storeHistoryLocally) return state;
          const events = [event, ...state.events].slice(0, MAX_STORED_EVENTS);
          return { events };
        }),

      updateEvent: (id, patch) =>
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      clearHistory: () => set({ events: [] }),

      purgeExpired: () => {
        const { settings, events } = get();
        if (!settings.retentionDays) return; // 0 = keep forever
        const cutoff = Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000;
        const kept = events.filter((e) => e.receivedAt >= cutoff);
        if (kept.length !== events.length) set({ events: kept });
      },
    }),
    {
      name: 'sentry-relay-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
        sources: state.sources,
        events: state.events,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/**
 * The headless notification task runs outside the React tree and may fire
 * before AsyncStorage has finished rehydrating the store. Call this first
 * inside the headless task to make sure `useAppStore.getState()` reflects
 * persisted settings/sources rather than in-memory defaults.
 */
export async function ensureStoreHydrated(): Promise<void> {
  if (useAppStore.getState().hasHydrated) return;
  await new Promise<void>((resolve) => {
    const unsub = useAppStore.subscribe((state) => {
      if (state.hasHydrated) {
        unsub();
        resolve();
      }
    });
    // In case rehydration already completed between the check above and
    // subscribing, kick it and let onRehydrateStorage resolve the promise.
    useAppStore.persist.rehydrate();
  });
}
