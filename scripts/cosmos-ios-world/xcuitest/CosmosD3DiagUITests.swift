// COSMOS-INT-01 Slice E, D-3 CP1 — DIAGNOSTIC ONLY (branch cosmos/slice-e-d3-diag; never merged; PO approval 2026-11-18).
//
// One shared diagnostic build answers three questions. Nothing here asserts a product verdict: every test records
// evidence (notes, screenshots, the app's diagnostic board) for the CP1 root-cause report.
//   SE-FU-1  Where is a cold-launch tap on the Analysis door lost? Four timings, one tap each, never retried:
//              A  the first moment the door is VISIBLY drawn (screenshot), tapped at once through the event synthesiser;
//              B  the first moment XCUITest reports the door hittable, tapped at once the same way;
//              C  XCUIElement.tap() right after the thread appears (the original R4 sequence of run 44305519293);
//              D  XCUIElement.tap() 8 s after the thread appears (the D-1 settle; control).
//            The board (the app's own counters) says how far the touch got: native touch at the root (L0), press in
//            (L1), press completed (L2), the handler and the depth crossing (L3), the depth commit (L4), the stage
//            ready (L5). Times are epoch ms on the shared simulator / runner clock.
//   SE-FU-2  Which view does a touch on each non-interactive overlay reach, and does the stage's gesture see it?
//            One drag starting inside each overlay (and an open-stage control), with the board's counters and the camera
//            before and after; positive controls for the functional ones.
//   Layout   Frames of the chrome and the stage on each World, for the enlarged-text matrix (run with D3_TAG set).
import XCTest
import UIKit

final class CosmosD3DiagUITests: XCTestCase {
  private let app = XCUIApplication()
  private let personalStage = "qandeel-cosmos-world:semantic-step"
  private let doorId = "qandeel-depth-to-analysis"

  override func setUp() {
    super.setUp()
    continueAfterFailure = true
  }

  // ── helpers ────────────────────────────────────────────────────────────────────────────────────────────────────
  private func now() -> Int64 { Int64((Date().timeIntervalSince1970 * 1000).rounded()) }
  private func element(_ id: String) -> XCUIElement { app.descendants(matching: .any)[id] }
  private func soft(_ id: String, _ seconds: TimeInterval) -> XCUIElement? {
    let e = element(id)
    return e.waitForExistence(timeout: seconds) ? e : nil
  }
  private func settle(_ seconds: Double) { Thread.sleep(forTimeInterval: seconds) }
  private func shot(_ name: String) {
    let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    a.name = name
    a.lifetime = .keepAlways
    add(a)
  }
  private func shot(_ name: String, _ s: XCUIScreenshot) {
    let a = XCTAttachment(screenshot: s)
    a.name = name
    a.lifetime = .keepAlways
    add(a)
  }
  private func note(_ name: String, _ text: String) {
    let a = XCTAttachment(string: text)
    a.name = name
    a.lifetime = .keepAlways
    add(a)
  }
  private func board() -> String {
    let b = element("qandeel-diag-trace")
    return b.exists ? b.label : "NO-BOARD"
  }
  private var tag: String { ProcessInfo.processInfo.environment["D3_TAG"] ?? "untagged" }
  /// The device's screen in points. The UI-test runner is a compatibility-scaled app (`UIScreen.main.bounds` is 320 pt
  /// wide on every simulator, COSMOS-FINAL-01 §29.7), so the springboard's frame is read once, before any timing loop.
  private static var deviceScreen: CGRect?
  private var devicePoints: CGRect {
    if let s = Self.deviceScreen { return s }
    let f = XCUIApplication(bundleIdentifier: "com.apple.springboard").frame
    let s = f.width > 0 ? f : UIScreen.main.bounds
    Self.deviceScreen = s
    return s
  }
  private var screenW: CGFloat { devicePoints.width }
  private var screenH: CGFloat { devicePoints.height }

