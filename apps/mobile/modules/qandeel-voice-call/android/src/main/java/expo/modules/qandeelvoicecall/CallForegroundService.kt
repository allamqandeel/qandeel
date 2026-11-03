package expo.modules.qandeelvoicecall

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat

/**
 * S8B-06 CP2 — the live call's foreground service (`phoneCall`, contract v1.0 §9; G1.2 §2.2): it keeps the SAME call
 * running while QANDEEL is in the background or the screen is locked, and carries the ongoing-call notification (CallStyle,
 * with the system's End). It is started only by [LiveCallRegistry] once Telecom made the call active, while the app is
 * visible; it is never restarted from the background (START_NOT_STICKY), and it owns nothing of the call: the End action,
 * the task being removed and the service being destroyed all go to the registry's one end latch.
 *
 * The service types are those the manifest declares for it (the config plugin `with-qandeel-voice-call`), read back here,
 * so the code can never claim a type the build did not declare.
 */
class CallForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val call = LiveCallRegistry.current
        if (call == null || !call.machine.isLive) {
          LiveCallRegistry.serviceStarted("NO_LIVE_CALL")
          stopSelf()
          return START_NOT_STICKY
        }
        try {
          ServiceCompat.startForeground(this, CallNotification.ID, CallNotification.build(this, call), declaredTypes())
          LiveCallRegistry.serviceStarted(null)
        } catch (e: Throwable) {
          // ForegroundServiceStartNotAllowedException (a start from the background) or a SecurityException (a type without
          // its permission): the call cannot honestly continue without its service.
          LiveCallRegistry.serviceStarted(if (e is SecurityException) "SERVICE_TYPE_NOT_PERMITTED" else "SERVICE_START_NOT_ALLOWED")
          stopSelf()
        }
      }
      ACTION_HANGUP -> LiveCallRegistry.hangUpFromNotification()
    }
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    LiveCallRegistry.taskRemoved()
    stopSelf()
  }

  override fun onDestroy() {
    LiveCallRegistry.serviceDestroyed()
    super.onDestroy()
  }

  private fun declaredTypes(): Int {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return 0
    val info = packageManager.getServiceInfo(android.content.ComponentName(this, CallForegroundService::class.java), 0)
    return info.foregroundServiceType and (ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
  }

  companion object {
    const val ACTION_START = "expo.modules.qandeelvoicecall.START"
    const val ACTION_HANGUP = "expo.modules.qandeelvoicecall.HANGUP"
  }
}
