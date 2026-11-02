package expo.modules.qandeelvoicecall

import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.Uint8Array

/**
 * S8B-06 CP1 — the JS surface of QANDEEL's native call audio engine ([CallAudioEngine]). Android only; iOS has no module
 * in CP1 and the JS port reports the engine unavailable there.
 *
 * One engine at a time. `start` opens both directions; `enqueueReply` hands one REPLY_AUDIO packet (the client already
 * checked its connection epoch); `setMuted` stops the uplink packets while the capture clock keeps running; `stop`
 * releases everything. Events carry the uplink packets (base64), the heard PLAYOUT marks, the local barge-in reports and
 * the engine's state. `forceBargeIn` exists for the device proof's timing cross-check and is called by nothing else.
 */
class QandeelVoiceCallModule : Module() {
  private var engine: CallAudioEngine? = null

  private class EngineException(code: String) : CodedException(code, code, null)

  override fun definition() = ModuleDefinition {
    Name("QandeelVoiceCall")

    Events(
      "onUplink", "onPlayout", "onBargeIn", "onBargeInTrace", "onLevels", "onSpeech", "onReplyDrained",
      "onEngineState", "onFault", "onFocus", "onRoute",
    )

    AsyncFunction("start") { options: Map<String, Any?> ->
      val context = appContext.reactContext ?: throw EngineException("ENGINE_NO_CONTEXT")
      engine?.let { if (it.isRunning()) throw EngineException("ALREADY_RUNNING") }
      val created = CallAudioEngine(context, parse(options), sink())
      try {
        val described = created.start()
        engine = created
        described
      } catch (e: IllegalStateException) {
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

    OnDestroy {
      engine?.stop("MODULE_DESTROYED")
      engine = null
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

    override fun state(state: String, reason: String?) = sendEvent("onEngineState", mapOf("state" to state, "reason" to reason))
    override fun fault(code: String) = sendEvent("onFault", mapOf("code" to code))
    override fun focus(state: String) = sendEvent("onFocus", mapOf("state" to state))
    override fun route(change: String, devices: List<String>) = sendEvent("onRoute", mapOf("change" to change, "devices" to devices))
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
