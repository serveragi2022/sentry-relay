/**
 * Fixed admin credentials gating access to sensitive controls:
 *   - Toggling notification sources on/off
 *   - Test Webhook
 *   - Configure (Settings) / any setting edit
 *   - Deleting stored event data (Clear All Local History)
 *
 * CHANGE THESE before you ship/build the app. These are intentionally
 * simple, hardcoded, in-app constants (not a backend-verified account) —
 * good enough to stop a casual user from touching settings, but NOT a
 * substitute for real auth if that's ever needed.
 */
export const ADMIN_USERNAME = 'admin';
export const ADMIN_PASSWORD = 'sentry@2026';

export function verifyAdminCredentials(username: string, password: string): boolean {
  return username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}
