#if os(iOS)
import AVFoundation
import os

/// S8B-06 CP2 (iOS) — the platform I/O of the call engine: `AVAudioEngine` with Apple's voice-processing I/O unit
/// (`inputNode.setVoiceProcessingEnabled(true)`: echo cancellation against the engine's own output, noise suppression,
/// AGC), feeding `CallEngineCore`, which makes every decision.
///
///   capture  an `AVAudioSinkNode` on the voice-processed input receives each I/O cycle (≈ 10–20 ms; `installTap` would
///            batch ≈ 100 ms, too slow for a 200 ms barge-in). The real-time block only copies samples into a preallocated
///            ring and signals the capture thread, which converts to 16 kHz mono (`AVAudioConverter`, state kept across
///            calls) and hands every 320-sample frame to the core in order.
///   render   an `AVAudioSourceNode` (24 kHz mono) reads a preallocated ring the producer thread keeps ≈ 40 ms ahead with the
///            core's chunks; every sample carries the cut generation it was made in, and a sample of an older generation
///            than the core's current one (a barge-in or a hold cut it) is faded out over 8 ms — the rest plays on.
///   presented each render call records (first frame, host time); a 20 ms timer turns the latest record into the PRESENTED
///            frame (host time + output latency + I/O buffer, conservative) and hands it to the core, and ticks the core's
///            clock (the warning cue's local trigger keeps running with the screen locked: the `audio` background mode).
///
/// It never activates, deactivates or configures the audio session when CallKit owns the call (`ownsSession == false`):
/// CallKit activates it (`didActivate`) and the audio starts only after that. It logs nothing and stores nothing.
final class VoiceProcessingAudioIO {
  enum IOError: Error { case noInput, format, start(String) }

