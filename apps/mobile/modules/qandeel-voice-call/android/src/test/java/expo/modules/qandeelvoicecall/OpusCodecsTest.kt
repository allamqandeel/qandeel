package expo.modules.qandeelvoicecall

import io.github.jaredmdobson.concentus.OpusApplication
import io.github.jaredmdobson.concentus.OpusDecoder
import io.github.jaredmdobson.concentus.OpusEncoder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * S8B-06 CP1 — the uplink packets are real Opus in the frozen shape: mono, one 20 ms frame (the server's TOC rule), in-band
 * FEC present (the SILK LBRR flag, read with libopus's own range decoder steps), no DTX (silence still yields full packets),
 * and decodable. The downlink decoder takes 24 kHz 20 ms packets.
 */
class OpusCodecsTest {
  /** The same synthetic voiced signal the server's tests use (harmonics, moving pitch, syllable envelope): never speech. */
  private fun synth(rate: Int, frame: Int, samples: Int): ShortArray = ShortArray(samples) { i ->
    val t = (frame * samples + i).toDouble() / rate
    val pitch = 120 + 30 * sin(2 * PI * 0.7 * t + 1)
    val envelope = 0.5 + 0.5 * sin(2 * PI * 3 * t)
    var v = 0.0
    for (h in 1..6) v += sin(2 * PI * pitch * h * t) / h
    (5000 * envelope * v).roundToInt().toShort()
  }

  /** RFC 6716 §3.1: mono and exactly 20 ms. */
  private fun mono20ms(packet: ByteArray): Boolean {
    val toc = packet[0].toInt() and 0xff
    if (toc and 0x04 != 0) return false
    val config = toc shr 3
    val code = toc and 0x03
    val frames = when (code) { 0 -> 1; 1, 2 -> 2; else -> packet[1].toInt() and 0x3f }
    val tenths = if (config < 12) intArrayOf(100, 200, 400, 600)[config % 4] else if (config < 16) intArrayOf(100, 200)[config % 2] else intArrayOf(25, 50, 100, 200)[config % 4]
    return frames * tenths == 200
  }

  /** libopus celt/entdec.c `ec_dec_init` + `ec_dec_bit_logp`, enough to read the first SILK flags (VAD, then LBRR). */
  private class RangeDecoder(private val buf: ByteArray, private var offs: Int) {
    private var rng = 128L
    private var value: Long
    private var rem: Int

    init {
      rem = readByte()
      value = rng - 1 - (rem shr 1)
      normalize()
    }

    private fun readByte(): Int = if (offs < buf.size) buf[offs++].toInt() and 0xff else 0

    private fun normalize() {
      while (rng <= (1L shl 23)) {
        rng = (rng shl 8) and 0xffffffffL
        var sym = rem
        rem = readByte()
        sym = ((sym shl 8) or rem) shr 1
        value = ((value shl 8) + (0xff and sym.inv())) and ((1L shl 31) - 1)
      }
    }

    fun bit(logp: Int): Boolean {
      val s = rng shr logp
      val ret = value < s
      if (!ret) value -= s
      rng = if (ret) s else rng - s
      normalize()
      return ret
    }
  }

  private fun lbrr(packet: ByteArray): Boolean? {
    val config = (packet[0].toInt() and 0xff) shr 3
    if (config >= 16 || (packet[0].toInt() and 0x03) != 0) return null // CELT-only, or not one frame
    val dec = RangeDecoder(packet, 1)
    dec.bit(1) // VAD flag of the one 20 ms SILK frame
    return dec.bit(1) // LBRR flag
  }

  @Test
  fun uplinkPacketsAreMono20msWithFecAndDecodable() {
    val encoder = UplinkOpusEncoder()
    val decoder = OpusDecoder(16_000, 1)
    val out = ShortArray(320 * 6)
    var withFec = 0
    for (f in 0 until 150) {
      val packet = encoder.encode(synth(16_000, f, 320))
      assertTrue("mono 20 ms", mono20ms(packet))
      assertTrue("no DTX frame", packet.size > 3)
      assertEquals("one 20 ms frame decodes to 320 samples", 320, decoder.decode(packet, 0, packet.size, out, 0, out.size, false))
      if (f > 0 && lbrr(packet) == true) withFec += 1
    }
    assertTrue("in-band FEC is present in most packets ($withFec/149)", withFec >= 120)
  }

  @Test
  fun silenceStillYieldsFullPacketsBecauseDtxIsOff() {
    val encoder = UplinkOpusEncoder()
    val silence = ShortArray(320)
    repeat(100) {
      val packet = encoder.encode(silence)
      assertTrue(mono20ms(packet))
      assertTrue("a DTX encoder would send 1–2 byte packets here", packet.size > 2)
    }
  }

  /**
   * The server's own bitstream: libopus switches 24 kHz speech to HYBRID packets after a pause, and Concentus decodes those
   * to silence below 48 kHz. Every packet of the fixture must decode to libopus's own level (± 3 dB where it is audible).
   */
  @Test
  fun downlinkDecodesLibopusHybridAndSilkPacketsAtTheirLevel() {
    val lines = javaClass.classLoader!!.getResourceAsStream("s806-libopus-downlink-hybrid.txt")!!.bufferedReader().readLines().filter { !it.startsWith("#") }
    val packets = lines.filter { !it.startsWith("levels ") }.map { hex -> ByteArray(hex.length / 2) { hex.substring(2 * it, 2 * it + 2).toInt(16).toByte() } }
    val expected = lines.single { it.startsWith("levels ") }.removePrefix("levels ").split(',').map { it.toDouble() }
    assertEquals(packets.size, expected.size)
    assertTrue("the fixture carries hybrid packets", packets.count { (it[0].toInt() and 0xff) shr 3 in 12..15 } >= 30)
    val decoder = DownlinkOpusDecoder()
    val pcm = ShortArray(DownlinkOpusDecoder.MAX_FRAME_SAMPLES)
    var audibleHybrid = 0
    packets.forEachIndexed { i, packet ->
      val n = decoder.decode(packet, pcm)
      assertEquals("20 ms at 24 kHz", DownlinkOpusDecoder.FRAME_SAMPLES, n)
      var energy = 0.0
      for (k in 0 until n) energy += pcm[k].toDouble() * pcm[k]
      val db = 10 * log10(energy / n / 32768.0 / 32768.0 + 1e-12)
      val config = (packet[0].toInt() and 0xff) shr 3
      if (expected[i] > -40) {
        assertTrue("packet $i (config $config): $db dBFS against libopus ${expected[i]}", abs(db - expected[i]) <= 3.0)
        if (config in 12..15) audibleHybrid += 1
      } else {
        assertTrue("packet $i is quiet in libopus and here ($db)", db < -40)
      }
    }
    assertTrue("audible hybrid packets were checked ($audibleHybrid)", audibleHybrid >= 8)
  }

  @Test
  fun downlinkDecodes24kHz20msPackets() {
    val encoder = OpusEncoder(24_000, 1, OpusApplication.OPUS_APPLICATION_VOIP).apply { bitrate = 32_000 }
    val decoder = DownlinkOpusDecoder()
    val pcm = ShortArray(DownlinkOpusDecoder.MAX_FRAME_SAMPLES)
    val packet = ByteArray(1275)
    for (f in 0 until 20) {
      val n = encoder.encode(synth(24_000, f, 480), 0, 480, packet, 0, packet.size)
      assertEquals(480, decoder.decode(packet.copyOf(n), pcm))
    }
  }
}