  /// A rectangle recorded on the board as `lay.<key>=x,y,w,h`.
  private func lay(_ b: String, _ key: String) -> CGRect? {
    guard let r = b.range(of: "lay.\(key)=") else { return nil }
    let rest = b[r.upperBound...].prefix { $0 != " " }
    let v = rest.split(separator: ",").compactMap { Double($0) }
    return v.count == 4 ? CGRect(x: v[0], y: v[1], width: v[2], height: v[3]) : nil
  }

  private func frames(_ ids: [String]) -> String {
    ids.flatMap { id in
      app.descendants(matching: .any).matching(identifier: id).allElementsBoundByIndex.compactMap { e -> String? in
        guard e.exists else { return nil }
        let f = e.frame
        return "\(id)=\(Int(f.minX)),\(Int(f.minY)),\(Int(f.width)),\(Int(f.height)) enabled=\(e.isEnabled) hittable=\(e.isHittable) label=\(e.label.count)ch"
      }
    }.joined(separator: "\n")
  }
  private func framesPrefix(_ prefix: String, limit: Int = 6) -> String {
    let all = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", prefix)).allElementsBoundByIndex
    return all.prefix(limit).compactMap { e -> String? in
      guard e.exists else { return nil }
      let f = e.frame
      return "\(e.identifier)=\(Int(f.minX)),\(Int(f.minY)),\(Int(f.width)),\(Int(f.height))"
    }.joined(separator: "\n")
  }

