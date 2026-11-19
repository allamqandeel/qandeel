// COSMOS-INT-01 Slice E (PO, 2026-11-18; backlog BG-10): native iOS gestures on the COSMOS stages, through XCUITest.
//
// Maestro's XCTest driver takes one touch per HTTP request, so it can deliver neither a double tap inside
// DOUBLE_TAP_MS (320 ms) nor a two-finger pinch. XCUITest synthesises both natively. These tests drive the S401 proof
// build (the production composition over the labelled synthetic proof network) and assert what each gesture must do:
//   - the semantic depth (each stage's `:semantic-step` element names its current depth in its label);
//   - Back (laid out only away from the home position);
//   - the current depth bead passing its touch to the stage in every world (PO 2026-11-18, item 3).
// Focal anchoring and the pan are read from the screenshots attached here (`trip-…` / `pan-…`, each with a `…-spec`
// note), by scripts/cosmos-ios-world/xcui-analyse.mjs after the run. Nothing here reads language-specific text except
// the labelled proof fixture's own name, in both languages, and the "Go to the nearest" control in both languages.
//
// Two-finger pinches (R3, run 44289175909): `XCUIElement.pinch(withScale:velocity:)` places its fingers relative to the
// element's frame. The stages' `:semantic-step` elements span the whole window, so a closing pinch began with one finger
// in the navigation header (56,59) and one on the bottom chrome (346,815) — neither on the stage — and no stage could
// see a pinch (decoded from that run's synthesized-event records). A person pinches on the map. So every pinch here is
// synthesised with its two fingers placed on open stage, symmetric about a chosen focal, through XCTest's event
// synthesiser (`XCPointerEventPath` / `XCSynthesizedEventRecord`, looked up at run time). If this Xcode does not
// provide them, the test is skipped: NOT TESTED, never PASS or FAIL.
import XCTest
import UIKit

final class CosmosWorldGestureUITests: XCTestCase {
  private let app = XCUIApplication()
  private let personalStage = "qandeel-cosmos-world:semantic-step"
  private let sharedStage = "qandeel-shared-field-world:semantic-step"
  private let publicStage = "qandeel-public-field-world:semantic-step"

  override func setUp() {
    super.setUp()
    continueAfterFailure = false
  }

  // ── helpers ────────────────────────────────────────────────────────────────────────────────────────────────────
  private func element(_ id: String) -> XCUIElement { app.descendants(matching: .any)[id] }

  @discardableResult
  private func waitFor(_ id: String, _ seconds: TimeInterval) -> XCUIElement {
    let found = element(id)
    XCTAssertTrue(found.waitForExistence(timeout: seconds), "\(id) did not appear within \(Int(seconds)) s")
    return found
  }

  private func settle(_ seconds: Double = 2.5) { Thread.sleep(forTimeInterval: seconds) }

  private func shot(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// The on-screen frames (points) of the stage's fixed overlays, as "id=x,y,w,h;…", recorded next to a measured screenshot
  /// so that the analyser never takes a feature inside one of them (the 6-px speck inside "Nothing in this region." in
  /// targeted run 44314026822) for the world.
  private func overlayFrames() -> String {
    let ids = ["qandeel-cosmos-nearest", "qandeel-cosmos-back", "qandeel-cosmos-overview", "qandeel-cosmos-overview-companion",
               "qandeel-cosmos-rail", "qandeel-cosmos-register", "qandeel-cosmos-timeline-rail"]
    return ids.flatMap { id in
      app.descendants(matching: .any).matching(identifier: id).allElementsBoundByIndex.compactMap { e -> String? in
        let f = e.frame
        guard e.exists, !f.isEmpty else { return nil }
        return "\(id)=\(Int(f.minX.rounded(.down))),\(Int(f.minY.rounded(.down))),\(Int(f.width.rounded(.up)) + 1),\(Int(f.height.rounded(.up)) + 1)"
      }
    }.joined(separator: ";")
  }

  private func note(_ name: String, _ text: String) {
    let attachment = XCTAttachment(string: text)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// A point in screen points, from the app's top-left corner.
  private func at(_ x: CGFloat, _ y: CGFloat) -> XCUICoordinate {
    app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0)).withOffset(CGVector(dx: x, dy: y))
  }

  /// The stage's current depth word: its `:semantic-step` label is "<stage name> · <depth word>".
  private func depth(_ stageId: String) -> String {
    let label = element(stageId).label
    return label.components(separatedBy: " · ").last ?? label
  }

  private func backAvailable() -> Bool {
    let back = element("qandeel-cosmos-back")
    return back.exists && back.isEnabled
  }

  /// The current depth's bead in the depth rail: the selected button named by the current depth word. A touch aimed at
  /// it goes to its lower part: in the Public band the Overview chip (y 262-306 on an iPhone 17) overlaps its upper edge.
  private func currentBead(_ word: String) -> XCUIElement? {
    let beads = app.buttons.matching(NSPredicate(format: "label == %@", word)).allElementsBoundByIndex
    return beads.first { $0.isSelected }
  }

