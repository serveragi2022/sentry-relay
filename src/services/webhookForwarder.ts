import type { ForwardedEvent } from '@/types';

const REQUEST_TIMEOUT_MS = 8000;

export interface DeliveryResult {
  success: boolean;
  httpStatus?: number;
  responseBody?: string;
  error?: string;
}

/**
 * Sends the sanitized event to the configured webhook. Never sends more than
 * the fields the user can already see in Event Inspection — no raw device
 * identifiers, no unmaseked payload beyond what sanitizeNotification produced.
 */
export async function deliverToWebhook(
  event: ForwardedEvent,
  webhookUrl: string,
  webhookSecret: string
): Promise<DeliveryResult> {
  if (!webhookUrl) {
    return { success: false, error: 'No webhook URL configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookSecret ? { 'X-Sentry-Relay-Secret': webhookSecret } : {}),
      },
      body: JSON.stringify({
        id: event.id,
        app: event.appLabel,
        package: event.packageName,
        title: event.title,
        text: event.text,
        received_at: new Date(event.receivedAt).toISOString(),
        sanitized: event.sanitized,
      }),
      signal: controller.signal,
    });

    const body = await response.text();
    return {
      success: response.ok,
      httpStatus: response.status,
      responseBody: body.slice(0, 500),
    };
  } catch (err: any) {
    const message = err?.name === 'AbortError' ? 'Request timed out' : String(err?.message ?? err);
    return { success: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

/** Simple test ping used by the "Test Webhook" dashboard action. */
export async function testWebhook(webhookUrl: string, webhookSecret: string): Promise<DeliveryResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookSecret ? { 'X-Sentry-Relay-Secret': webhookSecret } : {}),
      },
      body: JSON.stringify({ type: 'test_dispatch', sent_at: new Date().toISOString() }),
      signal: controller.signal,
    });
    const body = await response.text();
    return { success: response.ok, httpStatus: response.status, responseBody: body.slice(0, 500) };
  } catch (err: any) {
    const message = err?.name === 'AbortError' ? 'Request timed out' : String(err?.message ?? err);
    return { success: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