  // ── the event synthesiser (as the D-1 pinch: XCPointerEventPath / XCSynthesizedEventRecord, looked up at run time) ──
  /// Each finger is a list of (point, offset in seconds); the first is the touch-down, the last offset is the lift.
  @discardableResult
  private func synthesize(_ name: String, _ fingers: [[(CGPoint, Double)]]) -> (ok: Bool, t0: Int64, t1: Int64, info: String) {
    guard let pathClass = NSClassFromString("XCPointerEventPath") as? NSObject.Type,
          let recordClass = NSClassFromString("XCSynthesizedEventRecord") as? NSObject.Type else {
      return (false, now(), now(), "no XCPointerEventPath / XCSynthesizedEventRecord")
    }
    typealias InitPath = @convention(c) (AnyObject, Selector, CGPoint, Double) -> AnyObject
    typealias MovePath = @convention(c) (AnyObject, Selector, CGPoint, Double) -> Void
    typealias LiftPath = @convention(c) (AnyObject, Selector, Double) -> Void
    typealias InitRecord = @convention(c) (AnyObject, Selector, NSString, Int) -> AnyObject
    typealias AddPath = @convention(c) (AnyObject, Selector, AnyObject) -> Void
    typealias Synthesize = @convention(c) (AnyObject, Selector, AutoreleasingUnsafeMutablePointer<NSError?>?) -> Bool
    typealias SynthesizeAsync = @convention(c) (AnyObject, Selector, AnyObject, @escaping @convention(block) (Bool, NSError?) -> Void) -> Void
    let initPath = NSSelectorFromString("initForTouchAtPoint:offset:")
    let move = NSSelectorFromString("moveToPoint:atOffset:")
    let lift = NSSelectorFromString("liftUpAtOffset:")
    let initRecord = NSSelectorFromString("initWithName:interfaceOrientation:")
    let add = NSSelectorFromString("addPointerEventPath:")
    let synthesize = NSSelectorFromString("synthesizeWithError:")
    let eventSynthesizer = NSSelectorFromString("eventSynthesizer")
    let synthesizeEvent = NSSelectorFromString("synthesizeEvent:completion:")
    let device = XCUIDevice.shared as NSObject
    let synthesiser: AnyObject? = device.responds(to: eventSynthesizer) ? device.perform(eventSynthesizer)?.takeUnretainedValue() : nil
    let canAsync = (synthesiser as? NSObject)?.responds(to: synthesizeEvent) == true
    guard pathClass.instancesRespond(to: initPath), pathClass.instancesRespond(to: move), pathClass.instancesRespond(to: lift),
          recordClass.instancesRespond(to: initRecord), recordClass.instancesRespond(to: add),
          recordClass.instancesRespond(to: synthesize) || canAsync else {
      return (false, now(), now(), "the synthesiser lacks the expected selectors")
    }
    let rawRecord: AnyObject = (recordClass as AnyObject).perform(NSSelectorFromString("alloc")).takeUnretainedValue()
    let record = unsafeBitCast((rawRecord as! NSObject).method(for: initRecord), to: InitRecord.self)(rawRecord, initRecord, name as NSString, 1)
    for finger in fingers {
      guard let first = finger.first, let last = finger.last else { continue }
      let rawPath: AnyObject = (pathClass as AnyObject).perform(NSSelectorFromString("alloc")).takeUnretainedValue()
      let path = unsafeBitCast((rawPath as! NSObject).method(for: initPath), to: InitPath.self)(rawPath, initPath, first.0, first.1)
      let moveImp = unsafeBitCast((path as! NSObject).method(for: move), to: MovePath.self)
      for step in finger.dropFirst().dropLast() { moveImp(path, move, step.0, step.1) }
      if finger.count > 1 { moveImp(path, move, last.0, last.1) }
      unsafeBitCast((path as! NSObject).method(for: lift), to: LiftPath.self)(path, lift, last.1 + 0.02)
      unsafeBitCast((record as! NSObject).method(for: add), to: AddPath.self)(record, add, path)
    }
    var error: NSError?
    var ok = false
    var route = "synthesizeWithError:"
    let t0 = now()
    if (record as! NSObject).responds(to: synthesize) {
      ok = unsafeBitCast((record as! NSObject).method(for: synthesize), to: Synthesize.self)(record, synthesize, &error)
    } else if let synthesiser = synthesiser {
      route = "eventSynthesizer"
      let done = expectation(description: "\(name) synthesised")
      unsafeBitCast((synthesiser as! NSObject).method(for: synthesizeEvent), to: SynthesizeAsync.self)(synthesiser, synthesizeEvent, record) { result, failure in
        ok = result; error = failure; done.fulfill()
      }
      wait(for: [done], timeout: 20)
    }
    return (ok, t0, now(), "\(route)\(error.map { ": \($0.localizedDescription)" } ?? "")")
  }
  private func tapAt(_ name: String, _ p: CGPoint) -> (ok: Bool, t0: Int64, t1: Int64, info: String) {
    synthesize(name, [[(p, 0), (p, 0.06)]])
  }
  private func drag(_ name: String, _ p: CGPoint, _ d: CGVector, duration: Double = 0.5) -> (ok: Bool, t0: Int64, t1: Int64, info: String) {
    var finger: [(CGPoint, Double)] = [(p, 0)]
    for i in 1...10 {
      let t = Double(i) / 10
      finger.append((CGPoint(x: p.x + d.dx * t, y: p.y + d.dy * t), duration * t))
    }
    return synthesize(name, [finger])
  }