  private let engine = AVAudioEngine()
  private let core: CallEngineCore
  private let outputFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: Double(DownlinkOpusDecoder.rate), channels: 1, interleaved: false)!
  private let captureFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: Double(UplinkOpusEncoder.rate), channels: 1, interleaved: false)!
  private var sourceNode: AVAudioSourceNode?
  private var sinkNode: AVAudioSinkNode?
  private var inputFormat: AVAudioFormat?
  private var converter: AVAudioConverter?
  private var configurationObserver: NSObjectProtocol?
  var onFault: ((String) -> Void)?
  var onConfigurationChange: (() -> Void)?

  // The capture ring (real-time writer, capture thread reader).
  private let captureLock = OSAllocatedUnfairLock()
  private var captureRing = [Float](repeating: 0, count: 96_000)
  private var captureWrite = 0
  private var captureRead = 0
  private let captureSignal = DispatchSemaphore(value: 0)
  private var captureThread: Thread?
  private var pending16k: [Int16] = []

  // The output ring (producer writer, real-time reader); positions are absolute output frames.
  private let outputLock = OSAllocatedUnfairLock()
  private static let outputCapacity = 24_000
  private var outputRing = [Float](repeating: 0, count: VoiceProcessingAudioIO.outputCapacity)
  private var outputGeneration = [Int32](repeating: 0, count: VoiceProcessingAudioIO.outputCapacity)
  private var outputWritten: Int64 = 0
  private var outputRead: Int64 = 0
  private var gain: Float = 1
  private var producerThread: Thread?
  private let producerSignal = DispatchSemaphore(value: 0)
  private static let leadFrames: Int64 = 960

  // Render records for the presented position.
  private var stampFrame: Int64 = -1
  private var stampHostNs: UInt64 = 0
  private var stampFrames: Int64 = 0
  private var latencyNs: UInt64 = 0

  private var timer: DispatchSourceTimer?
  private let timerQueue = DispatchQueue(label: "qandeel.call.engine-clock", qos: .userInteractive)
  private var alive = false
  private var paused = false

  private static let timebase: mach_timebase_info_data_t = {
    var info = mach_timebase_info_data_t()
    mach_timebase_info(&info)
    return info
  }()

  static func hostToNs(_ host: UInt64) -> UInt64 {
    host * UInt64(timebase.numer) / UInt64(timebase.denom)
  }

  static func nowNs() -> UInt64 { hostToNs(mach_absolute_time()) }

  init(core: CallEngineCore) {
    self.core = core
    core.presentedNow = { [weak self] in self?.presented() ?? (0, "NONE") }
  }

  /// Builds the graph and starts it. The session must already be active (CallKit's `didActivate`, or the engine's own).
  func start() throws {
    let input = engine.inputNode
    do {
      try input.setVoiceProcessingEnabled(true)
    } catch {
      throw IOError.start("VOICE_PROCESSING_UNAVAILABLE")
    }
    input.isVoiceProcessingBypassed = false
    input.isVoiceProcessingAGCEnabled = true
    if #available(iOS 17.0, *) {
      // QANDEEL's call should not push other audio down further than the system's minimum.
      input.voiceProcessingOtherAudioDuckingConfiguration = AVAudioVoiceProcessingOtherAudioDuckingConfiguration(enableAdvancedDucking: false, duckingLevel: .min)
    }
    try connectGraph()
    latencyNs = UInt64((AVAudioSession.sharedInstance().outputLatency + AVAudioSession.sharedInstance().ioBufferDuration) * 1e9)
    engine.prepare()
    do {
      try engine.start()
    } catch {
      throw IOError.start("ENGINE_START_FAILED")
    }
    alive = true
    startThreads()
    configurationObserver = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil) { [weak self] _ in
      self?.recoverAfterConfigurationChange()
    }
  }

  private func connectGraph() throws {
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else { throw IOError.noInput }
    guard let mono = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: format.sampleRate, channels: 1, interleaved: false),
          let conv = AVAudioConverter(from: mono, to: captureFormat) else { throw IOError.format }
    inputFormat = mono
    converter = conv

    if let old = sinkNode { engine.detach(old) }
    let sink = AVAudioSinkNode { [weak self] _, frameCount, bufferList -> OSStatus in
      self?.receive(bufferList, Int(frameCount))
      return noErr
    }
    engine.attach(sink)
    engine.connect(input, to: sink, format: format)
    sinkNode = sink

    if sourceNode == nil {
      let source = AVAudioSourceNode(format: outputFormat) { [weak self] _, timestamp, frameCount, bufferList -> OSStatus in
        guard let self else { return noErr }
        self.render(timestamp, Int(frameCount), bufferList)
        return noErr
      }
      engine.attach(source)
      engine.connect(source, to: engine.mainMixerNode, format: outputFormat)
      sourceNode = source
    }
  }

  /// A route change (Bluetooth, a headset, the speaker) or a media-services change stopped the engine: rebuild the input
  /// side for the new hardware format and start again. Nothing is reset in the core: the capture clock goes on.
  private func recoverAfterConfigurationChange() {
    guard alive, !paused else { return }
    do {
      try connectGraph()
      latencyNs = UInt64((AVAudioSession.sharedInstance().outputLatency + AVAudioSession.sharedInstance().ioBufferDuration) * 1e9)
      engine.prepare()
      try engine.start()
      onConfigurationChange?()
    } catch {
      onFault?("ROUTE_RECOVERY_FAILED")
    }
  }

  /// A hold: the I/O stops (the microphone is released); `resume` starts it again.
  func pause() {
    guard alive, !paused else { return }
    paused = true
    engine.pause()
  }

  func resume() throws {
    guard alive, paused else { return }
    try connectGraph()
    engine.prepare()
    do { try engine.start() } catch { throw IOError.start("RESUME_FAILED") }
    paused = false
  }

  func stop() {
    guard alive else { return }
    alive = false
    if let o = configurationObserver { NotificationCenter.default.removeObserver(o) }
    configurationObserver = nil
    timer?.cancel()
    timer = nil
    engine.stop()
    if let s = sinkNode { engine.detach(s) }
    if let s = sourceNode { engine.detach(s) }
    sinkNode = nil
    sourceNode = nil
    try? engine.inputNode.setVoiceProcessingEnabled(false)
    captureSignal.signal()
    producerSignal.signal()
  }

  // ------------------------------------------------------------------ capture

  private func receive(_ list: UnsafePointer<AudioBufferList>, _ frames: Int) {
    let buffers = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: list))
    guard let first = buffers.first, let data = first.mData else { return }
    let channels = max(1, Int(first.mNumberChannels))
    let samples = data.assumingMemoryBound(to: Float.self)
    captureLock.lock()
    let capacity = captureRing.count
    for i in 0..<frames {
      captureRing[captureWrite % capacity] = samples[i * channels]
      captureWrite += 1
    }
    if captureWrite - captureRead > capacity { captureRead = captureWrite - capacity }
    captureLock.unlock()
    captureSignal.signal()
  }

  private func captureLoop() {
    while alive {
      _ = captureSignal.wait(timeout: .now() + .milliseconds(100))
      guard alive else { return }
      captureLock.lock()
      let available = captureWrite - captureRead
      var chunk = [Float](repeating: 0, count: available)
      let capacity = captureRing.count
      for i in 0..<available { chunk[i] = captureRing[(captureRead + i) % capacity] }
      captureRead = captureWrite
      captureLock.unlock()
      if available == 0 || paused { continue }
      convertAndFeed(chunk)
    }
  }

  private func convertAndFeed(_ chunk: [Float]) {
    guard let format = inputFormat, let conv = converter,
          let inBuffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(chunk.count)) else { return }
    inBuffer.frameLength = AVAudioFrameCount(chunk.count)
    chunk.withUnsafeBufferPointer { src in inBuffer.floatChannelData![0].update(from: src.baseAddress!, count: chunk.count) }
    let outCapacity = AVAudioFrameCount(Double(chunk.count) * captureFormat.sampleRate / format.sampleRate) + 64
    guard let outBuffer = AVAudioPCMBuffer(pcmFormat: captureFormat, frameCapacity: outCapacity) else { return }
    var fed = false
    var error: NSError?
    _ = conv.convert(to: outBuffer, error: &error) { _, status in
      if fed {
        status.pointee = .noDataNow
        return nil
      }
      fed = true
      status.pointee = .haveData
      return inBuffer
    }
    if error != nil { return }
    let n = Int(outBuffer.frameLength)
    if n > 0, let data = outBuffer.int16ChannelData?[0] {
      pending16k.append(contentsOf: UnsafeBufferPointer(start: data, count: n))
    }
    let frame = UplinkOpusEncoder.frameSamples
    while pending16k.count >= frame {
      let f = Array(pending16k[0..<frame])
      pending16k.removeFirst(frame)
      core.captureFrame(f, nowNs: VoiceProcessingAudioIO.nowNs())
    }
  }

  // ------------------------------------------------------------------ render

  private func render(_ timestamp: UnsafePointer<AudioTimeStamp>, _ frames: Int, _ list: UnsafeMutablePointer<AudioBufferList>) {
    let buffers = UnsafeMutableAudioBufferListPointer(list)
    guard let out = buffers.first?.mData?.assumingMemoryBound(to: Float.self) else { return }
    let current = Int32(truncatingIfNeeded: core.renderGeneration)
    let held = core.renderHeld
    let step: Float = 1.0 / (Float(DownlinkOpusDecoder.rate) * Float(CallEngineCore.rampMs) / 1000)
    outputLock.lock()
    let start = outputRead
    for i in 0..<frames {
      var sample: Float = 0
      var target: Float = held ? 0 : 1
      if outputRead < outputWritten {
        let slot = Int(outputRead % Int64(VoiceProcessingAudioIO.outputCapacity))
        sample = outputRing[slot]
        if outputGeneration[slot] < current { target = 0 }
        // Only frames taken from the ring advance the position: the core's frames and these stay one count, so an
        // underrun can never make a reply count as heard before it played.
        outputRead += 1
      }
      if gain < target { gain = min(target, gain + step) } else if gain > target { gain = max(target, gain - step) }
      out[i] = sample * gain
    }
    stampFrame = start
    stampFrames = outputRead - start
    stampHostNs = VoiceProcessingAudioIO.hostToNs(timestamp.pointee.mHostTime)
    outputLock.unlock()
    producerSignal.signal()
  }

  private func producerLoop() {
    while alive {
      _ = producerSignal.wait(timeout: .now() + .milliseconds(10))
      guard alive else { return }
      while true {
        outputLock.lock()
        let lead = outputWritten - outputRead
        outputLock.unlock()
        if lead >= VoiceProcessingAudioIO.leadFrames { break }
        let chunk = core.nextChunk(nowNs: VoiceProcessingAudioIO.nowNs())
        outputLock.lock()
        for s in chunk.samples {
          let slot = Int(outputWritten % Int64(VoiceProcessingAudioIO.outputCapacity))
          outputRing[slot] = Float(s) / 32768.0
          outputGeneration[slot] = Int32(truncatingIfNeeded: chunk.generation)
          outputWritten += 1
        }
        outputLock.unlock()
      }
    }
  }

  /// The PRESENTED output frame now: the latest render record's first frame, plus what its host time and the output
  /// latency say has reached the ear — never past what was rendered.
  private func presented() -> (frame: Int64, source: String) {
    outputLock.lock()
    let frame = stampFrame, host = stampHostNs, count = stampFrames
    outputLock.unlock()
    if frame < 0 { return (0, "TIMESTAMP") }
    let now = VoiceProcessingAudioIO.nowNs()
    let at = host + latencyNs
    if now <= at { return (max(0, frame), "TIMESTAMP") }
    let elapsed = Int64(Double(now - at) * Double(DownlinkOpusDecoder.rate) / 1e9)
    return (frame + min(count, elapsed), "TIMESTAMP")
  }

  private func startThreads() {
    let capture = Thread { [weak self] in self?.captureLoop() }
    capture.qualityOfService = .userInteractive
    capture.name = "qandeel-call-capture"
    capture.start()
    captureThread = capture
    let producer = Thread { [weak self] in self?.producerLoop() }
    producer.qualityOfService = .userInteractive
    producer.name = "qandeel-call-producer"
    producer.start()
    producerThread = producer
    let t = DispatchSource.makeTimerSource(queue: timerQueue)
    t.schedule(deadline: .now() + .milliseconds(20), repeating: .milliseconds(20))
    t.setEventHandler { [weak self] in
      guard let self, self.alive else { return }
      let p = self.presented()
      self.core.presented(p.frame, source: p.source)
      self.core.tick(nowNs: VoiceProcessingAudioIO.nowNs())
    }
    t.resume()
    timer = t
  }
}
#endif
