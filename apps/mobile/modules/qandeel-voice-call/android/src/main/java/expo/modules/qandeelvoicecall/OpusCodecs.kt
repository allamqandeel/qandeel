package expo.modules.qandeelvoicecall

import io.github.jaredmdobson.concentus.OpusApplication
import io.github.jaredmdobson.concentus.OpusDecoder
import io.github.jaredmdobson.concentus.OpusEncoder
import io.github.jaredmdobson.concentus.OpusSignal
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * S8B-06 CP1 — the phone's Opus, both directions, with the frozen v1 frame format (D-C1):
 *
 *   uplink   PCM s16 mono 16 kHz → Opus, one 20 ms packet per frame, ~24 kbps, FEC on (with a 10 % expected loss, without
 *            which libopus writes no in-band redundancy), DTX off — exactly the server codec's own settings
 *            (`apps/api/src/voice/call/codec/opus-codec.ts`);
 *   downlink Opus mono 24 kHz 20 ms → PCM s16 at 24 kHz (decoded at 48 kHz and halved: see [DownlinkOpusDecoder]).
 *
 * The codec is Concentus 1.0.2 (`io.github.jaredmdobson:concentus`), a pure-Java port of the reference libopus under the
 * Opus BSD licence: no NDK, no prebuilt binary, the same bitstream. Android's own `MediaCodec` Opus encoder was not used
 * because it fixes in-band FEC off, which the frozen uplink rule forbids. Every packet it writes is checked against real
 * libopus on the other end (the fake gateway decodes it with opusscript, the server's own codec).
 */
class UplinkOpusEncoder {
  private val encoder = OpusEncoder(RATE, 1, OpusApplication.OPUS_APPLICATION_VOIP).apply {
    bitrate = BITRATE
    useInbandFEC = true
    packetLossPercent = 10
    useDTX = false
    signalType = OpusSignal.OPUS_SIGNAL_VOICE
    complexity = COMPLEXITY
  }
  private val out = ByteArray(MAX_PACKET)

  /** One 20 ms frame ([FRAME_SAMPLES] samples) → one Opus packet. */
  fun encode(pcm: ShortArray): ByteArray {
    require(pcm.size >= FRAME_SAMPLES) { "frame" }
    val length = encoder.encode(pcm, 0, FRAME_SAMPLES, out, 0, MAX_PACKET)
    return out.copyOf(length)
  }

  fun reset() = encoder.resetState()

  companion object {
    const val RATE = 16_000
    const val FRAME_SAMPLES = 320
    const val BITRATE = 24_000
    const val COMPLEXITY = 5
    const val MAX_PACKET = 1275
  }
}

/**
 * The downlink decodes at 48 kHz and halves to [RATE]: Concentus 1.0.2 decodes HYBRID packets (SILK + CELT, configs
 * 12–15 — what libopus chooses for 24 kHz speech after a pause) to silence at any output rate below 48 kHz, while SILK-only
 * packets decode correctly, so a reply could play as silence part-way through (found on the device proof, reproduced on
 * the host against real libopus packets: `OpusCodecsTest`). At 48 kHz every mode decodes. The halving is a 47-tap
 * Blackman-windowed half-band low-pass at 12 kHz whose history runs across packets (no edge at each 20 ms): 0.5 ms of
 * delay, nothing above 12 kHz folded back.
 */
class DownlinkOpusDecoder {
  private val decoder = OpusDecoder(DECODE_RATE, 1)
  private val wide = ShortArray(MAX_FRAME_SAMPLES * 2)
  /** The last [TAPS] − 1 wide samples of the previous packet, then the current packet's (float, for the filter). */
  private val line = FloatArray(TAPS - 1 + MAX_FRAME_SAMPLES * 2)

  /** One packet → its PCM at [RATE] (at most [MAX_FRAME_SAMPLES] samples); throws on a packet libopus would reject. */
  fun decode(packet: ByteArray, into: ShortArray): Int {
    val n = decoder.decode(packet, 0, packet.size, wide, 0, wide.size, false)
    val keep = TAPS - 1
    for (i in 0 until n) line[keep + i] = wide[i].toFloat()
    val out = n / 2
    for (k in 0 until out) {
      // Output k sits on wide sample 2k + 1 of this packet (an even number of wide samples per packet keeps the phase).
      val end = keep + 2 * k + 1
      var acc = 0f
      for (j in 0 until TAPS) acc += HALF_BAND[j] * line[end - j]
      into[k] = acc.roundToInt().coerceIn(-32768, 32767).toShort()
    }
    System.arraycopy(line, n, line, 0, keep)
    return out
  }

  companion object {
    const val RATE = 24_000
    const val FRAME_SAMPLES = 480
    /** 120 ms at 24 kHz, the longest packet Opus allows. */
    const val MAX_FRAME_SAMPLES = 2880
    private const val DECODE_RATE = 48_000
    private const val TAPS = 47

    /** Windowed sinc, cut-off a quarter of 48 kHz, unity gain at DC. */
    private val HALF_BAND: FloatArray = run {
      val m = (TAPS - 1) / 2.0
      val h = DoubleArray(TAPS) { n ->
        val x = n - m
        val sinc = if (x == 0.0) 0.5 else sin(PI * 0.5 * x) / (PI * x)
        val w = 0.42 - 0.5 * cos(2 * PI * n / (TAPS - 1)) + 0.08 * cos(4 * PI * n / (TAPS - 1))
        sinc * w
      }
      val sum = h.sum()
      FloatArray(TAPS) { (h[it] / sum).toFloat() }
    }
  }
}
