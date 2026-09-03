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

/** How long a given dedup key is remembered before the same key is treated
 * as a genuinely new notification rather than a re-post of the same one
 * (e.g. Android re-delivering a notification when it's marked "seen" or
 * edited in place). */
const DEDUP_WINDOW_MS = 4000;
const MAX_DEDUP_KEYS = 200;

/** Grouped-conversation notifications (see groupMessageKeys below) repost the
 * SAME cumulative bundle every time a new message arrives — e.g. message A
 * alone, then [A, B], then [A, B, C]. A's key must stay "seen" across that
 * whole span, which can be minutes long, so this list has no time window —
 * only a size cap with FIFO eviction. */
const MAX_GROUP_MESSAGE_KEYS = 400;

/** Same permanent-dedup idea, but for the OS-assigned notification key
 * (`StatusBarNotification.key`) on non-grouped notifications. Android can
 * repost the exact same notification instance many times while it stays
 * unread — sometimes minutes apart — and every repost carries the same
 * key. A time-windowed check would let a late repost through as if it were
 * a new message, so once a given key has been claimed it stays claimed for
 * the life of this capped list. */
const MAX_NOTIFICATION_KEYS = 500;

interface DedupEntry {
  key: string;
  ts: number;
}

interface AppState {
  hasHydrated: boolean;
  permissionStatus: PermissionStatus;
  settings: AppSettings;
  sources: NotificationSource[];
  events: ForwardedEvent[];
  dedupKeys: DedupEntry[];
  groupMessageKeys: string[];
  notificationKeys: string[];

  setHasHydrated: (value: boolean) => void;
  setPermissionStatus: (status: PermissionStatus) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  toggleSource: (packageName: string) => void;
  addSource: (packageName: string, label: string) => void;

  addEvent: (event: ForwardedEvent) => void;
  updateEvent: (id: string, patch: Partial<ForwardedEvent>) => void;
  clearHistory: () => void;
  purgeExpired: () => void;

  /** Returns true if `key` has NOT been seen within the dedup window (i.e.
   * this notification should be processed), and records it either way.
   * Used only as a fallback for payloads without an OS notification key —
   * see claimNotificationKey for the normal, permanent case. */
  claimDedupKey: (key: string) => boolean;

  /** Same idea as claimDedupKey but for individual messages inside a grouped
   * conversation notification — permanent (capped, not time-windowed), since
   * the same bundle is re-posted for as long as the conversation stays
   * active. Returns true the first time a given message key is seen. */
  claimGroupMessageKey: (key: string) => boolean;

  /** Permanent (capped, not time-windowed) dedup for a single notification's
   * OS-assigned key. Returns true the first time a given key is seen —
   * every repost of that same notification (e.g. while it's still unread)
   * returns false from then on. */
  claimNotificationKey: (key: string) => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      permissionStatus: 'unknown',
      settings: DEFAULT_SETTINGS,
      sources: DEFAULT_SOURCES,
      events: [],
      dedupKeys: [],
      groupMessageKeys: [],
      notificationKeys: [],

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

      claimDedupKey: (key) => {
        const now = Date.now();
        const { dedupKeys } = get();
        const pruned = dedupKeys.filter((e) => now - e.ts < DEDUP_WINDOW_MS);
        const isDuplicate = pruned.some((e) => e.key === key);
        const next = [...pruned, { key, ts: now }].slice(-MAX_DEDUP_KEYS);
        set({ dedupKeys: next });
        return !isDuplicate;
      },

      claimGroupMessageKey: (key) => {
        const { groupMessageKeys } = get();
        if (groupMessageKeys.includes(key)) return false;
        const next = [...groupMessageKeys, key].slice(-MAX_GROUP_MESSAGE_KEYS);
        set({ groupMessageKeys: next });
        return true;
      },

      claimNotificationKey: (key) => {
        const { notificationKeys } = get();
        if (notificationKeys.includes(key)) return false;
        const next = [...notificationKeys, key].slice(-MAX_NOTIFICATION_KEYS);
        set({ notificationKeys: next });
        return true;
      },
    }),
    {
      name: 'sentry-relay-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
        sources: state.sources,
        events: state.events,
        dedupKeys: state.dedupKeys,
        groupMessageKeys: state.groupMessageKeys,
        notificationKeys: state.notificationKeys,
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