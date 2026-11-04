package expo.modules.qandeelvoicecall

import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.Uint8Array

/**
 * S8B-06 CP1 + CP2 — the JS surface of QANDEEL's native call: the audio engine ([CallAudioEngine], CP1) and the call's
 * platform lifecycle ([LiveCallRegistry]: Core-Telecom, the foreground service, the CallStyle notification, CP2).
 *
 * Engine (CP1): one engine at a time. `start` opens both directions; `enqueueReply` hands one REPLY_AUDIO packet (the client
 * already checked its connection epoch); `setMuted` stops the uplink packets while the capture clock keeps running; `stop`
 * releases everything. `forceBargeIn` exists for the device proof's timing cross-check and is called by nothing else.
 * CP2: an engine started with `audioOwner: 'PLATFORM_CALL'` (the production call, Telecom-owned) starts only inside an ACTIVE call and is held,
 * resumed and stopped by the call; `playCue` queues the 60-minute warning in the call's own audio now, `scheduleCue` at a
 * time the engine's own thread keeps (the local trigger, which runs with the screen locked).
 *
 * Call (CP2): `callCapability`, `startCall` (the one call, from the foreground), `endCall`, `resumeCall`, `requestRoute`
 * (Telecom endpoints only), `updateCallNotification`. Lifecycle events: `onCallLifecycle`.
 */
class QandeelVoiceCallModule : Module() {
  private var engine: CallAudioEngine? = null
  /** The notification line each warning cue brings (the controller's copy rows), applied natively when the cue is queued. */
  private val cueTexts = java.util.concurrent.ConcurrentHashMap<String, String>()

  private class EngineException(code: String) : CodedException(code, code, null)