  // ── screenshot pixels: is the door drawn? ──────────────────────────────────────────────────────────────────────
  /// Luminance mean and standard deviation (0-255) of a rectangle given in points.
  private func stats(_ s: XCUIScreenshot, _ r: CGRect) -> (mean: Double, std: Double) {
    guard let cg = s.image.cgImage else { return (-1, -1) }
    let k = CGFloat(cg.width) / screenW
    let px = CGRect(x: r.minX * k, y: r.minY * k, width: r.width * k, height: r.height * k).integral
    guard let crop = cg.cropping(to: px) else { return (-1, -1) }
    let w = crop.width, h = crop.height
    var buf = [UInt8](repeating: 0, count: w * h * 4)
    let drawn: Bool = buf.withUnsafeMutableBytes { ptr -> Bool in
      guard let ctx = CGContext(data: ptr.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
      ctx.draw(crop, in: CGRect(x: 0, y: 0, width: w, height: h))
      return true
    }
    guard drawn, w * h > 0 else { return (-1, -1) }
    var sum = 0.0, sq = 0.0
    var i = 0
    while i < buf.count {
      let l = 0.299 * Double(buf[i]) + 0.587 * Double(buf[i + 1]) + 0.114 * Double(buf[i + 2])
      sum += l; sq += l * l
      i += 4
    }
    let n = Double(w * h)
    let m = sum / n
    return (m, max(0, sq / n - m * m).squareRoot())
  }

  // ── SE-FU-1 ────────────────────────────────────────────────────────────────────────────────────────────────────
  /// The door's frame in points before it is in the accessibility tree (iPhone 17, en: failure hierarchy of run
  /// 44305519293). Overridable with D3_DOOR="x,y,w,h".
  private var doorFrame: CGRect {
    let v = (ProcessInfo.processInfo.environment["D3_DOOR"] ?? "284,64,104,44").split(separator: ",").compactMap { Double($0) }
    return v.count == 4 ? CGRect(x: v[0], y: v[1], width: v[2], height: v[3]) : CGRect(x: 284, y: 64, width: 104, height: 44)
  }

  private func earlyTap(_ mode: String) {
    var lines: [String] = []
    var frameLog: [String] = []
    let door = doorFrame
    let centre = CGPoint(x: door.midX, y: door.midY)
    let threadBox = CGRect(x: 0, y: door.maxY + 50, width: screenW, height: 200)
    lines.append("screen=\(Int(screenW))x\(Int(screenH)) runnerScreen=\(Int(UIScreen.main.bounds.width))")
    let tLaunch0 = now()
    app.launch()
    let tLaunch1 = now()
    lines.append("mode=\(mode) tLaunch0=\(tLaunch0) tLaunch1=\(tLaunch1)")
    var tVisible: Int64 = 0, tHittable: Int64 = 0, tExists: Int64 = 0, tThread: Int64 = 0
    var tap: (ok: Bool, t0: Int64, t1: Int64, info: String) = (false, 0, 0, "not tapped")
    var tapKind = "none"
    let deadline = Date().addingTimeInterval(180)
    var previous: XCUIScreenshot?
    switch mode {
    case "A", "B":
      while Date() < deadline {
        let t = now()
        let s = XCUIScreen.main.screenshot()
        let d = stats(s, door)
        let th = stats(s, threadBox)
        var ax = "-"
        if mode == "B" {
          let e = element(doorId)
          let ex = e.exists
          let hit = ex && e.isHittable
          if ex && tExists == 0 { tExists = now() }
          if hit && tHittable == 0 { tHittable = now() }
          ax = "exists=\(ex) hittable=\(hit) q=\(now() - t)ms"
        }
        if d.std > 8 && tVisible == 0 {
          tVisible = t
          shot("sefu1-\(mode)-first-visible", s)
          if let p = previous { shot("sefu1-\(mode)-before-visible", p) }
        }
        frameLog.append("\(t) door=\(Int(d.mean))/\(Int(d.std)) thread=\(Int(th.mean))/\(Int(th.std)) \(ax)")
        if mode == "A" && tVisible != 0 { tapKind = "synth at first visible"; tap = tapAt("sefu1-A", centre); break }
        if mode == "B" && tHittable != 0 { tapKind = "synth at first hittable"; tap = tapAt("sefu1-B", centre); break }
        previous = s
      }
    case "C", "D":
      let thread = element("qandeel-conversation-thread")
      if thread.waitForExistence(timeout: 180) { tThread = now() }
      if mode == "D" { settle(8) }
      let e = element(doorId)
      tExists = e.exists ? now() : 0
      tapKind = mode == "C" ? "XCUIElement.tap right after the thread" : "XCUIElement.tap 8 s after the thread"
      let t0 = now()
      if e.exists { e.tap() }
      tap = (e.exists, t0, now(), "XCUIElement.tap")
    default:
      break
    }
    // Right after the tap: the screen (the pressed state, if any), then the board until the stage is ready (45 s).
    shot("sefu1-\(mode)-after-tap")
    let tAfterShot = now()
    var final = board()
    let until = Date().addingTimeInterval(45)
    var readyAt: Date?
    while Date() < until {
      final = board()
      if final.contains("t.L5.timelineRail.layout") {
        if readyAt == nil { readyAt = Date() }
        if Date().timeIntervalSince(readyAt!) > 2 { break }
      }
      settle(0.5)
    }
    shot("sefu1-\(mode)-end")
    // The door's accessibility state now (after the attempt).
    let e = element(doorId)
    lines.append("tapKind=\(tapKind) tapOk=\(tap.ok) tTap0=\(tap.t0) tTap1=\(tap.t1) tapInfo=\(tap.info)")
    lines.append("tThread=\(tThread) tVisible=\(tVisible) tExists=\(tExists) tHittable=\(tHittable) tAfterShot=\(tAfterShot) tEnd=\(now())")
    lines.append("doorAfter exists=\(e.exists) hittable=\(e.exists && e.isHittable) rail=\(element("qandeel-cosmos-timeline-rail").exists)")
    lines.append("BOARD \(final)")
    note("sefu1-\(mode)", lines.joined(separator: "\n"))
    note("sefu1-\(mode)-frames", frameLog.joined(separator: "\n"))
  }

  func test1A_tapAtFirstVisible() { earlyTap("A") }
  func test1B_tapAtFirstHittable() { earlyTap("B") }
  func test1C_elementTapRightAfterThread() { earlyTap("C") }
  func test1D_elementTapEightSecondsAfterThread() { earlyTap("D") }

  // ── entries (the D-1 harness's, settled: SE-FU-2 and layout are not SE-FU-1) ─────────────────────────────────────
  private func toConversation() -> Bool {
    app.launch()
    let ok = element("qandeel-conversation-thread").waitForExistence(timeout: 180)
    settle(8)
    return ok
  }
  private func enterPersonal() -> Bool {
    guard toConversation(), let door = soft(doorId, 30) else { return false }
    door.tap()
    guard soft("qandeel-cosmos-timeline-rail", 60) != nil else { return false }
    settle(4)
    return true
  }
  private func confirmOpen() {
    let open = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons.matching(NSPredicate(format: "label == 'Open' OR label == 'فتح'")).firstMatch
    if open.waitForExistence(timeout: 4) { open.tap() }
  }
  private func openLink(_ url: String) {
    XCUIDevice.shared.system.open(URL(string: url)!)
    confirmOpen()
    settle(2)
    _ = app.wait(for: .runningForeground, timeout: 10)
  }
  private func enterShared() -> Bool {
    guard toConversation() else { return false }
    openLink("qandeel://s401-proof/shared-field/seed")
    guard let sw = soft("qandeel-switcher-shared_world", 30) else { return false }
    sw.tap()
    let fixture = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Fixture Map World' OR label == 'عالم الخريطة الاختباري'")).firstMatch
    guard fixture.waitForExistence(timeout: 30) else { return false }
    fixture.tap()
    guard soft("qandeel-shared-band", 60) != nil else { return false }
    settle(5)
    return true
  }
  private func enterPublic() -> Bool {
    guard toConversation() else { return false }
    openLink("qandeel://s401-proof/public/seed")
    guard let sw = soft("qandeel-switcher-public_world", 30) else { return false }
    sw.tap()
    openLink("qandeel://s401-proof/public/allow")
    guard soft("qandeel-public-search", 45) != nil else { return false }
    settle(5)
    return true
  }

  // ── SE-FU-2 ────────────────────────────────────────────────────────────────────────────────────────────────────
  private func probe(_ name: String, _ p: CGPoint?, _ d: CGVector) {
    guard let p = p else { note("sefu2-\(name)", "NOT TESTED: the overlay's frame was not recorded"); return }
    let before = board()
    let r = drag("sefu2-\(name)", p, d)
    settle(1.5)
    let after = board()
    shot("sefu2-\(name)")
    note("sefu2-\(name)", "from \(Int(p.x)),\(Int(p.y)) by \(Int(d.dx)),\(Int(d.dy)) synth=\(r.ok) \(r.info)\nBEFORE \(before)\nAFTER \(after)")
  }
  private func press(_ name: String, _ p: CGPoint?) {
    guard let p = p else { note("sefu2-\(name)", "NOT TESTED: the control's frame was not recorded"); return }
    let before = board()
    let r = tapAt("sefu2-\(name)", p)
    settle(1.5)
    let after = board()
    shot("sefu2-\(name)")
    note("sefu2-\(name)", "tap at \(Int(p.x)),\(Int(p.y)) synth=\(r.ok) \(r.info)\nBEFORE \(before)\nAFTER \(after)")
  }
  private func centre(_ r: CGRect?) -> CGPoint? { r.map { CGPoint(x: $0.midX, y: $0.midY) } }
  /// Back to the world's home when a probe moved it: Back (a functional control) until it is laid out no more.
  private func home(_ w: String) {
    for i in 0..<3 {
      let back = element("qandeel-cosmos-back")
      guard back.exists, back.isEnabled else { return }
      press("\(w)-restore-back\(i)", centre(lay(board(), "\(w).back")))
    }
  }
  private func overlays(_ w: String) {
    let b = board()
    note("sefu2-\(w)-home-ax", app.debugDescription)
    note("sefu2-\(w)-home-board", b)
    let toCentre = { (p: CGPoint?) -> CGVector in
      guard let p = p else { return CGVector(dx: -120, dy: 0) }
      return CGVector(dx: p.x < self.screenW / 2 ? 120 : -120, dy: 0)
    }
    // Control: open stage (left of the rail, below the top row).
    let open = CGPoint(x: (screenW * 0.25).rounded(), y: (screenH * 0.45).rounded())
    probe("\(w)-open-stage", open, CGVector(dx: 120, dy: 0)); home(w)
    // The hidden, disabled Back at home.
    let backP = centre(lay(board(), "\(w).back"))
    probe("\(w)-hidden-back", backP, toCentre(backP)); home(w)
    // Disabled deeper beads (at home every bead below the current one is deeper).
    for i in 1...3 {
      let p = centre(lay(board(), "\(w).bead\(i)"))
      if p == nil { break }
      probe("\(w)-deeper-bead\(i)", p, toCentre(p)); home(w)
    }
    // The rail's line, between the first two beads.
    let line = lay(board(), "\(w).railLine"), b0 = lay(board(), "\(w).bead0"), b1 = lay(board(), "\(w).bead1")
    if let line = line, let b0 = b0, let b1 = b1 {
      probe("\(w)-rail-line", CGPoint(x: line.midX, y: (b0.midY + b1.midY) / 2), CGVector(dx: -120, dy: 0)); home(w)
    } else { note("sefu2-\(w)-rail-line", "NOT TESTED: line \(String(describing: line)) bead0 \(String(describing: b0)) bead1 \(String(describing: b1))") }
    // Positive: Overview on, then off.
    press("\(w)-overview-on", centre(lay(board(), "\(w).overview")))
    press("\(w)-overview-off", centre(lay(board(), "\(w).overview")))
  }

  func test2P_personalOverlays() {
    guard enterPersonal() else { note("sefu2-P", "NOT TESTED: the Personal Analysis did not open"); return }
    overlays("P")
    // The absence card: one step IN at the D-1 focal (passes 4 and 6 landed in an empty region there).
    let c = CGPoint(x: (screenW * 0.40).rounded(), y: (screenH * 0.68).rounded())
    var fingers: [[(CGPoint, Double)]] = []
    for sign in [-1.0, 1.0] {
      var f: [(CGPoint, Double)] = []
      for i in 0...8 {
        let t = Double(i) / 8
        let half = 14 + (90 - 14) * t
        f.append((CGPoint(x: c.x + CGFloat(sign * half), y: c.y), 0.8 * t))
      }
      fingers.append(f)
    }
    let r = synthesize("sefu2-P-pinch-in", fingers)
    settle(2.5)
    note("sefu2-P-pinch-in", "synth=\(r.ok) \(r.info)\n\(board())")
    let b = board()
    guard element("qandeel-cosmos-nearest").exists, let card = lay(b, "P.card") else {
      shot("sefu2-P-no-card")
      note("sefu2-P-card", "NOT TESTED: the step did not land in an empty region")
      return
    }
    note("sefu2-P-card-ax", app.debugDescription)
    let text = lay(b, "P.cardText"), nearest = lay(b, "P.nearest")
    // The card's panel away from its text and its button, then the text itself.
    var panel = CGPoint(x: card.minX + 6, y: card.midY)
    if let t = text, t.contains(panel) { panel = CGPoint(x: card.minX + 3, y: card.maxY - 3) }
    if let n = nearest, n.contains(panel) { panel = CGPoint(x: card.minX + 3, y: card.minY + 3) }
    probe("P-card-panel", panel, CGVector(dx: 100, dy: 0))
    probe("P-card-text", centre(text), CGVector(dx: 100, dy: 0))
    // Positive: Go to the nearest, then an earlier (shallower) bead.
    if element("qandeel-cosmos-nearest").exists { press("P-nearest", centre(lay(board(), "P.nearest"))) }
    press("P-past-bead0", centre(lay(board(), "P.bead0")))
  }

  func test2S_sharedOverlays() {
    guard enterShared() else { note("sefu2-S", "NOT TESTED: the Shared field did not open"); return }
    overlays("S")
  }

  func test2U_publicOverlays() {
    guard enterPublic() else { note("sefu2-U", "NOT TESTED: the Public field did not open"); return }
    overlays("U")
  }

  // ── Layout (enlarged text) ─────────────────────────────────────────────────────────────────────────────────────
  func test3_layout() {
    let t = tag
    note("L-\(t)-screen", "\(Int(screenW))x\(Int(screenH)) points")
    if toConversation() {
      shot("L-\(t)-conversation")
      note("L-\(t)-conversation", [frames([doorId, "qandeel-understanding-entry", "qandeel-public-share-entry", "qandeel-settings-entry",
                                           "qandeel-chrome-start", "qandeel-conversation-thread", "qandeel-global-switcher",
                                           "qandeel-switcher-my_world", "qandeel-switcher-shared_world", "qandeel-switcher-public_world"]),
                                   framesPrefix("qandeel-utterance-"), framesPrefix("qandeel-reply-"), "BOARD \(board())"].joined(separator: "\n"))
      if let door = soft(doorId, 10) {
        door.tap()
        if soft("qandeel-cosmos-timeline-rail", 60) != nil {
          settle(4)
          shot("L-\(t)-personal")
          note("L-\(t)-personal", [frames(["qandeel-cosmos-back", "qandeel-cosmos-overview", "qandeel-cosmos-rail", "qandeel-cosmos-timeline-rail",
                                           "qandeel-cosmos-register", personalStage]), "BOARD \(board())"].joined(separator: "\n"))
        } else { shot("L-\(t)-personal-missing"); note("L-\(t)-personal", "NOT REACHED") }
      }
    } else { shot("L-\(t)-conversation-missing"); note("L-\(t)-conversation", "NOT REACHED") }
    if enterShared() {
      shot("L-\(t)-shared")
      note("L-\(t)-shared", [frames(["qandeel-shared-band", "qandeel-shared-title", "qandeel-shared-back", "qandeel-shared-conversation-open",
                                     "qandeel-shared-manage-open", "qandeel-cosmos-back", "qandeel-cosmos-overview", "qandeel-cosmos-rail",
                                     "qandeel-global-switcher"]), "BOARD \(board())"].joined(separator: "\n"))
    } else { shot("L-\(t)-shared-missing"); note("L-\(t)-shared", "NOT REACHED") }
    if enterPublic() {
      shot("L-\(t)-public")
      note("L-\(t)-public", [frames(["qandeel-public-band", "qandeel-public-search", "qandeel-cosmos-back", "qandeel-cosmos-overview",
                                     "qandeel-cosmos-rail", "qandeel-global-switcher"]), "BOARD \(board())"].joined(separator: "\n"))
    } else { shot("L-\(t)-public-missing"); note("L-\(t)-public", "NOT REACHED") }
  }
}
