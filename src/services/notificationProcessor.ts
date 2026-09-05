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

/**
 * Android's grouped/MessagingStyle notifications for group chats (Viber
 * "External Audit Viber Group", "Kaizen Department", etc.) surface a
 * synthetic conversation-subtitle line alongside the real messages —
 * literally "from <sender>, <group name>". It's UI metadata describing
 * *where* the message came from, not a message itself, and it always
 * repeats the exact same sender name that's already the display title.
 * Detect that specific shape and drop it so it never gets logged or
 * forwarded as if it were real chat content.
 */
function isConversationSubtitleArtifact(title: string, text: string): boolean {
  const match = /^from\s+([^,]+),\s*.+$/i.exec(text.trim());
  if (!match) return false;
  const fromName = match[1].trim().toLowerCase();
  return fromName === title.trim().toLowerCase();
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
 * Known non-message "system"/status notifications posted by messaging apps'
 * own background services — sync progress, connection status, backup, etc.
 * These are never something a real contact sent, but there's no reliable
 * "this is a system notification" flag exposed by the listener library, so
 * this is a maintained list: add more exact phrases here as you spot them
 * slipping through for Viber, SMS, or any other source.
 */
const SYSTEM_NOTICE_PATTERNS: RegExp[] = [
  /retrieving (recent )?messages/i,
  /backing up messages?/i,
  /restoring (from )?backup/i,
  /syncing messages?/i,
  /connecting\.{0,3}$/i,
  /waiting for network/i,
  /verifying (your )?number/i,
  /setting up (your )?account/i,
  /downloading messages?/i,
  /sending\.{0,3}$/i,
  /message queued/i,
  /no sim card/i,
];

function isSystemNotice(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return SYSTEM_NOTICE_PATTERNS.some((pattern) => pattern.test(trimmed));
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

  const { settings, sources, addEvent, claimDedupKey, claimGroupMessageKey, claimNotificationKey } =
    useAppStore.getState();
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
      if (isConversationSubtitleArtifact(gmTitle, gmText)) continue;
      if (isSystemNotice(gmText)) continue;

      // Permanent (non-expiring) dedup: the OS reposts the SAME cumulative
      // bundle every time a new message arrives in the conversation, so a
      // message seen 5 minutes ago must still be recognized as already
      // forwarded — the short dedup window used below would let it through
      // again as soon as it expired.
      //
      // Deliberately does NOT include raw.key: when a new message lands in
      // ANY conversation, Android also (re)posts a group-summary
      // notification bundling recent messages across ALL open
      // conversations for this app — same content, but a different
      // notification key than the original per-conversation post. Keying
      // off raw.key made that summary repost look "new" and re-forwarded
      // every earlier message every time a different person sent one. The
      // message's own content (app + sender + text) is the real identity
      // here, regardless of which notification object delivered it.
      const groupKey = `g:${raw.app}::${gmTitle}::${gmText}`;
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

  // Same conversation-subtitle artifact as above, for the non-grouped path.
  if (isConversationSubtitleArtifact(rawTitle, rawText)) {
    return;
  }

  // System/status notices (Viber sync messages, SMS delivery status, etc.)
  // are not real chat content — drop them before they're ever queued.
  if (isSystemNotice(rawText)) {
    return;
  }

  // Duplicate detection: NotificationListenerService commonly re-posts the
  // same notification (same OS key) when it's updated in place — marked
  // seen/read, edited, or a group summary refresh — and can keep doing so
  // for as long as the notification stays unread, sometimes minutes apart.
  // When we have a real OS key, dedup on it permanently (see
  // claimNotificationKey); only fall back to the short time-windowed check
  // for older payload shapes that don't include `key`.
  const dedupKey = buildDedupKey(raw, rawTitle, rawText);
  const isDuplicate = raw.key ? !claimNotificationKey(dedupKey) : !claimDedupKey(dedupKey);
  if (isDuplicate) {
    return;
  }

  queueMessage(rawTitle, rawText);
}
