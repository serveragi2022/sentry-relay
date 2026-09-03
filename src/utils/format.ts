import type { EventStatus } from '@/types';

export function statusToBadgeKind(status: EventStatus): 'connected' | 'queued' | 'error' | 'muted' {
  switch (status) {
    case 'forwarded':
      return 'connected';
    case 'queued':
      return 'queued';
    case 'failed':
      return 'error';
    case 'discarded':
      return 'muted';
  }
}

export function statusLabel(status: EventStatus): string {
  switch (status) {
    case 'forwarded':
      return 'Forwarded';
    case 'queued':
      return 'Queued';
    case 'failed':
      return 'Failed';
    case 'discarded':
      return 'Discarded';
  }
}

/** Formats a timestamp as HH:MM AM/PM, matching the dashboard's tabular time style. */
export function formatTime(ms: number): string {
  const d = new Date(ms);
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

/** Formats a timestamp with millisecond precision, matching the mono diagnostic style. */
export function formatTimePrecise(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  const msPart = d.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${msPart}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function maskWebhookUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 12 ? parsed.pathname.slice(0, 12) + '_***' : parsed.pathname;
    return `${parsed.protocol}//${parsed.host}${path}`;
  } catch {
    return url.length > 28 ? url.slice(0, 28) + '_***' : url;
  }
}
