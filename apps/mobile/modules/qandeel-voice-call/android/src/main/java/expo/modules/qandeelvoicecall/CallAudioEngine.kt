package expo.modules.qandeelvoicecall

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTimestamp
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.VolumeShaper
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Process
import java.util.concurrent.atomic.AtomicBoolean

/**
 * S8B-06 CP1 — QANDEEL's native call audio engine for Android (contract v1.0 §9, the execution task §3 / §4).
 *
 * Full duplex, both directions at once, and the microphone never stops while QANDEEL speaks, while a barge-in is detected
 * or while the reply is silenced:
 *
 *   capture   `AudioRecord(VOICE_COMMUNICATION)` 16 kHz mono with the platform's `AcousticEchoCanceler` on its session,
 *             under `MODE_IN_COMMUNICATION`; every 20 ms frame gets the next capture-clock instant (0, 20, 40 … from the
 *             engine's first frame, never reset by mute), is Opus-encoded for the uplink unless muted, and is judged by the
 *             speech-onset detector AFTER the echo canceller.
 *   playback  `AudioTrack(USAGE_VOICE_COMMUNICATION)` 24 kHz mono, low latency, written continuously (silence between
 *             replies) so its frame positions never jump; reply packets are admitted by the [ReplyLedger] gate, decoded and
 *             booked with the frames they occupy.
 *   barge-in  when the detector declares 200 ms of continuous speech while QANDEEL is audible, the engine fades the track
 *             to zero at once on the capture thread (a `VolumeShaper` ramp of [RAMP_MS], no click), strikes the cut reply
 *             from the ledger at the PRESENTED position, drops its queued packets, and refuses every later packet of it.
 *             The volume returns only after every frame of the cut reply has passed the mixer.
 *   playout   the heard position comes from `AudioTrack.getTimestamp` (frames PRESENTED at a monotonic time), never from
 *             what was queued or written; a missing timestamp falls back to the mixer position minus a pessimistic latency.
 *
 * It owns no transport, no protocol and no call lifecycle (no Telecom, no foreground service — that is S8B-06 CP2): the JS
 * client sends what it emits. It stores nothing and logs nothing; no audio leaves it except the uplink packets handed to
 * the client. Level traces (dBFS numbers only, never samples) are produced only when the proof build asks for them.
 */
