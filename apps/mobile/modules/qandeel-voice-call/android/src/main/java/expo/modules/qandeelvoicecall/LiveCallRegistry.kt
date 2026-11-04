package expo.modules.qandeelvoicecall

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.telecom.DisconnectCause
import androidx.core.content.ContextCompat
import androidx.core.telecom.CallAttributesCompat
import androidx.core.telecom.CallControlResult
import androidx.core.telecom.CallControlScope
import androidx.core.telecom.CallEndpointCompat
import androidx.core.telecom.CallsManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * S8B-06 CP2 — the phone's ONE live call on Android: Core-Telecom, the `phoneCall` foreground service with its CallStyle
 * notification, and the audio engine, joined under one [CallLifecycleMachine] (contract v1.0 §9, the CP2 order §2).
 *
 *   start     only from the app in the foreground (the person's act): the device must support self-managed Telecom calls
 *             (API 26+, and `FEATURE_TELECOM` where the platform names it) and hold RECORD_AUDIO, or the call is refused
 *             with an explicit code BEFORE anything opens. One call at a time: a second start is refused ALREADY_IN_CALL
 *             and opens nothing. The outgoing call is added to Telecom (`CallsManager.addCall`, audio, hold supported, not
 *             logged in the system's call history — self-managed calls are not logged unless asked), made active, then the
 *             foreground service starts while the app is still visible.
 *   audio     the engine runs as [CallAudioEngine.AudioOwner.TELECOM]: Telecom owns the mode, the focus and the route;
 *             routes change ONLY through `requestEndpointChange`. The engine may start only while the call is ACTIVE.
 *   hold      Telecom's `onSetInactive` (another call took the audio) releases the microphone and the speaker; the call
 *             resumes when Telecom asks (`onSetActive`) or when the other call is over (the audio mode leaves IN_CALL), by
 *             `setActive`.
 *   end       every source — the app, the notification's End, Telecom's disconnect (Bluetooth, car, system), the engine's
 *             failure, the service stopped, the task removed, the JS runtime destroyed — ends through the machine's one
 *             latch; resources are released once and never restarted.
 *
 * It logs nothing and stores nothing. Events go to the JS controller, which joins them to the server's authority.
 */
object LiveCallRegistry {
  interface Listener {
    fun onLifecycle(event: Map<String, Any?>)
  }

  class StartException(val code: String) : Exception(code)

  data class StartOptions(
    val callId: String,
    val displayName: String,
    val notificationTitle: String,
    val notificationText: String,
    val channelName: String,
    val speaker: Boolean,
  )

  class Call(val options: StartOptions) {
    val machine = CallLifecycleMachine()
    @Volatile var scope: CallControlScope? = null
    @Volatile var job: Job? = null
    @Volatile var engine: CallAudioEngine? = null
    @Volatile var endpoints: List<CallEndpointCompat> = emptyList()
    @Volatile var endpoint: CallEndpointCompat? = null
    @Volatile var notificationText: String = options.notificationText
    @Volatile var startedAtMs: Long = System.currentTimeMillis()
    @Volatile var serviceUp: CompletableDeferred<String?>? = null
    @Volatile var watch: Job? = null
  }

  @Volatile var listener: Listener? = null
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private val lock = Object()
  private var call: Call? = null
  private lateinit var appContext: Context

  private const val START_TIMEOUT_MS = 8000L
  private const val SERVICE_TIMEOUT_MS = 4000L

  /**
   * A start step's outcome: null is success, a code is the failure. `withTimeoutOrNull` alone would also return null on a
   * timeout, which would read as success; the wrapper keeps the two apart.
   */
  private class Outcome(val failure: String?)

  private suspend fun awaitOutcome(step: CompletableDeferred<String?>, timeoutMs: Long, timeoutCode: String): String? =
    (withTimeoutOrNull(timeoutMs) { Outcome(step.await()) } ?: Outcome(timeoutCode)).failure
  private const val MODE_POLL_MS = 500L

  val current: Call? get() = synchronized(lock) { call }

  /** Why a live call is not possible on this device, or null when it is. */
  fun unsupportedReason(context: Context): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return "API_BELOW_26"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELECOM)) return "NO_TELECOM"
    return null
  }

  fun capability(context: Context): Map<String, Any?> {
    val reason = unsupportedReason(context)
    return mapOf(
      "supported" to (reason == null),
      "reason" to reason,
      "sdk" to Build.VERSION.SDK_INT,
      "microphoneGranted" to (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED),
      "inCall" to (current?.machine?.isLive == true),
    )
  }

  /** Starts the one call. Resolves once Telecom made it active and the foreground service runs; throws [StartException]. */
  suspend fun startCall(context: Context, options: StartOptions): Map<String, Any?> {
    appContext = context.applicationContext
    unsupportedReason(context)?.let { throw StartException(it) }
    if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) throw StartException("MIC_PERMISSION_DENIED")
    val c = Call(options)
    synchronized(lock) {
      val existing = call
      if (existing != null && existing.machine.state != CallLifecycleMachine.State.ENDED) throw StartException("ALREADY_IN_CALL")
      c.machine.start()
      call = c
    }
    val manager = CallsManager(appContext)
    try {
      manager.registerAppWithTelecom(CallsManager.CAPABILITY_BASELINE)
    } catch (e: Throwable) {
      end(c, CallLifecycleMachine.EndSource.START_FAILED, "TELECOM_REGISTER_FAILED")
      throw StartException("TELECOM_REGISTER_FAILED")
    }
    val active = CompletableDeferred<String?>()
    val attributes = CallAttributesCompat(
      displayName = options.displayName,
      address = Uri.fromParts("qandeel", options.callId, null),
      direction = CallAttributesCompat.DIRECTION_OUTGOING,
      callType = CallAttributesCompat.CALL_TYPE_AUDIO_CALL,
      callCapabilities = CallAttributesCompat.SUPPORTS_SET_INACTIVE,
    )
    c.job = scope.launch {
      try {
        manager.addCall(
          attributes,
          onAnswer = { },
          onDisconnect = { cause -> onTelecomDisconnected(c, cause) },
          onSetActive = { onTelecomActive(c) },
          onSetInactive = { onTelecomInactive(c) },
        ) {
          c.scope = this
          launch { availableEndpoints.collect { list -> c.endpoints = list; report(c, "ENDPOINTS", mapOf("endpoints" to list.map { describe(it) })) } }
          launch { currentCallEndpoint.collect { e -> c.endpoint = e; report(c, "ENDPOINT", mapOf("endpoint" to describe(e))) } }
          launch { isMuted.collect { m -> report(c, "SYSTEM_MUTE", mapOf("muted" to m)) } }
          launch {
            when (val result = setActive()) {
              is CallControlResult.Success -> active.complete(null)
              is CallControlResult.Error -> active.complete("SET_ACTIVE_FAILED_${result.errorCode}")
            }
          }
        }
      } catch (e: CancellationException) {
        active.complete("CANCELLED")
        throw e
      } catch (e: Throwable) {
        active.complete("ADD_CALL_FAILED")
      }
    }
    val failure = awaitOutcome(active, START_TIMEOUT_MS, "TELECOM_TIMEOUT")
    if (failure != null) {
      end(c, CallLifecycleMachine.EndSource.START_FAILED, failure)
      throw StartException(if (c.machine.endSource == CallLifecycleMachine.EndSource.START_FAILED) failure else "ENDED_DURING_START")
    }
    val up = CompletableDeferred<String?>()
    c.serviceUp = up
    val actions = synchronized(lock) { c.machine.activated() }
    execute(c, actions)
    if (c.machine.state != CallLifecycleMachine.State.ACTIVE) throw StartException("ENDED_DURING_START")
    val serviceFailure = awaitOutcome(up, SERVICE_TIMEOUT_MS, "SERVICE_TIMEOUT")
    if (serviceFailure != null) {
      end(c, CallLifecycleMachine.EndSource.START_FAILED, serviceFailure)
      throw StartException(serviceFailure)
    }
    if (options.speaker) requestRoute(CallEndpointCompat.TYPE_SPEAKER, onlyFromEarpiece = true)
    return mapOf("state" to c.machine.state.name, "sdk" to Build.VERSION.SDK_INT, "telecom" to "CORE_TELECOM")
  }

  /** The app's End (the person's, or the server's end relayed by the controller). Idempotent. */
  fun endCall(source: CallLifecycleMachine.EndSource, detail: String?) {
    current?.let { end(it, source, detail) }
  }

  /** The person asks to continue a held call (or the controller does once the other call is over). */
  fun resumeCall(): Boolean {
    val c = current ?: return false
    if (c.machine.state != CallLifecycleMachine.State.HELD) return false
    scope.launch { trySetActive(c) }
    return true
  }

  /** A route change through Telecom only. [type] is a `CallEndpointCompat.TYPE_*`. */
  fun requestRoute(type: Int, onlyFromEarpiece: Boolean = false): Boolean {
    val c = current ?: return false
    val target = c.endpoints.firstOrNull { it.type == type } ?: return false
    if (onlyFromEarpiece && c.endpoint != null && c.endpoint?.type != CallEndpointCompat.TYPE_EARPIECE) return false
    val control = c.scope ?: return false
    scope.launch {
      val result = control.requestEndpointChange(target)
      report(c, "ENDPOINT_REQUEST", mapOf("endpoint" to mapOf("type" to typeName(type)), "result" to if (result is CallControlResult.Success) "SUCCESS" else "ERROR"))
    }
    return true
  }

  fun updateNotification(text: String): Boolean {
    val c = current ?: return false
    if (!c.machine.isLive) return false
    c.notificationText = text
    CallNotification.post(appContext, c)
    return true
  }

  /** The engine of the call (TELECOM-owned audio) may start only while the call is ACTIVE. */
  fun attachEngine(engine: CallAudioEngine): Boolean {
    val c = current ?: return false
    synchronized(lock) {
      if (c.machine.state != CallLifecycleMachine.State.ACTIVE) return false
      c.engine = engine
    }
    return true
  }

  /** The engine stopped by itself (a fault). A call whose audio is gone does not pretend to go on. */
  fun engineStopped(engine: CallAudioEngine, reason: String?) {
    val c = current ?: return
    if (c.engine !== engine) return
    c.engine = null
    val source = when (reason) {
      "CAPTURE_LOST", "MIC_RESUME_FAILED", "PERMISSION_DENIED" -> CallLifecycleMachine.EndSource.MICROPHONE
      "CALL_ENDED", "STOPPED_BY_CLIENT", "MODULE_DESTROYED" -> return
      else -> CallLifecycleMachine.EndSource.ENGINE
    }
    end(c, source, reason)
  }

  // ------------------------------------------------------------------ the service's reports

  fun serviceStarted(failure: String?) {
    current?.serviceUp?.complete(failure)
  }

  fun hangUpFromNotification() = endCall(CallLifecycleMachine.EndSource.NOTIFICATION, null)

  fun taskRemoved() = endCall(CallLifecycleMachine.EndSource.TASK_REMOVED, null)

  fun serviceDestroyed() {
    val c = current ?: return
    if (c.machine.isLive) end(c, CallLifecycleMachine.EndSource.SERVICE, null)
  }

  // ------------------------------------------------------------------ Telecom's callbacks

  private fun onTelecomDisconnected(c: Call, cause: DisconnectCause) {
    end(c, CallLifecycleMachine.EndSource.SYSTEM, "TELECOM_${cause.code}")
    synchronized(lock) { c.machine.released() }
  }

  private fun onTelecomInactive(c: Call) {
    val actions = synchronized(lock) { c.machine.systemInactive() }
    execute(c, actions)
  }

  private fun onTelecomActive(c: Call) {
    val actions = synchronized(lock) { c.machine.systemActive() }
    execute(c, actions)
  }

  private suspend fun trySetActive(c: Call) {
    val control = c.scope ?: return
    if (control.setActive() is CallControlResult.Success) onTelecomActive(c)
  }

  /** While HELD: once the other call is over (the mode left IN_CALL / RINGTONE twice in a row), ask to be active again. */
  private fun watchForResume(c: Call) {
    c.watch?.cancel()
    val audio = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    c.watch = scope.launch {
      var quiet = 0
      while (c.machine.state == CallLifecycleMachine.State.HELD) {
        delay(MODE_POLL_MS)
        val mode = audio.mode
        quiet = if (mode != AudioManager.MODE_IN_CALL && mode != AudioManager.MODE_RINGTONE) quiet + 1 else 0
        if (quiet >= 2) {
          trySetActive(c)
          quiet = 0
        }
      }
    }
  }

  // ------------------------------------------------------------------ the latch and its actions

  private fun end(c: Call, source: CallLifecycleMachine.EndSource, detail: String?) {
    val actions = synchronized(lock) { c.machine.end(source, detail) }
    execute(c, actions)
  }

  private fun execute(c: Call, actions: List<CallLifecycleMachine.Action>) {
    for (action in actions) {
      when (action) {
        CallLifecycleMachine.Action.START_SERVICE -> {
          c.startedAtMs = System.currentTimeMillis()
          try {
            ContextCompat.startForegroundService(appContext, Intent(appContext, CallForegroundService::class.java).setAction(CallForegroundService.ACTION_START))
          } catch (e: Throwable) {
            c.serviceUp?.complete("SERVICE_START_REFUSED")
          }
        }
        CallLifecycleMachine.Action.HOLD_AUDIO -> {
          c.engine?.hold("TELECOM_INACTIVE")
          watchForResume(c)
        }
        CallLifecycleMachine.Action.RESUME_AUDIO -> {
          c.watch?.cancel()
          // A microphone that cannot come back stops the engine, which ends the call (MICROPHONE); it is never reported
          // RESUMED first.
          if (c.engine?.resume() == false) return
        }
        CallLifecycleMachine.Action.STOP_AUDIO -> {
          c.watch?.cancel()
          val engine = c.engine
          c.engine = null
          if (engine != null) Thread { engine.stop("CALL_ENDED") }.start()
        }
        CallLifecycleMachine.Action.DISCONNECT_TELECOM -> {
          val control = c.scope
          if (control == null) {
            c.job?.cancel()
            synchronized(lock) { c.machine.released() }
          } else {
            scope.launch {
              try {
                control.disconnect(DisconnectCause(DisconnectCause.LOCAL))
              } catch (_: Throwable) {
              } finally {
                synchronized(lock) { c.machine.released() }
              }
            }
          }
        }
        CallLifecycleMachine.Action.STOP_SERVICE -> {
          try { appContext.stopService(Intent(appContext, CallForegroundService::class.java)) } catch (_: Throwable) {}
          CallNotification.cancel(appContext)
        }
        CallLifecycleMachine.Action.REPORT_ACTIVE -> report(c, "ACTIVE", emptyMap())
        CallLifecycleMachine.Action.REPORT_HELD -> report(c, "HELD", emptyMap())
        CallLifecycleMachine.Action.REPORT_RESUMED -> report(c, "RESUMED", emptyMap())
        CallLifecycleMachine.Action.REPORT_ENDED -> report(c, "ENDED", mapOf("source" to c.machine.endSource?.name, "detail" to c.machine.endDetail))
      }
    }
  }

  private fun report(c: Call, type: String, extra: Map<String, Any?>) {
    listener?.onLifecycle(mapOf("type" to type, "callId" to c.options.callId, "state" to c.machine.state.name, "ignoredLate" to c.machine.ignoredLate) + extra)
  }

  /** The endpoint's type only: a Bluetooth device's name (often a person's) never leaves the module. */
  private fun describe(e: CallEndpointCompat): Map<String, Any?> = mapOf("type" to typeName(e.type))

  fun typeName(type: Int): String = when (type) {
    CallEndpointCompat.TYPE_EARPIECE -> "EARPIECE"
    CallEndpointCompat.TYPE_SPEAKER -> "SPEAKER"
    CallEndpointCompat.TYPE_WIRED_HEADSET -> "WIRED_HEADSET"
    CallEndpointCompat.TYPE_BLUETOOTH -> "BLUETOOTH"
    CallEndpointCompat.TYPE_STREAMING -> "STREAMING"
    else -> "UNKNOWN"
  }

  fun typeOf(name: String): Int? = when (name) {
    "EARPIECE" -> CallEndpointCompat.TYPE_EARPIECE
    "SPEAKER" -> CallEndpointCompat.TYPE_SPEAKER
    "WIRED_HEADSET" -> CallEndpointCompat.TYPE_WIRED_HEADSET
    "BLUETOOTH" -> CallEndpointCompat.TYPE_BLUETOOTH
    else -> null
  }
}
