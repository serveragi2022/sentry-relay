export type PermissionStatus = 'authorized' | 'denied' | 'unknown';

export type EventStatus = 'queued' | 'forwarded' | 'failed' | 'discarded';

export type PipelineStage = 'received' | 'monitored' | 'queued' | 'forwarded';

export interface NotificationSource {
  packageName: string;
  label: string;
  enabled: boolean;
}

export interface ForwardedEvent {
  id: string;
  packageName: string;
  appLabel: string;
  title: string;
  text: string;
  /** Unmasked title/text, kept only until the event reaches a terminal
   * delivery state, so a WorkManager-driven retry (which may run after the
   * JS process has been killed and restarted) still has the real content
   * to send — the display fields above may already be phone-number-masked. */
  deliveryTitle?: string;
  deliveryText?: string;
  rawTextLength: number;
  receivedAt: number;
  lastAttemptAt?: number;
  attempts: number;
  maxAttempts: number;
  status: EventStatus;
  lastHttpStatus?: number;
  lastResponseBody?: string;
  lastError?: string;
  sanitized: boolean;
}

export type RetentionDays = 1 | 7 | 30 | 0; // 0 = keep forever

export interface AppSettings {
  forwardingEnabled: boolean;
  webhookUrl: string;
  webhookSecret: string;
  storeHistoryLocally: boolean;
  retentionDays: RetentionDays;
  showContentInHistory: boolean;
}

/**
 * Raw payload shape delivered by react-native-android-notification-listener's
 * headless task, as a JSON string. Most fields are sender-dependent and may
 * be empty.
 */
export interface RawAndroidNotification {
  time: string;
  app: string;
  title?: string;
  titleBig?: string;
  text?: string;
  subText?: string;
  summaryText?: string;
  bigText?: string;
  extraInfoText?: string;
  groupedMessages?: Array<{ title: string; text: string }>;
  /** Android's NotificationListenerService `StatusBarNotification.key` — stable
   * per-notification identity the OS itself uses, when the library surfaces it. */
  key?: string;
}
