import { useAppStore, ensureStoreHydrated } from '@/store/useAppStore';
import { deliverToWebhook } from '@/services/webhookForwarder';
import type { ForwardedEvent, RawAndroidNotification } from '@/types';

const RETRY_DELAYS_MS = [2000, 5000, 10000]; // attempt 1, 2, 3

/** Masks digit runs that look like phone numbers, keeping only the last 2 digits visible. */
function maskPhoneNumbers(input: string): string {
  return input.replace(/(\+?\d[\d\s-]{6,}\d)/g, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    const visible = digitsOnly.slice(-2);
    return `${'X'.repeat(Math.max(digitsOnly.length - 2, 3))} ${visible}`.trim();
  });
}

function buildDisplayText(rawText: string, showContentInHistory: boolean): string {
  if (showContentInHistory) return rawText;
  const masked = maskPhoneNumbers(rawText);
  // If nothing looked like a phone number, still avoid storing raw message
  // bodies in plaintext history when the privacy toggle is off.
  return masked === rawText ? '[Content masked — enable "Show Notification Content" to view]' : masked;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptDelivery(eventId: string, rawText: string, rawTitle: string): Promise<void> {
  for (let attemptIndex = 0; attemptIndex < RETRY_DELAYS_MS.length; attemptIndex++) {
    const { settings, updateEvent, events } = useAppStore.getState();
    const current = events.find((e) => e.id === eventId);
    if (!current || current.status === 'forwarded') return;

    const attemptNumber = attemptIndex + 1;
    updateEvent(eventId, { attempts: attemptNumber, lastAttemptAt: Date.now() });

    const result = await deliverToWebhook(
      { ...current, title: rawTitle, text: rawText },
      settings.webhookUrl,
      settings.webhookSecret
    );

    if (result.success) {
      updateEvent(eventId, {
        status: 'forwarded',
        lastHttpStatus: result.httpStatus,
        lastResponseBody: result.responseBody,
        lastError: undefined,
      });
      return;
    }

    updateEvent(eventId, {
      status: attemptNumber >= RETRY_DELAYS_MS.length ? 'failed' : 'queued',
      lastHttpStatus: result.httpStatus,
      lastResponseBody: result.responseBody,
      lastError: result.error,
    });

    if (attemptNumber < RETRY_DELAYS_MS.length) {
      await delay(RETRY_DELAYS_MS[attemptIndex]);
    }
  }
}

/**
 * Entry point for the headless JS task. Registered in index.js against
 * RNAndroidNotificationListenerHeadlessJsName. Must resolve its promise —
 * Android will kill the task if it hangs.
 */
export async function handleIncomingNotification(payload: { notification?: string }): Promise<void> {
  if (!payload?.notification) return;

  await ensureStoreHydrated();

  let raw: RawAndroidNotification;
  try {
    raw = JSON.parse(payload.notification);
  } catch {
    return; // malformed payload, nothing to do
  }

  const { settings, sources, addEvent } = useAppStore.getState();
  if (!settings.forwardingEnabled) return;

  const source = sources.find((s) => s.packageName === raw.app);
  if (!source || !source.enabled) return; // not an authorized source — discard silently

  const rawText = raw.bigText || raw.text || raw.summaryText || '';
  const rawTitle = raw.titleBig || raw.title || '';
  const showContent = settings.showContentInHistory;

  const event: ForwardedEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    packageName: source.packageName,
    appLabel: source.label,
    title: showContent ? rawTitle : maskPhoneNumbers(rawTitle),
    text: buildDisplayText(rawText, showContent),
    rawTextLength: new TextEncoder().encode(rawText).length,
    receivedAt: Date.now(),
    attempts: 0,
    maxAttempts: RETRY_DELAYS_MS.length,
    status: 'queued',
    sanitized: !showContent,
  };

  addEvent(event);

  // Delivery always uses the raw, unmasked text — the webhook is the user's
  // own configured endpoint, and masking exists for the local history view,
  // not to withhold data from the destination the user explicitly set up.
  await attemptDelivery(event.id, rawText, rawTitle);
}
