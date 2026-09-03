const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withMainApplication,
  withAppBuildGradle,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');

const PACKAGE_CLASS = 'RelayNativePackage';
const PACKAGE_IMPORT = 'io.sentryrelay.app.RelayNativePackage';

/**
 * Adds the manifest bits, native Kotlin sources, Gradle dependency, and
 * MainApplication registration needed for:
 *  - RelayForegroundService: a persistent foreground-service notification
 *    that keeps the process (and the notification listener) alive under
 *    aggressive OEM battery managers.
 *  - RetryWorker / RetryTaskService: a WorkManager-backed retry path that
 *    survives process death, replacing the plain setTimeout retry loop.
 *  - RelayNativeModule: the JS-facing bridge for both of the above, plus
 *    the battery-optimization-exemption prompt.
 */
function withForegroundService(config) {
  config = withManifestAdditions(config);
  config = withGradleDependency(config);
  config = withNativeSources(config);
  config = withMainApplicationRegistration(config);
  return config;
}

function withManifestAdditions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const pkg = config.android?.package;

    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      'android.permission.WAKE_LOCK',
      'android.permission.POST_NOTIFICATIONS',
    ];
    manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];
    for (const perm of permissions) {
      const exists = manifest.manifest['uses-permission'].some(
        (p) => p['$']['android:name'] === perm
      );
      if (!exists) {
        manifest.manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    const application = manifest.manifest.application[0];
    application.service = application.service || [];

    const ensureService = (name, extraAttrs) => {
      const fqcn = `${pkg}.${name}`;
      const exists = application.service.some((s) => s['$']['android:name'] === fqcn);
      if (!exists) {
        application.service.push({
          $: {
            'android:name': fqcn,
            'android:exported': 'false',
            ...extraAttrs,
          },
        });
      }
    };

    ensureService('RelayForegroundService', { 'android:foregroundServiceType': 'dataSync' });
    ensureService('RetryTaskService', {});

    return config;
  });
}

function withGradleDependency(config) {
  return withAppBuildGradle(config, (config) => {
    const marker = 'androidx.work:work-runtime-ktx';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*{/,
        `dependencies {\n    implementation("androidx.work:work-runtime-ktx:2.9.0")`
      );
    }
    return config;
  });
}

function withMainApplicationRegistration(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes(PACKAGE_IMPORT)) {
      // Insert the import after the last existing import line.
      const lastImportMatch = [...contents.matchAll(/^import .+$/gm)].pop();
      if (lastImportMatch) {
        const insertAt = lastImportMatch.index + lastImportMatch[0].length;
        contents =
          contents.slice(0, insertAt) +
          `\nimport ${PACKAGE_IMPORT}` +
          contents.slice(insertAt);
      }
    }

    if (!contents.includes(`${PACKAGE_CLASS}()`)) {
      if (config.modResults.language === 'kt') {
        if (/val packages = PackageList\(this\)\.packages/.test(contents)) {
          // Older template: packages is a local val before being returned.
          contents = contents.replace(
            /(val packages = PackageList\(this\)\.packages\s*)/,
            `$1            packages.add(${PACKAGE_CLASS}())\n`
          );
        } else {
          // Current SDK 51 template: PackageList(this).packages is returned
          // directly with no intermediate variable — introduce one.
          contents = contents.replace(
            /return PackageList\(this\)\.packages/,
            `val packages = PackageList(this).packages\n            packages.add(${PACKAGE_CLASS}())\n            return packages`
          );
        }
      } else {
        if (/List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);/.test(contents)) {
          contents = contents.replace(
            /(List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);\s*)/,
            `$1      packages.add(new ${PACKAGE_CLASS}());\n`
          );
        } else {
          contents = contents.replace(
            /return new PackageList\(this\)\.getPackages\(\);/,
            `List<ReactPackage> packages = new PackageList(this).getPackages();\n      packages.add(new ${PACKAGE_CLASS}());\n      return packages;`
          );
        }
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

function withNativeSources(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const pkg = config.android?.package;
      if (!pkg) return config;

      const projectRoot = config.modRequest.projectRoot;
      const pkgPath = pkg.replace(/\./g, path.sep);
      const dir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        pkgPath
      );
      fs.mkdirSync(dir, { recursive: true });

      const appName = config.name || 'Sentry Relay';

      writeFile(dir, 'RelayForegroundService.kt', relayForegroundServiceSrc(pkg, appName));
      writeFile(dir, 'RetryWorker.kt', retryWorkerSrc(pkg));
      writeFile(dir, 'RetryTaskService.kt', retryTaskServiceSrc(pkg));
      writeFile(dir, 'RelayNativeModule.kt', relayNativeModuleSrc(pkg));
      writeFile(dir, 'RelayNativePackage.kt', relayNativePackageSrc(pkg));

      return config;
    },
  ]);
}

function writeFile(dir, name, contents) {
  fs.writeFileSync(path.join(dir, name), contents, 'utf8');
}

