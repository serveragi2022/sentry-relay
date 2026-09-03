import { useAppStore, ensureStoreHydrated } from "@/store/useAppStore";
import { deliverToWebhook } from "@/services/webhookForwarder";
import { scheduleRetry, cancelRetry } from "@/services/relayNative";
import type { ForwardedEvent, RawAndroidNotification } from "@/types";

// Delay BEFORE attempt 2 and attempt 3 respectively (attempt 1 fires
// immediately on receipt). Kept as a 3-entry array to mirror the original
// fixed backoff documented in the README; only the first two are consumed
// since MAX_ATTEMPTS caps delivery at 3 tries total.
const RETRY_DELAYS_MS = [2000, 5000, 10000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

/** Masks digit runs that look like phone numbers, keeping only the last 2 digits visible. */
function maskPhoneNumbers(input: string): string {
  return input.replace(/(\+?\d[\d\s-]{6,}\d)/g, (match) => {
    const digitsOnly = match.replace(/\D/g, "");
    const visible = digitsOnly.slice(-2);
    return `${"X".repeat(Math.max(digitsOnly.length - 2, 3))} ${visible}`.trim();
  });
}

function buildDisplayText(
  rawText: string,
  showContentInHistory: boolean,
): string {
  if (showContentInHistory) return rawText;
  const masked = maskPhoneNumbers(rawText);
  return masked === rawText
    ? '[Content masked — enable "Show Notification Content" to view]'
    : masked;
}

/**
 * Identity key used for duplicate detection. Prefers the OS-assigned
 * notification key (`StatusBarNotification.key`) when the listener surfaces
 * it — that's the most reliable signal, since Android reuses it for
 * updates to the *same* notification (e.g. marked-seen/edited re-posts).
 * Falls back to a content hash for older payload shapes that don't include
 * `key`, scoped to a short time window (see claimDedupKey) so it only
 * catches near-simultaneous re-posts rather than legitimately repeated
 * messages sent minutes apart.
 */
function buildDedupKey(raw: RawAndroidNotification, rawTitle: string, rawText: string): string {
  if (raw.key) return `k:${raw.key}`;
  return `c:${raw.app}::${rawTitle}::${rawText}`;
}

/**
 * Runs exactly one delivery attempt for an already-queued event, using the
 * unmasked text captured at receipt time (`deliveryTitle`/`deliveryText`).
 * This is the single code path used both for the immediate first attempt
 * (called straight from the headless notification task) and for every
 * subsequent retry (called from the `RetryDeliveryTask` headless task that
 * WorkManager invokes) — so behavior can't drift between the two.
 */
export async function performDeliveryAttempt(eventId: string): Promise<void> {
  const { settings, updateEvent, events } = useAppStore.getState();
  const current = events.find((e) => e.id === eventId);
  if (!current || current.status === "forwarded") return;

  const attemptNumber = current.attempts + 1;
  updateEvent(eventId, { attempts: attemptNumber, lastAttemptAt: Date.now() });

  const result = await deliverToWebhook(
    current,
    settings.webhookUrl,
    settings.webhookSecret,
  );

  if (result.success) {
    updateEvent(eventId, {
      status: "forwarded",
      lastHttpStatus: result.httpStatus,
      lastResponseBody: result.responseBody,
      lastError: undefined,
      // No more attempts needed — drop the unmasked copy we kept around
      // purely for delivery/retry purposes.
      deliveryTitle: undefined,
      deliveryText: undefined,
    });
    cancelRetry(eventId);
    return;
  }

  const exhausted = attemptNumber >= MAX_ATTEMPTS;
  updateEvent(eventId, {
    status: exhausted ? "failed" : "queued",
    lastHttpStatus: result.httpStatus,
    lastResponseBody: result.responseBody,
    lastError: result.error,
    ...(exhausted ? { deliveryTitle: undefined, deliveryText: undefined } : {}),
  });

  if (!exhausted) {
    const nextDelay = RETRY_DELAYS_MS[attemptNumber - 1];
    // WorkManager (native side) owns this timer from here — it will invoke
    // the RetryDeliveryTask headless task even if the JS thread/process is
    // killed in the meantime. The setTimeout passed here is only a
    // best-effort fallback for environments without the native module
    // linked (e.g. Expo Go during development).
    scheduleRetry(eventId, nextDelay, () => {
      performDeliveryAttempt(eventId).catch(() => {});
    });
  }
}

/**
 * Entry point for the `RetryDeliveryTask` headless task, registered in
 * index.js and invoked by `RetryTaskService` when a WorkManager job fires.
 */
export async function retryDeliveryTask(payload: { eventId?: string }): Promise<void> {
  if (!payload?.eventId) return;
  await ensureStoreHydrated();
  await performDeliveryAttempt(payload.eventId);
}

/**
 * Entry point for the notification-listener headless JS task. Registered in
 * index.js against RNAndroidNotificationListenerHeadlessJsName. Must resolve
 * its promise — Android will kill the task if it hangs.
 */
export async function handleIncomingNotification(payload: {
  notification?: string;
}): Promise<void> {
  if (!payload?.notification) return;

  await ensureStoreHydrated();

  let raw: RawAndroidNotification;
  try {
    raw = JSON.parse(payload.notification);
  } catch {
    return; // malformed payload, nothing to do
  }

  const { settings, sources, addEvent, claimDedupKey, claimGroupMessageKey } = useAppStore.getState();
  if (!settings.forwardingEnabled) return;

  const source = sources.find((s) => s.packageName === raw.app);
  if (!source || !source.enabled) return;

  const showContent = settings.showContentInHistory;

  function queueMessage(title: string, text: string): void {
    const event: ForwardedEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      packageName: source!.packageName,
      appLabel: source!.label,
      title: showContent ? title : maskPhoneNumbers(title),
      text: buildDisplayText(text, showContent),
      // Unmasked copies kept only long enough to deliver (and retry) —
      // cleared once the event reaches a terminal state in
      // performDeliveryAttempt. Delivery always sends unmasked content
      // regardless of the local display-masking setting (see README).
      deliveryTitle: title,
      deliveryText: text,
      rawTextLength: new TextEncoder().encode(text).length,
      receivedAt: Date.now(),
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      status: "queued",
      sanitized: !showContent,
    };
    addEvent(event);
    performDeliveryAttempt(event.id).catch(() => {
      // errors are already recorded inside performDeliveryAttempt via updateEvent
    });
  }

  // Messaging apps commonly bundle several rapid-fire messages from the
  // same conversation into ONE notification post (Android's MessagingStyle
  // grouping). When that happens, top-level `text`/`bigText` only reflects
  // the latest line — everything else arrived and vanished invisibly. The
  // listener library surfaces the full set as `groupedMessages`, so when
  // present we walk every message in it instead of just the summary line.
  if (raw.groupedMessages && raw.groupedMessages.length > 0) {
    for (const gm of raw.groupedMessages) {
      const gmTitle = gm.title || raw.titleBig || raw.title || "";
      const gmText = gm.text || "";
      if (!gmText) continue;

      // Permanent (non-expiring) dedup: the OS reposts the SAME cumulative
      // bundle every time a new message arrives in the conversation, so a
      // message seen 5 minutes ago must still be recognized as already
      // forwarded — the short dedup window used below would let it through
      // again as soon as it expired.
      const groupKey = `g:${raw.app}::${raw.key ?? "nokey"}::${gmTitle}::${gmText}`;
      if (!claimGroupMessageKey(groupKey)) continue;

      queueMessage(gmTitle, gmText);
    }
    return;
  }

  // Skip group-summary notifications (no bigText/text of their own)
  if (!raw.bigText && !raw.text) {
    return;
  }

  // Skip Viber's transient progress notifications (media send/receive
  // in progress) — not actual messages, just loading indicators.
  const TRANSIENT_TITLES = [
    "Sending media",
    "Downloading media",
    "Sending...",
    "Uploading...",
  ];
  const titleCandidate = raw.titleBig || raw.title || "";
  if (TRANSIENT_TITLES.includes(titleCandidate.trim())) {
    return;
  }

  const rawText = raw.bigText || raw.text || "";
  const rawTitle = raw.titleBig || raw.title || "";

  // Duplicate detection: NotificationListenerService commonly re-posts the
  // same notification (same OS key) when it's updated in place — marked
  // seen/read, edited, or a group summary refresh. Without this check each
  // re-post would queue and forward again as if it were a new message.
  const dedupKey = buildDedupKey(raw, rawTitle, rawText);
  if (!claimDedupKey(dedupKey)) {
    return;
  }

  queueMessage(rawTitle, rawText);
}
