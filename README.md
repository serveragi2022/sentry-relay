# Sentry Relay

A React Native (Expo) implementation of the "Notification Forwarder" Stitch
design — an Android app that watches specific apps' notifications and
forwards them to a webhook you configure, with a local event log and
privacy controls.

## What's implemented

- **Dashboard** — monitoring status, notification-access + webhook status,
  pending queue / forwarded-today stats, live pipeline tracker, source
  toggles, test-webhook action.
- **Events** — filterable log (All / Queued / Forwarded / Failed) backed by
  real app state, tapping a row opens...
- **Event Detail** — full inspection view: source, timestamps, delivery
  attempts, sanitized payload preview, webhook response, delete-this-event.
- **Settings (Permissions & Privacy)** — notification access status +
  deep link into Android settings, master forwarding kill switch, per-source
  authorization, local history retention (1/7/30 days/forever), a
  show/mask-content toggle, webhook URL + optional shared-secret header,
  clear-all-history.
- **Real delivery pipeline** — `src/services/notificationProcessor.ts`
  parses the native payload, checks it against your authorized source list,
  masks phone-number-shaped strings for local display when content masking
  is on, queues the event, and calls `src/services/webhookForwarder.ts`
  (fetch + timeout) with 3 retry attempts and backoff. All of this runs from
  a **headless JS task** (`index.js`) so it fires even when the app is
  closed.
- **Persistence** — Zustand store (`src/store/useAppStore.ts`) persisted to
  AsyncStorage, readable from both the UI and the headless task.
- **Theme** — colors/typography/spacing transcribed directly from the
  Stitch `DESIGN.md` (Deep Privacy Slate / Active Emerald / Amber / Rose,
  Inter + JetBrains Mono).

## Important: this cannot run in Expo Go

`NotificationListenerService` requires native Android code that isn't part
of the Expo Go sandbox. This project uses `expo-dev-client` and a config
plugin, which means you need a **custom dev build**:

```bash
npm install
npx expo prebuild -p android
npx expo run:android
```

(or build with EAS: `eas build --profile development --platform android`)

## One thing to verify after `expo prebuild`

`react-native-android-notification-listener` autolinks its native module,
but Android's `NotificationListenerService` also needs an explicit
`<service>` declaration with `BIND_NOTIFICATION_LISTENER_SERVICE` in
`AndroidManifest.xml`. `plugins/withNotificationListener.js` injects this
automatically — **but the service's fully-qualified class name
(`com.reactlibrary.RNAndroidNotificationListener`) is my best inference
from the library's public source, not something I could execute and
confirm.** After your first prebuild, check
`android/app/src/main/AndroidManifest.xml`:

- If the library's own `android` module already ships this `<service>`
  entry (many RN native modules bundle their own manifest fragment that
  merges in automatically), the plugin's entry will just be a harmless
  duplicate — remove one.
- If it's missing entirely, confirm the real service class name from the
  installed package at
  `node_modules/react-native-android-notification-listener/android/src/main/...`
  and update `SERVICE_NAME` in the plugin to match exactly.

Get this wrong and Android simply won't offer your app in the
notification-access settings list — nothing will crash, so it's easy to
miss.

## Where the design intentionally differs

- The mockups show SMS and Viber as example sources — nothing in the code
  hardcodes them. `src/store/useAppStore.ts` seeds those two as defaults;
  add/remove authorized packages from Settings the same way the mockup's
  "+ Authorize Additional Package" implies (the add-flow itself needs a
  package picker if you want that button live — the store method
  `addSource(packageName, label)` is ready for it).
- Delivery always sends the **unmasked** text to your webhook — masking is
  a local-history display choice, not something applied to your own
  configured endpoint. Worth double-checking that matches your intent
  before you point this at anything other than infrastructure you control.
- Retry backoff is fixed at 2s / 5s / 10s (`RETRY_DELAYS_MS` in
  `notificationProcessor.ts`) rather than fully exponential — Android
  headless tasks have a limited execution window, so this stays
  conservative. If you extend the task timeout natively, you can lengthen
  these.

## Project structure

```
App.tsx                        entry component: font loading, permission polling
index.js                       registers root component + headless task
app.json                       Expo config, Android permissions, plugin
plugins/withNotificationListener.js   manifest injection (see caveat above)
src/
  theme/           design tokens from DESIGN.md
  types/           shared TS types
  store/           zustand store + AsyncStorage persistence
  services/
    permissions.ts         native permission check/request wrapper
    notificationProcessor.ts   parse -> filter -> mask -> queue -> deliver
    webhookForwarder.ts        fetch-based delivery + test-ping
  components/      Card, StatusBadge, PipelineTracker, EventLogRow, etc.
  screens/         DashboardScreen, EventsScreen, EventDetailScreen, SettingsScreen
  navigation/      bottom tabs + Events stack
  utils/format.ts  time/byte/status formatting helpers
```

## Suggested next steps

- Wire up the "+ Authorize Additional Package" flow (needs a native
  installed-app picker — `react-native-launcher-kit` or similar can list
  installed packages for the user to pick from).
- Add a foreground service notification so Android is less likely to kill
  the listener under battery optimization (the Settings screen already has
  a "Background Monitoring" affordance from the design to hang this off).
- If you want delivery confirmed even if the JS thread gets killed
  mid-retry, move the retry loop into `react-native-headless-task-worker`
  (WorkManager-backed) instead of a plain `setTimeout` loop.