  override fun definition() = ModuleDefinition {
    Name("QandeelVoiceCall")

    Events(
      "onUplink", "onPlayout", "onBargeIn", "onBargeInTrace", "onLevels", "onSpeech", "onReplyDrained",
      "onEngineState", "onFault", "onFocus", "onRoute", "onHold", "onResume", "onCue", "onCallLifecycle", "onTick",
    )

    OnCreate {
      LiveCallRegistry.listener = object : LiveCallRegistry.Listener {
        override fun onLifecycle(event: Map<String, Any?>) = sendEvent("onCallLifecycle", numbers(event))
      }
    }

    AsyncFunction("start") { options: Map<String, Any?> ->
      val context = appContext.reactContext ?: throw EngineException("ENGINE_NO_CONTEXT")
      engine?.let { if (it.isRunning()) throw EngineException("ALREADY_RUNNING") }
      val parsed = parse(options)
      val created = CallAudioEngine(context, parsed, sink())
      // The production call's audio exists only inside its Telecom call: never a microphone without a call.
      if (parsed.owner == CallAudioEngine.AudioOwner.TELECOM && !LiveCallRegistry.attachEngine(created)) throw EngineException("NO_ACTIVE_CALL")
      try {
        val described = created.start()
        engine = created
        if (parsed.owner == CallAudioEngine.AudioOwner.TELECOM && LiveCallRegistry.current?.engine !== created) {
          // The call ended while the engine was opening: it stops at once, nothing stays open.
          created.stop("CALL_ENDED")
          engine = null
          throw EngineException("CALL_ENDED")
        }
        described
      } catch (e: IllegalStateException) {
        LiveCallRegistry.engineStopped(created, e.message ?: "ENGINE_START_FAILED")
        throw EngineException(e.message ?: "ENGINE_START_FAILED")
      }
    }

    AsyncFunction("stop") {
      engine?.stop("STOPPED_BY_CLIENT")
      engine = null
    }

    Function("setMuted") { muted: Boolean ->
      engine?.setMuted(muted)
    }

    Function("enqueueReply") { callTurnIndex: Double, chunkSeq: Double, offsetMs: Double, packet: Uint8Array ->
      val running = engine ?: return@Function "NOT_RUNNING"
      val bytes = ByteArray(packet.byteLength)
      packet.read(bytes, 0, bytes.size)
      running.enqueueReply(callTurnIndex.toLong(), chunkSeq.toLong(), offsetMs.toLong(), bytes)
    }

    Function("forceBargeIn") {
      engine?.forceBargeIn() ?: false
    }

    Function("describe") {
      engine?.describe()
    }

    Function("playCue") { id: String, kind: String, forceAfterMs: Double, notificationText: String? ->
      notificationText?.let { cueTexts[id] = it }
      engine?.playCue(id, kind, forceAfterMs.toLong()) ?: "NOT_RUNNING"
    }

    Function("scheduleCue") { id: String, kind: String, dueInMs: Double, forceAfterMs: Double, notificationText: String? ->
      notificationText?.let { cueTexts[id] = it }
      engine?.scheduleCue(id, kind, dueInMs.toLong(), forceAfterMs.toLong()) ?: "NOT_RUNNING"
    }

    // ------------------------------------------------------------------ the call (CP2)

    Function("callCapability") {
      val context = appContext.reactContext ?: throw EngineException("ENGINE_NO_CONTEXT")
      LiveCallRegistry.capability(context)
    }

    AsyncFunction("startCall") Coroutine { options: Map<String, Any?> ->
      val context = appContext.reactContext ?: throw EngineException("ENGINE_NO_CONTEXT")
      fun text(key: String): String = (options[key] as? String)?.takeIf { it.isNotBlank() } ?: throw EngineException("CALL_OPTIONS_INVALID")
      try {
        LiveCallRegistry.startCall(
          context,
          LiveCallRegistry.StartOptions(
            callId = text("callId"),
            displayName = text("displayName"),
            notificationTitle = text("notificationTitle"),
            notificationText = text("notificationText"),
            channelName = text("channelName"),
            speaker = options["route"] == "SPEAKER",
          ),
        )
      } catch (e: LiveCallRegistry.StartException) {
        throw EngineException(e.code)
      }
    }

    Function("endCall") { detail: String? ->
      LiveCallRegistry.endCall(CallLifecycleMachine.EndSource.APP, detail)
    }

    Function("resumeCall") {
      LiveCallRegistry.resumeCall()
    }

    Function("requestRoute") { route: String ->
      val type = LiveCallRegistry.typeOf(route) ?: return@Function false
      LiveCallRegistry.requestRoute(type)
    }

    Function("updateCallNotification") { text: String ->
      LiveCallRegistry.updateNotification(text)
    }

    OnDestroy {
      engine?.stop("MODULE_DESTROYED")
      engine = null
      LiveCallRegistry.endCall(CallLifecycleMachine.EndSource.APP_GONE, null)
      LiveCallRegistry.listener = null
    }
  }

  private fun parse(options: Map<String, Any?>): CallAudioEngine.EngineOptions {
    val vad = (options["vad"] as? Map<*, *>) ?: emptyMap<String, Any?>()
    fun num(key: String, fallback: Double): Double = (vad[key] as? Number)?.toDouble() ?: fallback
    val defaults = VadConfig()
    return CallAudioEngine.EngineOptions(
      route = if (options["route"] == "SPEAKER") CallAudioEngine.Route.SPEAKER else CallAudioEngine.Route.EARPIECE,
      capture = when (options["capture"]) {
        "UNPROCESSED_PROOF" -> CallAudioEngine.Capture.UNPROCESSED_PROOF
        "RAW_MEDIA_PROOF" -> CallAudioEngine.Capture.RAW_MEDIA_PROOF
        "RAW_PERFORMANCE_PROOF" -> CallAudioEngine.Capture.RAW_PERFORMANCE_PROOF
        "RAW_CAMCORDER_PROOF" -> CallAudioEngine.Capture.RAW_CAMCORDER_PROOF
        "RAW_UNPROCESSED_PROOF" -> CallAudioEngine.Capture.RAW_UNPROCESSED_PROOF
        else -> CallAudioEngine.Capture.VOICE_COMMUNICATION
      },
      aec = options["aec"] != false,
      bargeIn = if (options["bargeIn"] == "REPORT_ONLY") CallAudioEngine.BargeInAction.REPORT_ONLY else CallAudioEngine.BargeInAction.STOP,
      vad = VadConfig(
        onsetFrames = num("onsetFrames", defaults.onsetFrames.toDouble()).toInt(),
        floorMarginDb = num("floorMarginDb", defaults.floorMarginDb),
        absoluteMinDb = num("absoluteMinDb", defaults.absoluteMinDb),
        echoGuardDb = num("echoGuardDb", defaults.echoGuardDb),
      ),
      trace = options["trace"] == true,
      owner = if (options["audioOwner"] == "PLATFORM_CALL") CallAudioEngine.AudioOwner.TELECOM else CallAudioEngine.AudioOwner.SELF,
    )
  }