  /// A two-finger pinch on open stage: the fingers go down at `focal ± startHalf` and move, together and symmetrically, to
  /// `focal ± endHalf` over `duration` seconds. Closer at the end than at the start steps OUT; farther steps IN.
  private func pinch(_ name: String, about focal: CGPoint, from startHalf: CGVector, to endHalf: CGVector, duration: Double = 0.8) throws {
    guard let pathClass = NSClassFromString("XCPointerEventPath") as? NSObject.Type,
          let recordClass = NSClassFromString("XCSynthesizedEventRecord") as? NSObject.Type else {
      throw XCTSkip("this Xcode provides no XCPointerEventPath / XCSynthesizedEventRecord: the pinch is NOT TESTED")
    }
    typealias InitPath = @convention(c) (AnyObject, Selector, CGPoint, Double) -> AnyObject
    typealias MovePath = @convention(c) (AnyObject, Selector, CGPoint, Double) -> Void
    typealias LiftPath = @convention(c) (AnyObject, Selector, Double) -> Void
    typealias InitRecord = @convention(c) (AnyObject, Selector, NSString, Int) -> AnyObject
    typealias AddPath = @convention(c) (AnyObject, Selector, AnyObject) -> Void
    typealias Synthesize = @convention(c) (AnyObject, Selector, AutoreleasingUnsafeMutablePointer<NSError?>?) -> Bool
    let initPath = NSSelectorFromString("initForTouchAtPoint:offset:")
    let move = NSSelectorFromString("moveToPoint:atOffset:")
    let lift = NSSelectorFromString("liftUpAtOffset:")
    let initRecord = NSSelectorFromString("initWithName:interfaceOrientation:")
    let add = NSSelectorFromString("addPointerEventPath:")
    let synthesize = NSSelectorFromString("synthesizeWithError:")
    // Synthesis: the record's own `synthesizeWithError:`, or else the device's event synthesiser (the route newer XCTest
    // versions use, as WebDriverAgent does).
    typealias SynthesizeAsync = @convention(c) (AnyObject, Selector, AnyObject, @escaping @convention(block) (Bool, NSError?) -> Void) -> Void
    let eventSynthesizer = NSSelectorFromString("eventSynthesizer")
    let synthesizeEvent = NSSelectorFromString("synthesizeEvent:completion:")
    let device = XCUIDevice.shared as NSObject
    let synthesiser: AnyObject? = device.responds(to: eventSynthesizer) ? device.perform(eventSynthesizer)?.takeUnretainedValue() : nil
    let canAsync = (synthesiser as? NSObject)?.responds(to: synthesizeEvent) == true
    guard pathClass.instancesRespond(to: initPath), pathClass.instancesRespond(to: move), pathClass.instancesRespond(to: lift),
          recordClass.instancesRespond(to: initRecord), recordClass.instancesRespond(to: add),
          recordClass.instancesRespond(to: synthesize) || canAsync else {
      throw XCTSkip("this Xcode's event synthesiser lacks the expected selectors: the pinch is NOT TESTED")
    }
    let rawRecord: AnyObject = (recordClass as AnyObject).perform(NSSelectorFromString("alloc")).takeUnretainedValue()
    let record = unsafeBitCast((rawRecord as! NSObject).method(for: initRecord), to: InitRecord.self)(rawRecord, initRecord, name as NSString, 1)
    var fingers: [String] = []
    for sign in [-1.0, 1.0] {
      let start = CGPoint(x: focal.x + sign * startHalf.dx, y: focal.y + sign * startHalf.dy)
      let end = CGPoint(x: focal.x + sign * endHalf.dx, y: focal.y + sign * endHalf.dy)
      let rawPath: AnyObject = (pathClass as AnyObject).perform(NSSelectorFromString("alloc")).takeUnretainedValue()
      let path = unsafeBitCast((rawPath as! NSObject).method(for: initPath), to: InitPath.self)(rawPath, initPath, start, 0)
      let moveImp = unsafeBitCast((path as! NSObject).method(for: move), to: MovePath.self)
      for step in 1...8 {
        let t = Double(step) / 8
        moveImp(path, move, CGPoint(x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t), duration * t)
      }
      unsafeBitCast((path as! NSObject).method(for: lift), to: LiftPath.self)(path, lift, duration)
      unsafeBitCast((record as! NSObject).method(for: add), to: AddPath.self)(record, add, path)
      fingers.append("(\(Int(start.x)),\(Int(start.y)))->(\(Int(end.x)),\(Int(end.y)))")
    }
    var error: NSError?
    var ok = false
    var route = "synthesizeWithError:"
    if (record as! NSObject).responds(to: synthesize) {
      ok = unsafeBitCast((record as! NSObject).method(for: synthesize), to: Synthesize.self)(record, synthesize, &error)
    } else if let synthesiser = synthesiser {
      route = "eventSynthesizer synthesizeEvent:completion:"
      let done = expectation(description: "\(name) synthesised")
      unsafeBitCast((synthesiser as! NSObject).method(for: synthesizeEvent), to: SynthesizeAsync.self)(synthesiser, synthesizeEvent, record) { result, failure in
        ok = result; error = failure; done.fulfill()
      }
      wait(for: [done], timeout: duration + 15)
    }
    note("\(name)-fingers", "\(fingers.joined(separator: " ")) over \(duration) s; \(route) -> \(ok)\(error.map { ": \($0)" } ?? "")")
    XCTAssertTrue(ok, "the pinch could not be synthesised: \(error?.localizedDescription ?? "no error")")
  }