class CallAudioEngine(
  private val context: Context,
  private val options: EngineOptions,
  private val sink: EngineSink,
) {
  enum class Route { EARPIECE, SPEAKER }
  /**
   * `UNPROCESSED_PROOF` and `RAW_MEDIA_PROOF` exist only for the device proof's echo comparison. `RAW_MEDIA_PROOF` is the
   * positive control: no communication mode, media playback, the unprocessed (or plain) microphone and no canceller, so
   * the reply's acoustic echo reaches the microphone with no platform call processing at all. The `RAW_*_PROOF` variants
   * are the same control on another capture source (`VOICE_PERFORMANCE`, `CAMCORDER`, `UNPROCESSED` asked for even where
   * the property says unsupported), because a vendor may attach its own preprocessing to a source by itself.
   */
  enum class Capture {
    VOICE_COMMUNICATION, UNPROCESSED_PROOF, RAW_MEDIA_PROOF, RAW_PERFORMANCE_PROOF, RAW_CAMCORDER_PROOF, RAW_UNPROCESSED_PROOF;
    val rawMedia: Boolean get() = this != VOICE_COMMUNICATION && this != UNPROCESSED_PROOF
  }
  enum class BargeInAction { STOP, REPORT_ONLY }

  data class EngineOptions(
    val route: Route,
    val capture: Capture,
    val aec: Boolean,
    val bargeIn: BargeInAction,
    val vad: VadConfig,
    val trace: Boolean,
  )

  interface EngineSink {
    fun uplink(captureMs: Long, packet: ByteArray)
    fun playout(mark: ReplyLedger.Mark, presentedFrame: Long, source: String)
    fun bargeIn(report: Map<String, Any?>)
    fun trace(report: Map<String, Any?>)
    fun levels(report: Map<String, Any?>)
    fun speech(onsetCaptureMs: Long, detectCaptureMs: Long)
    fun replyDrained(callTurnIndex: Long, chunkSeq: Long)
    fun state(state: String, reason: String?)
    fun fault(code: String)
    fun focus(state: String)
    fun route(change: String, devices: List<String>)
  }

  private class Pending(val callTurnIndex: Long, val chunkSeq: Long, val offsetMs: Long, val packet: ByteArray)
  private class Written(val atNs: Long, val levelDb: Double)
  private class FrameTrace(val captureMs: Long, val captureTimeNs: Long, val levelDb: Double, val refDb: Double?, val audible: Boolean)
  private class DueTrace(val dueCaptureMs: Long, val detectedAtNs: Long, val base: Map<String, Any?>)

  private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val running = AtomicBoolean(false)
  private val lock = Object()
  private val ledger = ReplyLedger()
  private val pending = ArrayDeque<Pending>()
  private val recentWrites = ArrayDeque<Written>()
  private val traceRing = ArrayDeque<FrameTrace>()
  private val dueTraces = ArrayList<DueTrace>()
  private val detector = SpeechOnsetDetector(options.vad)

  private var record: AudioRecord? = null
  private var track: AudioTrack? = null
  private var aec: AcousticEchoCanceler? = null
  private var shaper: VolumeShaper? = null
  private var focusRequest: AudioFocusRequest? = null
  private var captureThread: Thread? = null
  private var playbackThread: Thread? = null
  private var savedMode = AudioManager.MODE_NORMAL
  private var savedSpeaker = false
  private var routeSet = false
  private var trackBufferFrames = 0
  private var recordBufferBytes = 0
  private var captureSourceUsed = ""

  @Volatile private var muted = false
  @Volatile private var captureMsNow = 0L

  // Under [lock].
  private var framesWritten = 0L
  private var restorePending = false
  private var restoreAtFrame = -1L
  private var faded = false
  private var focusFaded = false
  private var drainTurn = -1L
  private var drainChunk = -1L

  // Counters (content-free).
  @Volatile private var uplinkPackets = 0L
  @Volatile private var uplinkBytes = 0L
  @Volatile private var encodeNsMax = 0L
  @Volatile private var encodeNsTotal = 0L
  @Volatile private var decodeErrors = 0L
  @Volatile private var bargeIns = 0L
  @Volatile private var reportOnlyCandidates = 0L
  @Volatile private var quietOnsets = 0L
  @Volatile private var playoutMarks = 0L
  @Volatile private var timestampMisses = 0L
  @Volatile private var silenceFrames = 0L

  private val deviceCallback = object : AudioDeviceCallback() {
    override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) = sink.route("ADDED", addedDevices.map { deviceName(it.type) })
    override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) = sink.route("REMOVED", removedDevices.map { deviceName(it.type) })
  }

  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    when (change) {
      AudioManager.AUDIOFOCUS_LOSS -> {
        sink.focus("LOSS")
        Thread { stop("FOCUS_LOSS") }.start()
      }
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
        sink.focus("LOSS_TRANSIENT")
        synchronized(lock) { focusFaded = true; applyVolume() }
      }
      AudioManager.AUDIOFOCUS_GAIN -> {
        sink.focus("GAIN")
        synchronized(lock) { focusFaded = false; applyVolume() }
      }
    }
  }

  // ------------------------------------------------------------------ lifecycle

  /** Starts both directions. Throws a coded [IllegalStateException] and leaves nothing open when anything fails. */
  fun start(): Map<String, Any?> {
    if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      throw IllegalStateException("PERMISSION_DENIED")
    }
    if (!running.compareAndSet(false, true)) throw IllegalStateException("ALREADY_RUNNING")
    try {
      openSession()
      openCapture()
      openPlayback()
    } catch (e: Throwable) {
      releaseAll()
      running.set(false)
      throw if (e is IllegalStateException && e.message?.startsWith("ENGINE_") == true) e else IllegalStateException("ENGINE_START_FAILED")
    }
    playbackThread = Thread({ playbackLoop() }, "qandeel-call-playback").apply { start() }
    captureThread = Thread({ captureLoop() }, "qandeel-call-capture").apply { start() }
    sink.state("RUNNING", null)
    return describe()
  }

  /** Stops and releases everything, restores the audio mode, the route and the focus. Idempotent; never throws. */
  fun stop(reason: String) {
    if (!running.compareAndSet(true, false)) return
    val self = Thread.currentThread()
    for (thread in listOf(captureThread, playbackThread)) {
      if (thread != null && thread !== self) try { thread.join(1000) } catch (_: InterruptedException) {}
    }
    releaseAll()
    sink.state("STOPPED", reason)
  }

  fun isRunning(): Boolean = running.get()

  fun setMuted(value: Boolean) {
    muted = value
  }

  /** The client hands one REPLY_AUDIO packet (its connection epoch already checked). Returns the gate's answer. */
  fun enqueueReply(callTurnIndex: Long, chunkSeq: Long, offsetMs: Long, packet: ByteArray): String {
    synchronized(lock) {
      if (!running.get()) return "NOT_RUNNING"
      if (pending.size >= MAX_PENDING_PACKETS) return "OVERFLOW"
      val admit = ledger.admit(callTurnIndex, chunkSeq)
      if (admit == ReplyLedger.Admit.ACCEPT) pending.addLast(Pending(callTurnIndex, chunkSeq, offsetMs, packet))
      return admit.name
    }
  }

  /** Validation only: the same local cut as a detected barge-in, at this instant, without speech. */
  fun forceBargeIn(): Boolean {
    if (!running.get()) return false
    val now = System.nanoTime()
    val at = captureMsNow
    return bargeIn(at, at, now, forced = true)
  }

  fun describe(): Map<String, Any?> {
    val canceller = aec
    val sdk = Build.VERSION.SDK_INT
    synchronized(lock) {
      return mapOf(
        "sdk" to sdk,
        "device" to "${Build.MANUFACTURER} ${Build.MODEL}",
        "captureSource" to captureSourceUsed,
        "aecAvailable" to AcousticEchoCanceler.isAvailable(),
        "aecAttached" to (canceller != null),
        "aecEnabled" to (canceller?.enabled ?: false),
        "aecName" to (canceller?.descriptor?.name),
        "aecImplementor" to (canceller?.descriptor?.implementor),
        "nsAvailable" to NoiseSuppressor.isAvailable(),
        "agcAvailable" to AutomaticGainControl.isAvailable(),
        "audioMode" to audioManager.mode,
        "route" to options.route.name,
        "routeDevice" to routeDevice(),
        "recordRate" to UplinkOpusEncoder.RATE,
        "recordBufferBytes" to recordBufferBytes,
        "trackRate" to DownlinkOpusDecoder.RATE,
        "trackBufferFrames" to trackBufferFrames,
        "lowLatency" to (sdk >= Build.VERSION_CODES.O && track?.performanceMode == AudioTrack.PERFORMANCE_MODE_LOW_LATENCY),
        "volumeShaper" to (shaper != null),
        "opus" to "concentus-1.0.2 uplink 16k/20ms/${UplinkOpusEncoder.BITRATE}bps FEC=on loss=10 DTX=off c${UplinkOpusEncoder.COMPLEXITY}; downlink 24k",
        "bargeInAction" to options.bargeIn.name,
        "vad" to "onset=${options.vad.onsetFrames}x20ms floor+${options.vad.floorMarginDb}dB abs>=${options.vad.absoluteMinDb}dB echoGuard=${options.vad.echoGuardDb}dB",
        "uplinkPackets" to uplinkPackets,
        "uplinkBytes" to uplinkBytes,
        "encodeMsMax" to encodeNsMax / 1e6,
        "encodeMsMean" to if (uplinkPackets > 0) encodeNsTotal / 1e6 / uplinkPackets else 0.0,
        "replyAdmitted" to ledger.admitted,
        "refusedLate" to ledger.refusedLate,
        "refusedStale" to ledger.refusedStale,
        "refusedRepeated" to ledger.refusedRepeated,
        "decodeErrors" to decodeErrors,
        "framesWritten" to framesWritten,
        "silenceFrames" to silenceFrames,
        "bargeIns" to bargeIns,
        "reportOnlyCandidates" to reportOnlyCandidates,
        "quietOnsets" to quietOnsets,
        "playoutMarks" to playoutMarks,
        "timestampMisses" to timestampMisses,
        "captureMs" to captureMsNow,
        "muted" to muted,
      )
    }
  }

  // ------------------------------------------------------------------ opening and releasing

  private fun openSession() {
    savedMode = audioManager.mode
    @Suppress("DEPRECATION")
    savedSpeaker = audioManager.isSpeakerphoneOn
    val attributes = playbackAttributes()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(attributes)
        .setOnAudioFocusChangeListener(focusListener)
        .build()
      focusRequest = request
      audioManager.requestAudioFocus(request)
    }
    if (options.capture.rawMedia) {
      audioManager.registerAudioDeviceCallback(deviceCallback, Handler(Looper.getMainLooper()))
      return
    }
    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val wanted = if (options.route == Route.SPEAKER) AudioDeviceInfo.TYPE_BUILTIN_SPEAKER else AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
      val device = audioManager.availableCommunicationDevices.firstOrNull { it.type == wanted }
      routeSet = device != null && audioManager.setCommunicationDevice(device)
    } else {
      @Suppress("DEPRECATION")
      audioManager.isSpeakerphoneOn = options.route == Route.SPEAKER
      routeSet = true
    }
    audioManager.registerAudioDeviceCallback(deviceCallback, Handler(Looper.getMainLooper()))
  }

  private fun openCapture() {
    val source = when (options.capture) {
      Capture.VOICE_COMMUNICATION -> MediaRecorder.AudioSource.VOICE_COMMUNICATION
      Capture.UNPROCESSED_PROOF, Capture.RAW_MEDIA_PROOF ->
        if (audioManager.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED) == "true") MediaRecorder.AudioSource.UNPROCESSED
        else MediaRecorder.AudioSource.MIC
      Capture.RAW_PERFORMANCE_PROOF ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) MediaRecorder.AudioSource.VOICE_PERFORMANCE else MediaRecorder.AudioSource.MIC
      Capture.RAW_CAMCORDER_PROOF -> MediaRecorder.AudioSource.CAMCORDER
      Capture.RAW_UNPROCESSED_PROOF -> MediaRecorder.AudioSource.UNPROCESSED
    }
    captureSourceUsed = when (source) {
      MediaRecorder.AudioSource.VOICE_COMMUNICATION -> "VOICE_COMMUNICATION"
      MediaRecorder.AudioSource.UNPROCESSED -> "UNPROCESSED"
      MediaRecorder.AudioSource.VOICE_PERFORMANCE -> "VOICE_PERFORMANCE"
      MediaRecorder.AudioSource.CAMCORDER -> "CAMCORDER"
      else -> "MIC"
    }
    val min = AudioRecord.getMinBufferSize(UplinkOpusEncoder.RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    if (min <= 0) throw IllegalStateException("ENGINE_RECORD_FORMAT")
    recordBufferBytes = maxOf(min * 2, UplinkOpusEncoder.FRAME_SAMPLES * 2 * 10)
    val created = try {
      AudioRecord.Builder()
        .setAudioSource(source)
        .setAudioFormat(AudioFormat.Builder().setSampleRate(UplinkOpusEncoder.RATE).setChannelMask(AudioFormat.CHANNEL_IN_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
        .setBufferSizeInBytes(recordBufferBytes)
        .build()
    } catch (e: SecurityException) {
      throw IllegalStateException("ENGINE_PERMISSION_DENIED")
    }
    if (created.state != AudioRecord.STATE_INITIALIZED) {
      created.release()
      throw IllegalStateException("ENGINE_RECORD_INIT")
    }
    record = created
    if (!options.capture.rawMedia && AcousticEchoCanceler.isAvailable()) {
      val canceller = AcousticEchoCanceler.create(created.audioSessionId)
      if (canceller != null) {
        canceller.setEnabled(options.aec)
        aec = canceller
      }
    }
    created.startRecording()
    if (created.recordingState != AudioRecord.RECORDSTATE_RECORDING) throw IllegalStateException("ENGINE_RECORD_START")
  }

  private fun openPlayback() {
    val min = AudioTrack.getMinBufferSize(DownlinkOpusDecoder.RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
    if (min <= 0) throw IllegalStateException("ENGINE_TRACK_FORMAT")
    val bytes = maxOf(min, DownlinkOpusDecoder.FRAME_SAMPLES * 2 * 3)
    val builder = AudioTrack.Builder()
      .setAudioAttributes(playbackAttributes())
      .setAudioFormat(AudioFormat.Builder().setSampleRate(DownlinkOpusDecoder.RATE).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
      .setBufferSizeInBytes(bytes)
      .setTransferMode(AudioTrack.MODE_STREAM)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) builder.setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
    val created = builder.build()
    if (created.state != AudioTrack.STATE_INITIALIZED) {
      created.release()
      throw IllegalStateException("ENGINE_TRACK_INIT")
    }
    track = created
    trackBufferFrames = created.bufferSizeInFrames
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      shaper = try {
        created.createVolumeShaper(
          VolumeShaper.Configuration.Builder()
            .setDuration(RAMP_MS)
            .setCurve(floatArrayOf(0f, 1f), floatArrayOf(1f, 0f))
            .setInterpolatorType(VolumeShaper.Configuration.INTERPOLATOR_TYPE_LINEAR)
            .build(),
        )
      } catch (_: Throwable) {
        null
      }
    }
    created.play()
  }

  private fun releaseAll() {
    try { record?.stop() } catch (_: Throwable) {}
    try { record?.release() } catch (_: Throwable) {}
    record = null
    try { aec?.release() } catch (_: Throwable) {}
    aec = null
    try { shaper?.close() } catch (_: Throwable) {}
    shaper = null
    try { track?.pause(); track?.flush() } catch (_: Throwable) {}
    try { track?.release() } catch (_: Throwable) {}
    track = null
    try { audioManager.unregisterAudioDeviceCallback(deviceCallback) } catch (_: Throwable) {}
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (routeSet) audioManager.clearCommunicationDevice()
      } else {
        @Suppress("DEPRECATION")
        audioManager.isSpeakerphoneOn = savedSpeaker
      }
    } catch (_: Throwable) {}
    routeSet = false
    try { audioManager.mode = savedMode } catch (_: Throwable) {}
    try {
      val request = focusRequest
      if (request != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) audioManager.abandonAudioFocusRequest(request)
    } catch (_: Throwable) {}
    focusRequest = null
    synchronized(lock) {
      pending.clear()
      recentWrites.clear()
      dueTraces.clear()
    }
  }

  // ------------------------------------------------------------------ capture

  private fun captureLoop() {
    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
    val source = record ?: return
    val encoder = UplinkOpusEncoder()
    val frame = ShortArray(UplinkOpusEncoder.FRAME_SAMPLES)
    val stamp = AudioTimestamp()
    var frameIndex = 0L
    var wasMuted = false
    var secondLevels = ArrayList<Double>(50)
    var secondRefs = ArrayList<Double?>(50)
    while (running.get()) {
      var got = 0
      while (got < frame.size && running.get()) {
        val n = source.read(frame, got, frame.size - got)
        if (n < 0) {
          sink.fault("CAPTURE_LOST")
          Thread { stop("CAPTURE_LOST") }.start()
          return
        }
        got += n
      }
      if (!running.get()) return
      val now = System.nanoTime()
      val captureMs = frameIndex * ReplyLedger.PACKET_MS
      captureMsNow = captureMs
      val captureTimeNs = if (source.getTimestamp(stamp, AudioTimestamp.TIMEBASE_MONOTONIC) == AudioRecord.SUCCESS) {
        stamp.nanoTime + (frameIndex * UplinkOpusEncoder.FRAME_SAMPLES - stamp.framePosition) * 1_000_000_000L / UplinkOpusEncoder.RATE
      } else {
        -1L
      }

      // The uplink first: it never waits for the detector and never stops for a barge-in.
      val isMuted = muted
      if (!isMuted) {
        if (wasMuted) encoder.reset()
        val t0 = System.nanoTime()
        val packet = encoder.encode(frame)
        val spent = System.nanoTime() - t0
        encodeNsTotal += spent
        if (spent > encodeNsMax) encodeNsMax = spent
        uplinkPackets += 1
        uplinkBytes += packet.size
        sink.uplink(captureMs, packet)
      }
      wasMuted = isMuted

      val level = SpeechOnsetDetector.levelDb(frame, frame.size)
      var audible: Boolean
      var ref: Double?
      synchronized(lock) {
        audible = audibleLocked(now)
        ref = if (audible) referenceLocked(now) else null
      }
      val decision = detector.push(level, ref, captureMs)
      if (options.trace) {
        synchronized(lock) {
          traceRing.addLast(FrameTrace(captureMs, captureTimeNs, level, ref, audible))
          while (traceRing.size > TRACE_FRAMES) traceRing.removeFirst()
        }
        secondLevels.add(level)
        secondRefs.add(ref)
        if (secondLevels.size == 50) {
          sink.levels(mapOf("toCaptureMs" to captureMs, "levelsDb" to secondLevels, "refDb" to secondRefs, "floorDb" to detector.floorDb))
          secondLevels = ArrayList(50)
          secondRefs = ArrayList(50)
        }
        emitDueTraces(captureMs)
      }
      if (decision.kind == SpeechOnsetDetector.Kind.ONSET) {
        if (audible) bargeIn(decision.onsetCaptureMs, captureMs, now, forced = false)
        else {
          quietOnsets += 1
          sink.speech(decision.onsetCaptureMs, captureMs)
        }
      }
      frameIndex += 1
    }
  }

  /** QANDEEL is audible: booked reply audio not yet all presented, or reply audio written within the echo window. */
  private fun audibleLocked(now: Long): Boolean {
    if (ledger.hasUnheard()) return true
    val last = recentWrites.lastOrNull() ?: return false
    return now - last.atNs <= ECHO_WINDOW_NS
  }

  /** The loudest reply packet written within the echo window (the echo guard's reference). */
  private fun referenceLocked(now: Long): Double? {
    while (recentWrites.isNotEmpty() && now - recentWrites.first().atNs > ECHO_WINDOW_NS) recentWrites.removeFirst()
    var max: Double? = null
    for (w in recentWrites) if (max == null || w.levelDb > max) max = w.levelDb
    return max
  }

  /**
   * The local cut (contract §5.2 steps 1–2). Runs on the capture thread (or the proof's forced call) and only touches the
   * track's volume and the ledger: the fade starts before anything else is measured.
   */
  private fun bargeIn(onsetCaptureMs: Long, detectCaptureMs: Long, detectedAtNs: Long, forced: Boolean): Boolean {
    val report: Map<String, Any?>
    synchronized(lock) {
      val output = track ?: return false
      val turn = ledger.currentTurn
      if (options.bargeIn == BargeInAction.REPORT_ONLY && !forced) {
        reportOnlyCandidates += 1
        report = mapOf(
          "action" to "REPORT_ONLY", "callTurnIndex" to turn, "onsetCaptureMs" to onsetCaptureMs, "detectCaptureMs" to detectCaptureMs,
          "detectedAtNs" to detectedAtNs, "forced" to false,
        )
      } else {
        faded = true
        applyVolume()
        val fadeAppliedAtNs = System.nanoTime()
        val head = output.playbackHeadPosition.toLong() and 0xffffffffL
        val stamp = AudioTimestamp()
        val hasStamp = output.getTimestamp(stamp)
        val latencyFrames = trackBufferFrames.toLong() + FALLBACK_HAL_LATENCY_FRAMES
        val presented = if (hasStamp) stamp.framePosition else maxOf(0L, head - latencyFrames)
        val final = ledger.cut(turn, presented) ?: ledger.lastMark?.takeIf { it.callTurnIndex == turn }
        pending.removeAll { it.callTurnIndex <= turn }
        // The cut reply is no longer audible: it stops being the echo reference, so it cannot be cut twice.
        recentWrites.clear()
        restorePending = true
        bargeIns += 1
        val rampNs = RAMP_MS * 1_000_000L
        val stopAtNs = if (hasStamp) stamp.nanoTime + (head - stamp.framePosition) * 1_000_000_000L / DownlinkOpusDecoder.RATE + rampNs
        else detectedAtNs + latencyFrames * 1_000_000_000L / DownlinkOpusDecoder.RATE + rampNs
        report = mapOf(
          "action" to "STOP",
          "callTurnIndex" to turn,
          "onsetCaptureMs" to onsetCaptureMs,
          "detectCaptureMs" to detectCaptureMs,
          "detectedAtNs" to detectedAtNs,
          "fadeAppliedAtNs" to fadeAppliedAtNs,
          "headFrame" to head,
          "presentedFrame" to presented,
          "stampFrame" to if (hasStamp) stamp.framePosition else null,
          "stampNs" to if (hasStamp) stamp.nanoTime else null,
          "rampMs" to RAMP_MS,
          "stopAtNs" to stopAtNs,
          "stopLatencyMs" to (stopAtNs - detectedAtNs) / 1e6,
          "stopSource" to if (hasStamp) "TIMESTAMP" else "LATENCY_ESTIMATE",
          "finalChunkSeq" to final?.chunkSeq,
          "finalPlayedMs" to final?.playedMs,
          "forced" to forced,
        )
        if (options.trace) dueTraces.add(DueTrace(detectCaptureMs + TRACE_AFTER_MS, detectedAtNs, report))
      }
    }
    sink.bargeIn(report)
    return true
  }

  private fun emitDueTraces(captureMs: Long) {
    val ready = ArrayList<Pair<DueTrace, List<FrameTrace>>>()
    synchronized(lock) {
      val iterator = dueTraces.iterator()
      while (iterator.hasNext()) {
        val due = iterator.next()
        if (captureMs < due.dueCaptureMs) continue
        iterator.remove()
        ready.add(due to traceRing.toList())
      }
    }
    for ((due, frames) in ready) {
      val window = frames.filter { it.captureTimeNs < 0 || (it.captureTimeNs >= due.detectedAtNs - TRACE_BEFORE_NS && it.captureTimeNs <= due.detectedAtNs + TRACE_AFTER_MS * 1_000_000L) }
      sink.trace(
        due.base + mapOf(
          "frames" to window.map { listOf(it.captureMs, it.captureTimeNs, it.levelDb, it.refDb, if (it.audible) 1 else 0) },
        ),
      )
    }
  }

  // ------------------------------------------------------------------ playback

  private fun playbackLoop() {
    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
    val output = track ?: return
    val decoder = DownlinkOpusDecoder()
    val pcm = ShortArray(DownlinkOpusDecoder.MAX_FRAME_SAMPLES)
    val silence = ShortArray(DownlinkOpusDecoder.FRAME_SAMPLES)
    val stamp = AudioTimestamp()
    var lastCheck = 0L
    while (running.get()) {
      val next: Pending?
      synchronized(lock) {
        if (restorePending) {
          // Every frame of the cut reply is at or below what has been written now.
          restoreAtFrame = framesWritten
          restorePending = false
        }
        if (restoreAtFrame >= 0 && (output.playbackHeadPosition.toLong() and 0xffffffffL) >= restoreAtFrame) {
          restoreAtFrame = -1
          faded = false
          applyVolume()
        }
        next = pending.removeFirstOrNull()?.takeIf { ledger.stillPlayable(it.callTurnIndex) }
      }
      if (next != null) {
        val samples = try {
          decoder.decode(next.packet, pcm)
        } catch (_: Throwable) {
          decodeErrors += 1
          -1
        }
        if (samples > 0) {
          val level = SpeechOnsetDetector.levelDb(pcm, samples)
          val start: Long
          synchronized(lock) { start = framesWritten }
          if (!writeFully(output, pcm, samples)) break
          synchronized(lock) {
            framesWritten += samples
            if (ledger.booked(next.callTurnIndex, next.chunkSeq, next.offsetMs, start, samples.toLong())) {
              recentWrites.addLast(Written(System.nanoTime(), level))
              while (recentWrites.size > 64) recentWrites.removeFirst()
              drainTurn = next.callTurnIndex
              drainChunk = next.chunkSeq
            }
          }
        }
      } else {
        if (!writeFully(output, silence, silence.size)) break
        synchronized(lock) { framesWritten += silence.size }
        silenceFrames += silence.size
      }
      val now = System.nanoTime()
      if (now - lastCheck >= PLAYOUT_CHECK_NS) {
        lastCheck = now
        reportPlayout(output, stamp)
      }
    }
  }

  private fun reportPlayout(output: AudioTrack, stamp: AudioTimestamp) {
    val hasStamp = output.getTimestamp(stamp)
    if (!hasStamp) timestampMisses += 1
    val head = output.playbackHeadPosition.toLong() and 0xffffffffL
    val presented = if (hasStamp) stamp.framePosition else maxOf(0L, head - trackBufferFrames - FALLBACK_HAL_LATENCY_FRAMES)
    var mark: ReplyLedger.Mark?
    var drained: Pair<Long, Long>? = null
    synchronized(lock) {
      mark = ledger.advance(presented)
      if (drainTurn >= 0 && !ledger.hasUnheard() && pending.none { it.callTurnIndex == drainTurn }) {
        drained = drainTurn to drainChunk
        drainTurn = -1
      }
    }
    mark?.let {
      playoutMarks += 1
      sink.playout(it, presented, if (hasStamp) "TIMESTAMP" else "HEAD_MINUS_LATENCY")
    }
    drained?.let { sink.replyDrained(it.first, it.second) }
  }

  private fun writeFully(output: AudioTrack, data: ShortArray, count: Int): Boolean {
    var offset = 0
    while (offset < count && running.get()) {
      val n = output.write(data, offset, count - offset, AudioTrack.WRITE_BLOCKING)
      if (n < 0) {
        sink.fault("PLAYBACK_LOST")
        Thread { stop("PLAYBACK_LOST") }.start()
        return false
      }
      offset += n
    }
    return running.get()
  }

  /** Under [lock]: the track is silent while a barge-in fade holds or another app took transient focus. */
  private fun applyVolume() {
    val output = track ?: return
    val silent = faded || focusFaded
    val ramp = shaper
    try {
      if (ramp != null) ramp.apply(if (silent) VolumeShaper.Operation.PLAY else VolumeShaper.Operation.REVERSE)
      else output.setVolume(if (silent) 0f else 1f)
    } catch (_: Throwable) {
      output.setVolume(if (silent) 0f else 1f)
    }
  }

  private fun playbackAttributes(): AudioAttributes = AudioAttributes.Builder()
    .setUsage(if (options.capture.rawMedia) AudioAttributes.USAGE_MEDIA else AudioAttributes.USAGE_VOICE_COMMUNICATION)
    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
    .build()

  private fun routeDevice(): String? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) audioManager.communicationDevice?.let { deviceName(it.type) } else null

  private fun deviceName(type: Int): String = when (type) {
    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "EARPIECE"
    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "SPEAKER"
    AudioDeviceInfo.TYPE_BUILTIN_MIC -> "BUILTIN_MIC"
    AudioDeviceInfo.TYPE_WIRED_HEADSET -> "WIRED_HEADSET"
    AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "WIRED_HEADPHONES"
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "BLUETOOTH_SCO"
    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "BLUETOOTH_A2DP"
    AudioDeviceInfo.TYPE_USB_HEADSET -> "USB_HEADSET"
    AudioDeviceInfo.TYPE_USB_DEVICE -> "USB_DEVICE"
    else -> "TYPE_$type"
  }

  companion object {
    const val RAMP_MS = 8L
    const val MAX_PENDING_PACKETS = 1500
    private const val ECHO_WINDOW_NS = 400_000_000L
    private const val PLAYOUT_CHECK_NS = 40_000_000L
    /** A pessimistic hardware latency (60 ms at 24 kHz) for the rare moment no timestamp exists. */
    private const val FALLBACK_HAL_LATENCY_FRAMES = 1440L
    private const val TRACE_FRAMES = 200
    private const val TRACE_AFTER_MS = 600L
    private const val TRACE_BEFORE_NS = 700_000_000L
  }
}