  private fun sink() = object : CallAudioEngine.EngineSink {
    override fun uplink(captureMs: Long, packet: ByteArray) =
      sendEvent("onUplink", mapOf("captureMs" to captureMs.toDouble(), "packet" to Base64.encodeToString(packet, Base64.NO_WRAP)))

    override fun playout(mark: ReplyLedger.Mark, presentedFrame: Long, source: String) = sendEvent(
      "onPlayout",
      mapOf(
        "callTurnIndex" to mark.callTurnIndex.toDouble(), "chunkSeq" to mark.chunkSeq.toDouble(), "playedMs" to mark.playedMs.toDouble(),
        "presentedFrame" to presentedFrame.toDouble(), "source" to source,
      ),
    )

    override fun bargeIn(report: Map<String, Any?>) = sendEvent("onBargeIn", numbers(report))
    override fun trace(report: Map<String, Any?>) = sendEvent("onBargeInTrace", numbers(report))
    override fun levels(report: Map<String, Any?>) = sendEvent("onLevels", numbers(report))
    override fun speech(onsetCaptureMs: Long, detectCaptureMs: Long) =
      sendEvent("onSpeech", mapOf("onsetCaptureMs" to onsetCaptureMs.toDouble(), "detectCaptureMs" to detectCaptureMs.toDouble()))

    override fun replyDrained(callTurnIndex: Long, chunkSeq: Long) =
      sendEvent("onReplyDrained", mapOf("callTurnIndex" to callTurnIndex.toDouble(), "chunkSeq" to chunkSeq.toDouble()))

    override fun state(state: String, reason: String?) {
      sendEvent("onEngineState", mapOf("state" to state, "reason" to reason))
      val current = engine
      if (state == "STOPPED" && current != null) LiveCallRegistry.engineStopped(current, reason)
    }

    override fun fault(code: String) = sendEvent("onFault", mapOf("code" to code))
    override fun focus(state: String) = sendEvent("onFocus", mapOf("state" to state))
    override fun route(change: String, devices: List<String>) = sendEvent("onRoute", mapOf("change" to change, "devices" to devices))
    override fun held(captureMs: Long, cause: String) = sendEvent("onHold", mapOf("captureMs" to captureMs.toDouble(), "cause" to cause))
    override fun resumed(captureMs: Long) = sendEvent("onResume", mapOf("captureMs" to captureMs.toDouble()))
    override fun tick(nowMs: Long) = sendEvent("onTick", mapOf("nowMs" to nowMs.toDouble()))
    override fun cue(event: String, id: String, forced: Boolean, source: String?) {
      // The notification changes with the warning even while JS is paused (the screen locked, the app in the background).
      if (event == "QUEUED" || event == "DUE") cueTexts[id]?.let { LiveCallRegistry.updateNotification(it) }
      sendEvent("onCue", mapOf("event" to event, "id" to id, "forced" to forced, "source" to source))
    }
  }

  /** JS numbers are doubles: every Long (nanosecond clocks, frame positions) crosses as one. */
  private fun numbers(report: Map<String, Any?>): Map<String, Any?> = report.mapValues { (_, v) -> convert(v) }

  private fun convert(value: Any?): Any? = when (value) {
    is Long -> value.toDouble()
    is Int -> value.toDouble()
    is List<*> -> value.map { convert(it) }
    is Map<*, *> -> value.entries.associate { (k, v) -> k.toString() to convert(v) }
    else -> value
  }
}