  // ── links (R3: diagnosed) ──────────────────────────────────────────────────────────────────────────────────────
  // Run 44289175909: after `XCUIApplication.open(URL)` the Shared root still said "No Shared Worlds yet." (the seed never
  // reached the proof network), while Maestro's `simctl openurl` route seeds it every time. The proof network listens
  // for the runtime `url` event only. Each link here therefore records the app's process before and after (a different
  // pid means the app was relaunched with the URL instead of receiving it), and the route that seeded the World.
  private func pid() -> String {
    let text = app.debugDescription
    guard let range = text.range(of: #"pid: \d+"#, options: .regularExpression) else { return "?" }
    return String(text[range].dropFirst(5))
  }

  private func confirmOpen() {
    // iOS may ask before a link from outside the app opens it.
    let open = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons.matching(NSPredicate(format: "label == 'Open' OR label == 'فتح'")).firstMatch
    if open.waitForExistence(timeout: 4) { open.tap() }
  }

  private func openLink(_ url: String, via route: String, _ tag: String) {
    let before = pid()
    if route == "system" { XCUIDevice.shared.system.open(URL(string: url)!) } else { app.open(URL(string: url)!) }
    confirmOpen()
    settle(2)
    _ = app.wait(for: .runningForeground, timeout: 10)
    note("\(tag)-link", "\(route) \(url): app pid \(before) -> \(pid())")
  }

  /// The conversation, settled before the first touch. Targeted run 44305519293 (cold first launch, 46 s) tapped the
  /// Analysis door 1 s after the thread appeared and the tap had no effect; pass 1 (44297426329) tapped it 8 s after
  /// and it opened. Maestro's World gate always enters after separate launch and tap invocations, seconds apart. The
  /// entry is not what the gate measures: it waits like Maestro, and never retries a touch.
  private func toConversation() {
    app.launch()
    waitFor("qandeel-conversation-thread", 180)
    settle(8)
  }

  private func enterPersonal() -> XCUIElement {
    toConversation()
    waitFor("qandeel-depth-to-analysis", 30).tap()
    waitFor("qandeel-cosmos-timeline-rail", 60)
    settle(4)
    return waitFor(personalStage, 10)
  }

  /// The labelled Fixture Map World, seeded by its proof link over the system route. Targeted run 44297426329 proved the
  /// routes: the app route relaunched the app (pid 68213 -> 68291, 73257 -> 73826; the seed lost), and the system route
  /// kept the process (65600, 70633) and seeded the World. The list row is a BUTTON labelled with the World's name (the
  /// R3 `staticTexts` query could never match it), so the row is found as any element with that exact label.
  private func enterShared(_ tag: String) -> XCUIElement? {
    toConversation()
    openLink("qandeel://s401-proof/shared-field/seed", via: "system", "\(tag)-seed")
    waitFor("qandeel-switcher-shared_world", 30).tap()
    let fixture = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Fixture Map World' OR label == 'عالم الخريطة الاختباري'")).firstMatch
    guard fixture.waitForExistence(timeout: 30) else {
      shot("\(tag)-not-listed")
      XCTFail("the labelled Fixture Map World is not listed")
      return nil
    }
    fixture.tap()
    waitFor("qandeel-shared-band", 60)
    settle(5)
    return waitFor(sharedStage, 10)
  }

  private func enterPublic(_ tag: String) -> XCUIElement? {
    toConversation()
    openLink("qandeel://s401-proof/public/seed", via: "system", "\(tag)-seed")
    waitFor("qandeel-switcher-public_world", 30).tap()
    openLink("qandeel://s401-proof/public/allow", via: "system", "\(tag)-allow")
    guard element("qandeel-public-search").waitForExistence(timeout: 45) else {
      shot("\(tag)-not-open")
      XCTFail("the Public World did not open")
      return nil
    }
    settle(5)
    return waitFor(publicStage, 10)
  }

  private var screen: CGRect { app.windows.firstMatch.frame }

  // ── Personal (D-1) ─────────────────────────────────────────────────────────────────────────────────────────────

  /// Focal anchoring, by a round trip at the first depth's content. A genuine double tap at f (open stage) steps IN
  /// about f; a two-finger pinch closing about c (fingers on open stage, between the top chips and the rail) steps OUT
  /// about c. One step is a factor of 8, so if both keep the world point under the fingers, every first-depth node ends
  /// moved by exactly (7/8)(c - f); if either does not, the shift differs (about the stage centre instead, for example,
  /// it would be 199 pt). Measured on the attached `trip-p-before` / `trip-p-after` screenshots.
  func testPersonalDoubleTapAndPinchStepAboutTheirFingers() throws {
    _ = enterPersonal()
    let first = depth(personalStage)
    XCTAssertFalse(backAvailable(), "the stage was not at home before the double tap")
    let f = CGPoint(x: (screen.width / 2).rounded(), y: (screen.height * 0.24).rounded())
    let c = CGPoint(x: f.x, y: f.y + 40)
    note("trip-p-spec", "\(Int(f.x)),\(Int(f.y)),\(Int(c.x)),\(Int(c.y))")
    shot("trip-p-before")
    at(f.x, f.y).doubleTap()
    settle()
    let second = depth(personalStage)
    XCTAssertNotEqual(second, first, "a native double tap on open stage did not step IN")
    XCTAssertTrue(backAvailable(), "Back is not available after the double tap's step")
    shot("trip-p-mid")
    try pinch("trip-p-pinch", about: c, from: CGVector(dx: 80, dy: 0), to: CGVector(dx: 12, dy: 0))
    settle()
    shot("trip-p-after")
    note("p-trip-depths", "\(first) -> double tap -> \(second) -> pinch closing -> \(depth(personalStage))")
    XCTAssertEqual(depth(personalStage), first, "a native two-finger pinch closing on open stage did not step OUT to the first depth")
  }

  /// A double tap whose fingers land on the current depth's word (the rail's lit bead) reaches the stage and steps IN
  /// (D-1, §18); the stage's Back then returns to the first depth.
  func testPersonalDoubleTapOnTheCurrentDepthWordStepsInAndBackReturns() {
    _ = enterPersonal()
    let first = depth(personalStage)
    guard let bead = currentBead(first) else { return XCTFail("the current depth bead '\(first)' is not in the rail") }
    let frame = bead.frame
    note("p-word-dtap-at", "bead '\(first)' frame \(Int(frame.minX)),\(Int(frame.minY)),\(Int(frame.width)),\(Int(frame.height))")
    at(frame.midX.rounded(), (frame.minY + frame.height * 0.75).rounded()).doubleTap()
    settle()
    let second = depth(personalStage)
    XCTAssertNotEqual(second, first, "a double tap on the current depth word did not reach the stage")
    XCTAssertTrue(backAvailable(), "Back is not available after the double tap's step")
    element("qandeel-cosmos-back").tap()
    settle()
    XCTAssertEqual(depth(personalStage), first, "Back did not return to the first depth")
    note("p-word-dtap-depths", "\(first) -> \(second) -> Back -> \(depth(personalStage))")
  }

  /// A two-finger pinch opening steps IN; a drag there, while the stage is still zoomed in, keeps the depth and moves the
  /// world by the drag (`pan-z-before` / `pan-z-after`, X-PAN-ZOOMED; PO review 2026-11-18, item 2); a pinch closing
  /// returns to the first depth; Back returns home; and a pan AFTER the round trip still moves the world by the drag,
  /// measured separately at the first depth (`pan-p-before` / `pan-p-after`, X-PAN-AFTER-PINCH, where five or six node
  /// cores show). A step IN magnifies eight times, so at the deeper depth one mark is in view by construction (targeted
  /// run 44297426329: one core, moved -106 for a -120 drag); X-PAN-ZOOMED measures that one core.
  func testPersonalPinchStepsInAndThePanStillMovesTheWorld() throws {
    _ = enterPersonal()
    let first = depth(personalStage)
    let c = CGPoint(x: (screen.width * 0.40).rounded(), y: (screen.height * 0.68).rounded())
    let from = CGPoint(x: (screen.width * 0.65).rounded(), y: (screen.height * 0.68).rounded())
    let to = CGPoint(x: from.x - 120, y: from.y)
    try pinch("pan-p-pinch-in", about: c, from: CGVector(dx: 14, dy: 0), to: CGVector(dx: 90, dy: 0))
    settle()
    let second = depth(personalStage)
    XCTAssertNotEqual(second, first, "a native two-finger pinch opening did not step IN")
    XCTAssertTrue(backAvailable(), "Back is not available after the pinch's step")
    // The step may land in an empty region (targeted run 44314026822: "Nothing in this region.", no mark in view, so
    // X-PAN-ZOOMED had nothing to measure). The product's own "Go to the nearest" then brings a mark into view at the
    // same depth; which path was taken is recorded.
    if element("qandeel-cosmos-nearest").exists {
      let nearest = app.buttons.matching(NSPredicate(format: "label == 'Go to the nearest' OR label == 'اذهب إلى الأقرب'")).firstMatch
      XCTAssertTrue(nearest.exists, "the step landed in an empty region and Go to the nearest is not offered")
      nearest.tap()
      settle()
      XCTAssertEqual(depth(personalStage), second, "Go to the nearest changed the semantic depth")
      note("pan-z-path", "the step landed in an empty region; Go to the nearest brought a mark into view at \(second)")
    } else {
      note("pan-z-path", "the step landed on content at \(second)")
    }
    // A drag on open stage while the stage is zoomed in: it moves the world (measured) and keeps the depth.
    note("pan-z-spec", "\(Int(to.x - from.x)),\(Int(to.y - from.y))")
    note("pan-z-overlays-before", overlayFrames())
    shot("pan-z-before")
    at(from.x, from.y).press(forDuration: 0.05, thenDragTo: at(to.x, to.y))
    settle()
    shot("pan-z-after")
    note("pan-z-overlays-after", overlayFrames())
    XCTAssertEqual(depth(personalStage), second, "the drag at the deeper depth changed the semantic depth")
    try pinch("pan-p-pinch-out", about: c, from: CGVector(dx: 90, dy: 0), to: CGVector(dx: 14, dy: 0))
    settle()
    XCTAssertEqual(depth(personalStage), first, "a native two-finger pinch closing did not step OUT to the first depth")
    if backAvailable() { element("qandeel-cosmos-back").tap(); settle() }
    XCTAssertFalse(backAvailable(), "Back did not return the first depth to its home position")
    // The measured pan, after both pinches, at the first depth's home position.
    note("pan-p-spec", "\(Int(to.x - from.x)),\(Int(to.y - from.y))")
    shot("pan-p-before")
    at(from.x, from.y).press(forDuration: 0.05, thenDragTo: at(to.x, to.y))
    settle()
    shot("pan-p-after")
    XCTAssertEqual(depth(personalStage), first, "the pan changed the semantic depth")
    XCTAssertTrue(backAvailable(), "after the pan, Back is not available (the camera did not move)")
    note("p-pinch-depths", "\(first) -> pinch opening -> \(second) -> pan (zoomed) -> pinch closing -> \(first) -> Back -> pan -> \(depth(personalStage))")
  }

  // ── Shared and Public: the current depth bead passes its touch to the stage (PO 2026-11-18, item 3) ──────────

  /// At FAR, a tap on the current depth's word reaches the stage, whose FAR tap discloses Far -> Mid; Back returns.
  func testSharedTapOnTheCurrentDepthWordReachesTheStage() {
    guard enterShared("s-word") != nil else { return }
    wordTapReachesTheStage(sharedStage, "s")
  }

  func testPublicTapOnTheCurrentDepthWordReachesTheStage() {
    guard enterPublic("u-word") != nil else { return }
    wordTapReachesTheStage(publicStage, "u")
  }

  private func wordTapReachesTheStage(_ stageId: String, _ tag: String) {
    let first = depth(stageId)
    XCTAssertFalse(backAvailable(), "the stage was not at home before the tap")
    guard let bead = currentBead(first) else { return XCTFail("the current depth bead '\(first)' is not in the rail") }
    let frame = bead.frame
    note("\(tag)-word-tap-at", "bead '\(first)' frame \(Int(frame.minX)),\(Int(frame.minY)),\(Int(frame.width)),\(Int(frame.height))")
    shot("\(tag)-word-tap-before")
    at(frame.midX.rounded(), (frame.minY + frame.height * 0.75).rounded()).tap()
    settle()
    shot("\(tag)-word-tap-after")
    let second = depth(stageId)
    XCTAssertNotEqual(second, first, "a tap on the current depth word did not reach the stage")
    XCTAssertTrue(backAvailable(), "Back is not available after the disclosure")
    element("qandeel-cosmos-back").tap()
    settle()
    XCTAssertEqual(depth(stageId), first, "Back did not return to the first depth")
    note("\(tag)-word-tap-depths", "\(first) -> \(second) -> Back -> \(depth(stageId))")
  }

  /// A two-finger pinch opening at FAR steps IN, and a pinch closing returns to FAR (the Shared stage); both on open
  /// stage, left of the depth rail.
  func testSharedPinchStepsInAndOut() throws {
    guard enterShared("s-pinch") != nil else { return }
    let first = depth(sharedStage)
    let c = CGPoint(x: (screen.width * 0.40).rounded(), y: (screen.height * 0.64).rounded())
    try pinch("s-pinch-in", about: c, from: CGVector(dx: 14, dy: 0), to: CGVector(dx: 90, dy: 0))
    settle()
    let second = depth(sharedStage)
    XCTAssertNotEqual(second, first, "a native two-finger pinch opening did not step IN")
    try pinch("s-pinch-out", about: c, from: CGVector(dx: 90, dy: 0), to: CGVector(dx: 14, dy: 0))
    settle()
    note("s-pinch-depths", "\(first) -> \(second) -> \(depth(sharedStage))")
    XCTAssertEqual(depth(sharedStage), first, "a native two-finger pinch closing did not step OUT")
  }

  // ── Slice E D-3 (PO 2026-11-18; contract §24) ─────────────────────────────────────────────────────────────────────
  // The helpers below are the CP1 diagnostic's (run 44364253792, branch cosmos/slice-e-d3-diag), without its in-app
  // board: the production build is measured from the outside only (screenshots, the accessibility tree, the clock).
  private func now() -> Int64 { Int64((Date().timeIntervalSince1970 * 1000).rounded()) }
  /// The device's screen in points, read in the runner (no query of the app, so timing loops never wait for it to idle).
  private var pts: CGRect { UIScreen.main.bounds }
  private func shot(_ name: String, _ s: XCUIScreenshot) {
    let a = XCTAttachment(screenshot: s)
    a.name = name
    a.lifetime = .keepAlways
    add(a)
  }

  /// One synthesised touch sequence: each finger is a list of (point, offset in seconds); the first is the touch-down and
  /// the last offset is the lift. Returns whether it was delivered and the clock (epoch ms) before and after.
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

  /// Luminance mean and standard deviation (0-255) of a rectangle given in points.
  private func stats(_ s: XCUIScreenshot, _ r: CGRect) -> (mean: Double, std: Double) {
    guard let cg = s.image.cgImage else { return (-1, -1) }
    let k = CGFloat(cg.width) / pts.width
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

  /// The mean absolute luminance difference (0-255) between two screenshots over a rectangle in points, sampled every
  /// 4 pixels: how much of the world moved there.
  private func change(_ a: XCUIScreenshot, _ b: XCUIScreenshot, _ r: CGRect) -> Double {
    func lum(_ s: XCUIScreenshot) -> (buf: [UInt8], w: Int, h: Int)? {
      guard let cg = s.image.cgImage else { return nil }
      let k = CGFloat(cg.width) / pts.width
      let px = CGRect(x: r.minX * k, y: r.minY * k, width: r.width * k, height: r.height * k).integral
      guard let crop = cg.cropping(to: px) else { return nil }
      let w = crop.width, h = crop.height
      var buf = [UInt8](repeating: 0, count: w * h * 4)
      let ok: Bool = buf.withUnsafeMutableBytes { ptr -> Bool in
        guard let ctx = CGContext(data: ptr.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
        ctx.draw(crop, in: CGRect(x: 0, y: 0, width: w, height: h))
        return true
      }
      return ok ? (buf, w, h) : nil
    }
    guard let x = lum(a), let y = lum(b), x.w == y.w, x.h == y.h, x.w * x.h > 0 else { return -1 }
    var sum = 0.0, n = 0.0
    var row = 0
    while row < x.h {
      var col = 0
      while col < x.w {
        let i = (row * x.w + col) * 4
        let la = 0.299 * Double(x.buf[i]) + 0.587 * Double(x.buf[i + 1]) + 0.114 * Double(x.buf[i + 2])
        let lb = 0.299 * Double(y.buf[i]) + 0.587 * Double(y.buf[i + 1]) + 0.114 * Double(y.buf[i + 2])
        sum += abs(la - lb); n += 1
        col += 4
      }
      row += 4
    }
    return n > 0 ? sum / n : -1
  }

  /// A drag synthesised from p by d over half a second (ten moves).
  @discardableResult
  private func drag(_ name: String, _ p: CGPoint, _ d: CGVector) -> Bool {
    var finger: [(CGPoint, Double)] = [(p, 0)]
    for i in 1...10 {
      let t = Double(i) / 10
      finger.append((CGPoint(x: p.x + d.dx * t, y: p.y + d.dy * t), 0.5 * t))
    }
    let r = synthesize(name, [finger])
    note("\(name)-drag", "from \(Int(p.x)),\(Int(p.y)) by \(Int(d.dx)),\(Int(d.dy)): \(r.ok) \(r.info)")
    return r.ok
  }

  /// The Conversation door's frame in points before it is in the accessibility tree (iPhone 17, en: the CP1 diagnostic's
  /// value, from the failure hierarchy of run 44305519293). Overridable with D3_DOOR="x,y,w,h".
  private var doorFrame: CGRect {
    let v = (ProcessInfo.processInfo.environment["D3_DOOR"] ?? "284,64,104,44").split(separator: ",").compactMap { Double($0) }
    return v.count == 4 ? CGRect(x: v[0], y: v[1], width: v[2], height: v[3]) : CGRect(x: 284, y: 64, width: 104, height: 44)
  }

  /// One tap on the door the moment it is visibly drawn, never retried, and how long the app took to answer it, read from
  /// screenshots taken back to back after the touch (their interval is the resolution, recorded):
  ///   response  the first screenshot in which the door's own pixels changed (its pressed state, or the Analysis);
  ///   stage     the first screenshot in which the screen below the door changed as a whole (the Analysis drawn);
  ///   ready     the Analysis's timeline rail in the accessibility tree (XCUITest's query, about 1 s resolution).
  /// D-3 CP4 (PO 2026-11-19): when the stage test never fires (a dark Analysis can look like the Conversation below the
  /// door), the screenshot watch used to run on for its whole 20 s and "ready" then reported that watch, not the app
  /// (warm ready 21.6–22.1 s in every such run, 2.3–3.8 s when the stage was seen). The watch now stops 3 s after the
  /// response, and the line records when the query started, so "ready" is never read as the app's time.
  private func doorTap(_ phase: String, _ visibleShot: XCUIScreenshot) -> (opened: Bool, line: String) {
    let door = doorFrame
    let below = CGRect(x: 0, y: door.maxY + 50, width: pts.width, height: 200)
    let d0 = stats(visibleShot, door), b0 = stats(visibleShot, below)
    let tap = synthesize("sefu1-\(phase)-tap", [[(CGPoint(x: door.midX, y: door.midY), 0), (CGPoint(x: door.midX, y: door.midY), 0.06)]])
    var tResponse: Int64 = 0, tStage: Int64 = 0, shots = 0
    var gaps: [Int64] = []
    var last = tap.t1
    let until = Date().addingTimeInterval(20)
    var responded: Date? = nil
    while Date() < until && (tResponse == 0 || tStage == 0) {
      if let r = responded, Date().timeIntervalSince(r) > 3 { break }
      let s = XCUIScreen.main.screenshot()
      let t = now()
      shots += 1; gaps.append(t - last); last = t
      let d = stats(s, door), b = stats(s, below)
      if tResponse == 0 && (abs(d.mean - d0.mean) > 6 || abs(d.std - d0.std) > 6) { tResponse = t; responded = Date(); shot("sefu1-\(phase)-first-response", s) }
      if tStage == 0 && abs(b.mean - b0.mean) > 20 { tStage = t; shot("sefu1-\(phase)-stage", s) }
    }
    let tQuery = now()
    let opened = element("qandeel-cosmos-timeline-rail").waitForExistence(timeout: 30)
    let tReady = opened ? now() : 0
    let gap = gaps.isEmpty ? 0 : gaps.reduce(0, +) / Int64(gaps.count)
    let ms = { (t: Int64) -> String in t == 0 ? "none" : "\(t - tap.t0)" }
    return (opened, "\(phase): tap=\(tap.ok) \(tap.info); response=\(ms(tResponse)) ms; stage=\(ms(tStage)) ms; ready=\(ms(tReady)) ms (query, started at \(ms(tQuery)) ms); screenshots=\(shots), mean interval \(gap) ms")
  }

  /// D-a / D-b (PO 2026-11-18): right after a FRESH install (the workflow installs the app anew before this test alone),
  /// the first launch's door is tapped once at its first visibly drawn frame — no settle, no retry — and must open the
  /// Analysis. Then the warm case: back to the Conversation, the door tapped once at once, timed the same way. The timings
  /// are recorded separately (`sefu1-timing`), never asserted here: 250 ms is judged on them in the report.
  func testFreshInstallFirstVisibleDoorTapOpensTheAnalysis() {
    let door = doorFrame
    let tLaunch = now()
    app.launch()
    var visible: XCUIScreenshot?
    var tVisible: Int64 = 0
    let deadline = Date().addingTimeInterval(180)
    while Date() < deadline {
      let s = XCUIScreen.main.screenshot()
      if stats(s, door).std > 8 { visible = s; tVisible = now(); break }
    }
    guard let first = visible else { return XCTFail("the door was not drawn within 180 s of the launch") }
    shot("sefu1-cold-first-visible", first)
    let cold = doorTap("cold", first)
    shot("sefu1-cold-end")
    var lines = ["launch->door visible: \(tVisible - tLaunch) ms", cold.line]
    XCTAssertTrue(cold.opened, "the first-visible tap after a fresh install did not open the Analysis (SE-FU-1)")
    if cold.opened {
      settle(4)
      let back = element("qandeel-depth-to-conversation")
      if back.waitForExistence(timeout: 10) {
        back.tap()
        var warmVisible: XCUIScreenshot?
        let warmDeadline = Date().addingTimeInterval(30)
        while Date() < warmDeadline {
          let s = XCUIScreen.main.screenshot()
          if stats(s, door).std > 8 && element("qandeel-conversation-thread").exists { warmVisible = s; break }
        }
        if let w = warmVisible {
          let warm = doorTap("warm", w)
          lines.append(warm.line)
          XCTAssertTrue(warm.opened, "the warm door tap did not open the Analysis")
        } else { lines.append("warm: NOT TESTED (the Conversation did not return within 30 s)") }
      } else { lines.append("warm: NOT TESTED (no way back to the Conversation)") }
    }
    note("sefu1-timing", lines.joined(separator: " | "))
  }

  /// SE-FU-2 (D-3; CP1 diag run 44364253792 proved the disabled deeper beads and the "Nothing in this region." card took
  /// the stage's touch on iOS). At home a drag that STARTS on a deeper bead's dot (over the rail line) or on its word
  /// reaches the stage: the world moves off its home position, so Back is laid out. In an empty region, a drag starting
  /// on the card's words moves the world as much as a drag on open stage does (screenshots of the stage away from the
  /// card; an idle pair is the floor).
  func testPersonalDeeperBeadsTheRailLineAndTheCardPassTheirTouchToTheStage() throws {
    _ = enterPersonal()
    let first = depth(personalStage)
    XCTAssertFalse(backAvailable(), "the stage was not at home")
    let deeper = app.buttons.allElementsBoundByIndex.filter { $0.exists && !$0.isEnabled && !$0.isSelected && $0.frame.minX > screen.width * 0.5 }
    note("sefu2-deeper-beads", deeper.map { "\($0.label)=\(Int($0.frame.minX)),\(Int($0.frame.minY)),\(Int($0.frame.width)),\(Int($0.frame.height))" }.joined(separator: "; "))
    guard let bead = deeper.last else { return XCTFail("no deeper (disabled) bead found in the rail") }
    let f = bead.frame
    for (name, p) in [("dot", CGPoint(x: (screen.width - 24).rounded(), y: f.midY.rounded())), ("word", CGPoint(x: (f.minX + 12).rounded(), y: f.midY.rounded()))] {
      XCTAssertTrue(drag("sefu2-bead-\(name)", p, CGVector(dx: -120, dy: 0)), "the drag could not be synthesised")
      settle()
      shot("sefu2-bead-\(name)-after")
      XCTAssertTrue(backAvailable(), "a drag starting on the deeper bead's \(name) did not reach the stage (SE-FU-2)")
      XCTAssertEqual(depth(personalStage), first, "the drag changed the semantic depth")
      if backAvailable() { element("qandeel-cosmos-back").tap(); settle() }
      XCTAssertFalse(backAvailable(), "Back did not return home")
    }
    // The card: one step IN where the D-1 pinch lands in an empty region on this proof network.
    let c = CGPoint(x: (screen.width * 0.40).rounded(), y: (screen.height * 0.68).rounded())
    try pinch("sefu2-card-pinch-in", about: c, from: CGVector(dx: 14, dy: 0), to: CGVector(dx: 90, dy: 0))
    settle()
    guard element("qandeel-cosmos-nearest").exists else {
      shot("sefu2-card-absent")
      throw XCTSkip("the step did not land in an empty region: the card is NOT TESTED")
    }
    let words = app.staticTexts.matching(NSPredicate(format: "label == 'Nothing in this region.' OR label == 'لا شيء في هذه المنطقة.'")).firstMatch
    guard words.exists else { return XCTFail("the card's words are not in the accessibility tree") }
    let card = words.frame
    let top: CGFloat = 170
    let field = card.minY - 12 - top > 120 ? CGRect(x: 0, y: top, width: screen.width * 0.6, height: card.minY - 12 - top)
                                           : CGRect(x: 0, y: card.maxY + 12, width: screen.width * 0.6, height: max(60, screen.height - 220 - card.maxY - 12))
    let i0 = XCUIScreen.main.screenshot(); settle(1.5); let i1 = XCUIScreen.main.screenshot()
    let idle = change(i0, i1, field)
    let o0 = XCUIScreen.main.screenshot()
    drag("sefu2-open", CGPoint(x: (screen.width * 0.30).rounded(), y: field.midY.rounded()), CGVector(dx: 100, dy: 0))
    settle()
    let o1 = XCUIScreen.main.screenshot()
    let open = change(o0, o1, field)
    drag("sefu2-card-words", CGPoint(x: card.midX.rounded(), y: card.midY.rounded()), CGVector(dx: -100, dy: 0))
    settle()
    let w1 = XCUIScreen.main.screenshot()
    let viaCard = change(o1, w1, field)
    shot("sefu2-card-after", w1)
    note("sefu2-card", "words \(Int(card.minX)),\(Int(card.minY)),\(Int(card.width)),\(Int(card.height)); field \(Int(field.minX)),\(Int(field.minY)),\(Int(field.width)),\(Int(field.height)); idle=\(idle) open=\(open) card=\(viaCard)")
    XCTAssertGreaterThan(open, max(3 * idle, 1), "the open-stage drag did not move the world measurably: the card is not measurable")
    XCTAssertGreaterThan(viaCard, max(3 * idle, 0.4 * open), "a drag starting on the card's words did not reach the stage (SE-FU-2)")
  }

  // ── Public (COSMOS-FINAL-01 O-1; PO 2026-11-19) ──────────────────────────────────────────────────────────────────

  /// A search EXECUTED while the section list is open shows its answer at once: the list closes, the chosen section is
  /// kept (its «في: …» scope row is shown) and nothing waits for a section to be chosen. Focusing and typing alone leave the
  /// list open. The query is Latin, typed one key at a time (run 44491423054): XCTest cannot type Arabic on this keyboard,
  /// so the synthetic Arabic fixture answers "no results", which the same results area shows (qandeel-public-search-results).
  func testPublicSearchExecutedWhileTheSectionListIsOpenShowsItsAnswer() {
    guard enterPublic("o1") != nil else { return }
    waitFor("qandeel-public-section-control", 20).tap()
    waitFor("qandeel-public-sections", 20)
    waitFor("qandeel-public-section-family", 10).tap()
    settle(2)
    XCTAssertFalse(element("qandeel-public-sections").exists, "choosing a section did not close the list")
    waitFor("qandeel-public-section-control", 10).tap()
    waitFor("qandeel-public-sections", 20)
    shot("o1-list-open")
    let search = waitFor("qandeel-public-search", 10)
    search.tap()
    settle(1)
    for key in ["z", "q"] { search.typeText(key); settle(0.6) }
    XCTAssertTrue(element("qandeel-public-sections").exists, "the list closed before any search was executed")
    shot("o1-typed")
    search.typeText("\n")
    let answer = element("qandeel-public-search-results")
    XCTAssertTrue(answer.waitForExistence(timeout: 15), "the executed search's answer is not shown")
    settle(1)
    shot("o1-answer")
    XCTAssertFalse(element("qandeel-public-sections").exists, "the section list still hides the executed search's answer")
    XCTAssertTrue(element("qandeel-public-search-scope").exists, "the chosen section (its scope row) was not kept")
    note("o1", "list open -> typed (list kept) -> executed: answer=\(answer.exists) list=\(element("qandeel-public-sections").exists) scope=\(element("qandeel-public-search-scope").exists)")
  }

  /// Layout at the reader's text size (D-3, PO D-c / D-d): every World's controls inside the screen, the depth rail clear
  /// of the Overview chip, the switcher's three destinations on the screen, and the map's clear share recorded. Run at
  /// the default size in this gate and under enlarged sizes by the D-3 validation (D3_TAG names the configuration).
  /// "Near-zero" is taken as under 20 % of the screen; every share is recorded for the PO's tiers.
  func testLayoutAtTheReadersTextSize() {
    let tag = ProcessInfo.processInfo.environment["D3_TAG"] ?? "gate"
    // D-3 CP4 (PO 2026-11-19): a measurement of every World. In validation 44411274594 a Shared share failure stopped the
    // test, so the small iPhone's AX5 Public was never measured and the recorded frames (`layout-…`) were lost. Every
    // World is now measured and recorded; any failed check still fails the test.
    continueAfterFailure = true
    // Launch first: `screen` is the app's window. Run alone (validation 44397000717) the test found the app not running
    // ("Failed to get matching snapshot"); in the gate it passed only because an earlier test had left the app open.
    toConversation()
    let H = screen.height, W = screen.width
    var lines = ["screen \(Int(W))x\(Int(H))"]
    func box(_ e: XCUIElement) -> String { let f = e.frame; return "\(Int(f.minX)),\(Int(f.minY)),\(Int(f.width)),\(Int(f.height))" }
    // D-3 CP4 (PO 2026-11-19): a band's testID is on the CONTENT inside its capped ScrollView, so its frame is the
    // content's (taller than the screen at large text). Its visible bottom is the bottom of the smallest ScrollView that
    // holds it, never below its own bottom.
    func holder(_ bandId: String) -> XCUIElement? {
      app.scrollViews.containing(.any, identifier: bandId).allElementsBoundByIndex.filter { $0.exists }.min(by: { $0.frame.height < $1.frame.height })
    }
    func visibleBottom(_ bandId: String) -> CGFloat {
      let band = element(bandId)
      return min(band.frame.maxY, holder(bandId)?.frame.maxY ?? band.frame.maxY)
    }
    func inside(_ id: String) {
      for e in app.descendants(matching: .any).matching(identifier: id).allElementsBoundByIndex where e.exists {
        let f = e.frame
        lines.append("\(id)=\(box(e)) hittable=\(e.isHittable)")
        // The approved correction (PO 2026-11-19): a band is judged by its visible capped bottom, not its content frame.
        let maxY = id.hasSuffix("-band") ? visibleBottom(id) : f.maxY
        XCTAssertTrue(f.minX >= -0.5 && f.maxX <= W + 0.5 && f.minY >= -0.5 && maxY <= H + 0.5, "\(tag): \(id) leaves the screen (\(box(e)), visible bottom \(Int(maxY)))")
      }
    }
    func railClearOfOverview(_ w: String) {
      let overview = element("qandeel-cosmos-overview")
      guard overview.exists else { return }
      let beads = app.buttons.allElementsBoundByIndex.filter { $0.exists && $0.frame.minX > W * 0.5 && $0.identifier.isEmpty }
      for b in beads where b.frame.intersects(overview.frame) {
        XCTFail("\(tag) \(w): the depth bead '\(b.label)' (\(box(b))) overlaps the Overview chip (\(box(overview)))")
      }
    }
    // D-3 CP4: the old share read the content frame, near zero where the screen showed 47 %; it reads the visible bottom.
    func share(_ w: String, _ bandId: String) {
      let band = element(bandId)
      guard band.exists else { return }
      let visible = visibleBottom(bandId)
      let bottoms = ["qandeel-global-switcher", "qandeel-cosmos-timeline-rail", "qandeel-cosmos-register"].compactMap { id -> CGFloat? in
        let e = element(id); return e.exists && e.frame.minY > visible ? e.frame.minY : nil
      }
      let clear = ((bottoms.min() ?? H) - visible) / H
      lines.append("\(w) band=\(box(band)) visible bottom=\(Int(visible)) clear map share=\(Int((clear * 100).rounded())) %")
      XCTAssertGreaterThanOrEqual(clear, 0.20, "\(tag) \(w): the clear map is near zero (\(Int(clear * 100)) %)")
    }
    shot("layout-\(tag)-conversation")
    for id in ["qandeel-depth-to-analysis", "qandeel-settings-entry", "qandeel-switcher-my_world", "qandeel-switcher-shared_world", "qandeel-switcher-public_world"] { inside(id) }
    for id in ["qandeel-switcher-my_world", "qandeel-switcher-shared_world", "qandeel-switcher-public_world"] {
      let e = element(id)
      XCTAssertTrue(e.exists && !e.label.isEmpty, "\(tag): the switcher destination \(id) has no word")
    }
    let t0 = now()
    waitFor("qandeel-depth-to-analysis", 30).tap()
    waitFor("qandeel-cosmos-timeline-rail", 60)
    lines.append("door -> Analysis (query): \(now() - t0) ms")
    settle(4)
    shot("layout-\(tag)-personal")
    for id in ["qandeel-cosmos-overview", "qandeel-depth-to-conversation", "qandeel-cosmos-timeline-rail"] { inside(id) }
    XCTAssertFalse(element("qandeel-cosmos-back").exists, "\(tag): Back is exposed at home")
    railClearOfOverview("personal")
    if enterShared("layout-\(tag)-s") != nil {
      shot("layout-\(tag)-shared")
      for id in ["qandeel-shared-band", "qandeel-shared-title", "qandeel-cosmos-overview"] { inside(id) }
      railClearOfOverview("shared")
      share("shared", "qandeel-shared-band")
    }
    if enterPublic("layout-\(tag)-u") != nil {
      shot("layout-\(tag)-public")
      for id in ["qandeel-public-band", "qandeel-public-search", "qandeel-cosmos-overview"] { inside(id) }
      railClearOfOverview("public")
      share("public", "qandeel-public-band")
      // D-3 CP4 (PO 2026-11-19): ONE focused interaction. A search below the band's fold must be reachable by scrolling the
      // band, and usable once reached: typed into, and closed by its own control. Nothing is done when it is already in view.
      let search = element("qandeel-public-search")
      if search.exists && !search.isHittable, let band = holder("qandeel-public-band") {
        var drags = 0
        while !search.isHittable && drags < 4 {
          let f = band.frame
          let from = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: f.midX, dy: f.minY + f.height * 0.8))
          let to = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: f.midX, dy: f.minY + f.height * 0.2))
          from.press(forDuration: 0.05, thenDragTo: to)
          drags += 1
          settle(1)
        }
        lines.append("public search below the fold: \(drags) band drag(s) -> \(box(search)) hittable=\(search.isHittable) visible bottom=\(Int(visibleBottom("qandeel-public-band")))")
        shot("layout-\(tag)-public-search-reached")
        XCTAssertTrue(search.isHittable, "\(tag): the Public search below the fold was not reached by scrolling the band")
        if search.isHittable {
          search.tap()
          // One key at a time, at a reader's pace: in run 44491423054 a burst typeText("ab") into the just-opened search
          // kept only "a" (its cause is measured separately on the baseline and the head).
          settle(1)
          for key in ["a", "b"] { search.typeText(key); settle(0.6) }
          let typed = (search.value as? String) ?? ""
          let close = element("qandeel-public-search-close")
          let closeSeen = close.waitForExistence(timeout: 5)
          lines.append("public search used: value=\(typed.contains("ab") ? "contains the typed text" : "'\(typed)'") close=\(closeSeen) hittable=\(closeSeen && close.isHittable)")
          shot("layout-\(tag)-public-search-used")
          XCTAssertTrue(typed.contains("ab"), "\(tag): the reached Public search did not take the typed text")
          XCTAssertTrue(closeSeen, "\(tag): the opened Public search shows no close control")
          if closeSeen && close.isHittable { close.tap(); settle(1) }
        }
      } else {
        lines.append("public search in view without scrolling: exists=\(search.exists) hittable=\(search.exists && search.isHittable)")
      }
    }
    note("layout-\(tag)", lines.joined(separator: "\n"))
  }
}