function relayForegroundServiceSrc(pkg, appName) {
  return `package ${pkg}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Persistent foreground service whose entire job is to hold a foreground
 * presence so Android is much less likely to kill this process (and with
 * it, the NotificationListenerService binding) while the app sits idle in
 * the background — especially under Xiaomi/Oppo/Vivo-style aggressive
 * battery managers. It does no work of its own; the actual notification
 * capture and delivery pipeline runs in JS as before.
 */
class RelayForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "relay_monitoring_v2"
        const val LEGACY_CHANNEL_ID = "relay_monitoring"
        const val NOTIFICATION_ID = 4201

        fun start(context: Context) {
            val intent = Intent(context, RelayForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, RelayForegroundService::class.java))
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannelIfNeeded()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        // START_STICKY: if the OS still kills the process under memory
        // pressure, ask it to recreate the service (without redelivering
        // the last intent) as soon as resources allow.
        return START_STICKY
    }

    private fun createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        // Importance is locked once a channel exists, so an older install
        // that created the low-visibility MIN-importance channel needs it
        // removed before the new, more visible LOW channel takes over.
        manager.deleteNotificationChannel(LEGACY_CHANNEL_ID)
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Background Monitoring",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Keeps notification forwarding active in the background."
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val pm = packageManager
        val launchIntent = pm.getLaunchIntentForPackage(packageName)
        val contentIntent = launchIntent?.let {
            PendingIntent.getActivity(
                this, 0, it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("${appName} is monitoring")
            .setContentText("Watching authorized notification sources.")
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(contentIntent)
            .build()
    }
}
`;
}

function retryWorkerSrc(pkg) {
  return `package ${pkg}

import android.content.Context
import android.content.Intent
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * WorkManager Worker that fires a single retry attempt. Unlike a JS
 * \`setTimeout\`, this survives process death, Doze, and app-standby —
 * WorkManager persists the job (backed by JobScheduler/AlarmManager) and
 * Android will wake the process to run it even if it was killed in the
 * meantime.
 *
 * The worker's only responsibility is reliably starting the headless JS
 * task that performs the actual network delivery; the JS side (see
 * notificationProcessor.ts) decides whether another retry is needed and,
 * if so, schedules the next WorkManager job itself.
 */
class RetryWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val eventId = inputData.getString(RelayNativeModule.KEY_EVENT_ID) ?: return Result.failure()
        val serviceIntent = Intent(applicationContext, RetryTaskService::class.java)
            .putExtra(RelayNativeModule.KEY_EVENT_ID, eventId)
        RetryTaskService.startTask(applicationContext, serviceIntent)
        return Result.success()
    }
}
`;
}

function retryTaskServiceSrc(pkg) {
  return `package ${pkg}

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Bridges a WorkManager-triggered retry into the JS world by starting the
 * \`RetryDeliveryTask\` headless task registered in index.js.
 */
class RetryTaskService : HeadlessJsTaskService() {
    companion object {
        fun startTask(context: android.content.Context, intent: Intent) {
            val componentIntent = Intent(context, RetryTaskService::class.java)
            componentIntent.putExtras(intent)
            context.startService(componentIntent)
        }
    }

    override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig? {
        val eventId = intent.getStringExtra(RelayNativeModule.KEY_EVENT_ID) ?: return null
        val data = Arguments.createMap()
        data.putString("eventId", eventId)
        return HeadlessJsTaskConfig(
            "RetryDeliveryTask",
            data,
            30000, // timeout ms — one HTTP attempt with its own internal timeout
            true // allow running while app is in the background
        )
    }
}
`;
}

function relayNativeModuleSrc(pkg) {
  return `package ${pkg}

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.work.BackoffPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.TimeUnit

class RelayNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val KEY_EVENT_ID = "eventId"
    }

    override fun getName(): String = "RelayNative"

    @ReactMethod
    fun startForegroundService() {
        RelayForegroundService.start(reactApplicationContext)
    }

    @ReactMethod
    fun stopForegroundService() {
        RelayForegroundService.stop(reactApplicationContext)
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            promise.resolve(true)
            return
        }
        val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        promise.resolve(pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName))
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:" + reactApplicationContext.packageName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try {
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            // Some OEM ROMs strip this action from the system settings app;
            // nothing more we can do from here besides fail silently — the
            // Settings screen still shows the "not exempted" status either way.
        }
    }

    @ReactMethod
    fun scheduleRetry(eventId: String, delayMillis: Double) {
        val data = androidx.work.Data.Builder()
            .putString(KEY_EVENT_ID, eventId)
            .build()

        val request = OneTimeWorkRequest.Builder(RetryWorker::class.java)
            .setInitialDelay(delayMillis.toLong(), TimeUnit.MILLISECONDS)
            .setInputData(data)
            .setBackoffCriteria(BackoffPolicy.LINEAR, 10, TimeUnit.SECONDS)
            .addTag("relay_retry")
            .build()

        WorkManager.getInstance(reactApplicationContext)
            .enqueueUniqueWork("retry_$eventId", ExistingWorkPolicy.REPLACE, request)
    }

    @ReactMethod
    fun cancelRetry(eventId: String) {
        WorkManager.getInstance(reactApplicationContext).cancelUniqueWork("retry_$eventId")
    }
}
`;
}

function relayNativePackageSrc(pkg) {
  return `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class RelayNativePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(RelayNativeModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;
}

module.exports = withForegroundService;
