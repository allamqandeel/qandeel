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

  private func toConversation() {
    app.launch()
    waitFor("qandeel-conversation-thread", 180)
  }

  private func enterPersonal() -> XCUIElement {
    toConversation()
    waitFor("qandeel-depth-to-analysis", 30).tap()
    waitFor("qandeel-cosmos-timeline-rail", 60)
    settle(4)
    return waitFor(personalStage, 10)
  }

  /// The labelled Fixture Map World, seeded by its proof link. The system route (the one `simctl openurl` takes) goes
  /// first; the app route is the run-44289175909 route, kept to record whether it ever seeds. The route that worked is noted.
  private func enterShared(_ tag: String) -> XCUIElement? {
    for route in ["system", "app"] {
      toConversation()
      openLink("qandeel://s401-proof/shared-field/seed", via: route, "\(tag)-\(route)-seed")
      waitFor("qandeel-switcher-shared_world", 30).tap()
      let fixture = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Fixture Map World' OR label CONTAINS 'عالم الخريطة الاختباري'")).firstMatch
      if fixture.waitForExistence(timeout: 30) {
        note("\(tag)-entry", "the Fixture Map World was listed after the \(route) route")
        fixture.tap()
        waitFor("qandeel-shared-band", 60)
        settle(5)
        return waitFor(sharedStage, 10)
      }
      shot("\(tag)-\(route)-not-listed")
      note("\(tag)-entry-\(route)", "the \(route) route did not seed the Fixture Map World")
    }
    XCTFail("the labelled Fixture Map World is not listed after either link route")
    return nil
  }

  private func enterPublic(_ tag: String) -> XCUIElement? {
    for route in ["system", "app"] {
      toConversation()
      openLink("qandeel://s401-proof/public/seed", via: route, "\(tag)-\(route)-seed")
      waitFor("qandeel-switcher-public_world", 30).tap()
      openLink("qandeel://s401-proof/public/allow", via: route, "\(tag)-\(route)-allow")
      if element("qandeel-public-search").waitForExistence(timeout: 45) {
        note("\(tag)-entry", "the Public World opened after the \(route) route")
        settle(5)
        return waitFor(publicStage, 10)
      }
      shot("\(tag)-\(route)-not-open")
      note("\(tag)-entry-\(route)", "the \(route) route did not open the Public World")
    }
    XCTFail("the Public World did not open after either link route")
    return nil
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

  /// A two-finger pinch opening steps IN; a pan after it still moves the world (measured on `pan-p-before` /
  /// `pan-p-after`, which must show node cores: if the step landed in an empty region, "Go to the nearest" — the
  /// product's own control for exactly that — brings content before the pan); a pinch closing returns to the first depth.
  func testPersonalPinchStepsInAndThePanStillMovesTheWorld() throws {
    _ = enterPersonal()
    let first = depth(personalStage)
    let c = CGPoint(x: (screen.width * 0.40).rounded(), y: (screen.height * 0.68).rounded())
    try pinch("pan-p-pinch-in", about: c, from: CGVector(dx: 14, dy: 0), to: CGVector(dx: 90, dy: 0))
    settle()
    let second = depth(personalStage)
    XCTAssertNotEqual(second, first, "a native two-finger pinch opening did not step IN")
    XCTAssertTrue(backAvailable(), "Back is not available after the pinch's step")
    if element("qandeel-cosmos-nearest").exists {
      let nearest = app.buttons.matching(NSPredicate(format: "label == 'Go to the nearest' OR label == 'اذهب إلى الأقرب'")).firstMatch
      if nearest.exists { nearest.tap(); settle(); note("pan-p-nearest", "the step landed in an empty region; Go to the nearest brought content") }
    }
    XCTAssertEqual(depth(personalStage), second, "Go to the nearest changed the semantic depth")
    // A drag on open stage below the depth rail and above the timeline.
    let from = CGPoint(x: (screen.width * 0.65).rounded(), y: (screen.height * 0.68).rounded())
    let to = CGPoint(x: from.x - 120, y: from.y)
    note("pan-p-spec", "\(Int(to.x - from.x)),\(Int(to.y - from.y))")
    shot("pan-p-before")
    at(from.x, from.y).press(forDuration: 0.05, thenDragTo: at(to.x, to.y))
    settle()
    shot("pan-p-after")
    XCTAssertEqual(depth(personalStage), second, "the pan changed the semantic depth")
    try pinch("pan-p-pinch-out", about: c, from: CGVector(dx: 90, dy: 0), to: CGVector(dx: 14, dy: 0))
    settle()
    note("p-pinch-depths", "\(first) -> pinch opening -> \(second) -> pan -> pinch closing -> \(depth(personalStage))")
    XCTAssertEqual(depth(personalStage), first, "a native two-finger pinch closing did not step OUT to the first depth")
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
}
