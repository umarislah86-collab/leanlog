package expo.modules.bluecoinsdrivereader

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import org.json.JSONArray
import org.json.JSONObject

object RedCoinsAlarmScheduler {
  const val CHANNEL = "redcoins-reminders"
  private const val STORE = "redcoins_alarms_v1"
  fun exactAllowed(context: Context) = Build.VERSION.SDK_INT < 31 ||
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
  fun saved(context: Context) = JSONArray(context.getSharedPreferences(STORE, 0).getString("alarms", "[]"))
  private fun pending(context: Context, row: JSONObject) = PendingIntent.getBroadcast(context, 0,
    Intent(context, RedCoinsAlarmReceiver::class.java).setData(Uri.parse("leanlog-alarm://occurrence/${Uri.encode(row.getString("key"))}"))
      .putExtra("alarm", row.toString()), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  @Synchronized fun replace(context: Context, json: String) {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val old = saved(context)
    for (i in 0 until old.length()) manager.cancel(pending(context, old.getJSONObject(i)))
    val rows = JSONArray(json)
    context.getSharedPreferences(STORE, 0).edit().putString("alarms", rows.toString()).commit()
    for (i in 0 until rows.length()) {
      val row = rows.getJSONObject(i)
      val due = maxOf(System.currentTimeMillis() + 100, row.getLong("due"))
      if (exactAllowed(context)) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, due, pending(context, row))
      else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, due, pending(context, row))
    }
  }

  @Synchronized fun consume(context: Context, key: String): Boolean {
    val old = saved(context)
    val remaining = JSONArray()
    var found = false
    for (i in 0 until old.length()) {
      val row = old.getJSONObject(i)
      if (row.getString("key") == key) found = true else remaining.put(row)
    }
    if (found) context.getSharedPreferences(STORE, 0).edit().putString("alarms", remaining.toString()).commit()
    return found
  }

  fun notification(context: Context, row: JSONObject): android.app.Notification {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "RedCoins reminders", NotificationManager.IMPORTANCE_HIGH))
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)!!
      .setAction(Intent.ACTION_VIEW).setData(Uri.parse("leanlog://redcoins?section=plan"))
    val contentIntent = PendingIntent.getActivity(context, row.getString("key").hashCode(), launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return NotificationCompat.Builder(context, CHANNEL).setSmallIcon(android.R.drawable.ic_popup_reminder)
      .setContentTitle(if (row.getBoolean("automaticLog")) "RedCoins auto-log due" else "RedCoins transaction reminder")
      .setContentText(row.getString("body")).setStyle(NotificationCompat.BigTextStyle().bigText(row.getString("body")))
      .setContentIntent(contentIntent).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).build()
  }
}

class RedCoinsAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.getStringExtra("alarm") == null) {
      RedCoinsAlarmScheduler.replace(context, RedCoinsAlarmScheduler.saved(context).toString())
      return
    }
    val json = intent.getStringExtra("alarm") ?: return
    val row = JSONObject(json)
    if (!RedCoinsAlarmScheduler.consume(context, row.getString("key"))) return
    val notification = RedCoinsAlarmScheduler.notification(context, row)
    try {
      (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(row.getString("key").hashCode(), notification)
    } catch (error: SecurityException) { android.util.Log.w("RedCoinsAlarm", "Notification permission is disabled", error) }
    // Exact user-requested alarms are exempt from background FGS restrictions.
    // Inexact alarms notify only; the app reconciles when resumed.
    if (RedCoinsAlarmScheduler.exactAllowed(context)) {
      try {
        context.startForegroundService(Intent(context, RedCoinsAutoLogService::class.java).putExtra("alarm", json))
        HeadlessJsTaskService.acquireWakeLockNow(context)
      } catch (error: Exception) { android.util.Log.e("RedCoinsAlarm", "Due task failed to start", error) }
    }
  }
}

class RedCoinsAutoLogService : HeadlessJsTaskService() {
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val row = JSONObject(intent?.getStringExtra("alarm") ?: return START_NOT_STICKY)
    val notification = RedCoinsAlarmScheduler.notification(this, row)
    if (Build.VERSION.SDK_INT >= 34) startForeground(row.getString("key").hashCode(), notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE)
    else startForeground(row.getString("key").hashCode(), notification)
    return super.onStartCommand(intent, flags, startId)
  }
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? =
    if (intent?.getStringExtra("alarm") == null) null
    else HeadlessJsTaskConfig("LeanLogRedCoinsDue", Arguments.createMap(), 60000, true)
  override fun onDestroy() {
    stopForeground(STOP_FOREGROUND_DETACH)
    super.onDestroy()
  }
}
