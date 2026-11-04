package expo.modules.qandeelvoicecall

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person

/**
 * S8B-06 CP2 — the ongoing-call notification (Android CallStyle, contract v1.0 §9 and A1 §5): the call's name, its running
 * time, one line of state the JS controller chooses (the call, reconnecting, held, the 60-minute warnings) and the
 * system's own End button, which goes to the registry's one end latch. It carries no transcript, no content and no
 * personal data; its words come from the controller's copy rows, never from here. Built inside the module (notifee is
 * barred by contract, `a3-02`).
 */
object CallNotification {
  const val ID = 8_406
  const val CHANNEL = "qandeel_live_call"

  fun build(context: Context, call: LiveCallRegistry.Call): Notification {
    ensureChannel(context, call.options.channelName)
    val hangUp = PendingIntent.getService(
      context, 1,
      Intent(context, CallForegroundService::class.java).setAction(CallForegroundService.ACTION_HANGUP),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, 2, it.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val person = Person.Builder().setName(call.options.displayName).setImportant(true).build()
    return NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(call.options.notificationTitle)
      .setContentText(call.notificationText)
      .setStyle(NotificationCompat.CallStyle.forOngoingCall(person, hangUp))
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setUsesChronometer(true)
      .setWhen(call.startedAtMs)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .apply { if (open != null) setContentIntent(open) }
      .build()
  }

  /** Re-posts the same notification with its new line (the service stays the same). */
  fun post(context: Context, call: LiveCallRegistry.Call) {
    try {
      NotificationManagerCompat.from(context).notify(ID, build(context, call))
    } catch (_: SecurityException) {
      // POST_NOTIFICATIONS refused: the service's notification stays as the system shows it; the call is unaffected.
    }
  }

  fun cancel(context: Context) {
    try { NotificationManagerCompat.from(context).cancel(ID) } catch (_: Throwable) {}
  }

  private fun ensureChannel(context: Context, name: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL) != null) return
    val channel = NotificationChannel(CHANNEL, name, NotificationManager.IMPORTANCE_DEFAULT).apply {
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }
}
