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
// the labelled proof fixture's own name, in both languages.
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

  private func openLink(_ url: String) {
    app.open(URL(string: url)!)
    // iOS may ask before a link from outside the app opens it.
    let open = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons.matching(NSPredicate(format: "label == 'Open' OR label == 'فتح'")).firstMatch
    if open.waitForExistence(timeout: 4) { open.tap() }
    settle(2)
  }

  private func enterPersonal() -> XCUIElement {
    app.launch()
    waitFor("qandeel-conversation-thread", 180)
    waitFor("qandeel-depth-to-analysis", 30).tap()
    waitFor("qandeel-cosmos-timeline-rail", 60)
    settle(4)
    return waitFor(personalStage, 10)
  }

  private func enterShared() -> XCUIElement {
    app.launch()
    waitFor("qandeel-conversation-thread", 180)
    openLink("qandeel://s401-proof/shared-field/seed")
    waitFor("qandeel-switcher-shared_world", 30).tap()
    let fixture = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Fixture Map World' OR label CONTAINS 'عالم الخريطة الاختباري'")).firstMatch
    XCTAssertTrue(fixture.waitForExistence(timeout: 60), "the labelled Fixture Map World is not listed")
    fixture.tap()
    waitFor("qandeel-shared-band", 60)
    settle(5)
    return waitFor(sharedStage, 10)
  }

  private func enterPublic() -> XCUIElement {
    app.launch()
    waitFor("qandeel-conversation-thread", 180)
    openLink("qandeel://s401-proof/public/seed")
    waitFor("qandeel-switcher-public_world", 30).tap()
    openLink("qandeel://s401-proof/public/allow")
    waitFor("qandeel-public-search", 60)
    settle(5)
    return waitFor(publicStage, 10)
  }

  private var screen: CGRect { app.windows.firstMatch.frame }

  // ── Personal (D-1) ─────────────────────────────────────────────────────────────────────────────────────────────

  /// Focal anchoring, by a round trip at the first depth's content. A genuine double tap at f (open stage) steps IN
  /// about f; a two-finger pinch in about the stage's centre c steps OUT about c. One step is a factor of 8, so if both
  /// keep the world point under the fingers, every first-depth node ends moved by exactly (7/8)(c - f); if either does
  /// not, the shift differs. The shift is measured on the attached `trip-p-before` / `trip-p-after` screenshots.
  func testPersonalDoubleTapAndPinchStepAboutTheirFingers() {
    let stage = enterPersonal()
    let first = depth(personalStage)
    XCTAssertFalse(backAvailable(), "the stage was not at home before the double tap")
    let fx = (screen.width / 2).rounded(), fy = (screen.height * 0.24).rounded()
    let cx = stage.frame.midX.rounded(), cy = stage.frame.midY.rounded()
    note("trip-p-spec", "\(Int(fx)),\(Int(fy)),\(Int(cx)),\(Int(cy))")
    shot("trip-p-before")
    at(fx, fy).doubleTap()
    settle()
    let second = depth(personalStage)
    XCTAssertNotEqual(second, first, "a native double tap on open stage did not step IN")
    XCTAssertTrue(backAvailable(), "Back is not available after the double tap's step")
    stage.pinch(withScale: 0.4, velocity: -2)
    settle()
    shot("trip-p-after")
    XCTAssertEqual(depth(personalStage), first, "a native pinch in did not step OUT to the first depth")
    note("p-trip-depths", "\(first) -> double tap -> \(second) -> pinch in -> \(depth(personalStage))")
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

  /// A two-finger pinch out steps IN; a pan after it still moves the world (measured on `pan-p-before` / `pan-p-after`);
  /// a pinch in returns to the first depth.
  func testPersonalPinchStepsInAndThePanStillMovesTheWorld() {
    let stage = enterPersonal()
    let first = depth(personalStage)
    stage.pinch(withScale: 2.5, velocity: 2)
    settle()
    let second = depth(personalStage)
    XCTAssertNotEqual(second, first, "a native pinch out did not step IN")
    XCTAssertTrue(backAvailable(), "Back is not available after the pinch's step")
    // A drag on open stage below the depth rail.
    let from = CGPoint(x: (screen.width * 0.65).rounded(), y: (screen.height * 0.68).rounded())
    let to = CGPoint(x: from.x - 120, y: from.y)
    note("pan-p-spec", "\(Int(to.x - from.x)),\(Int(to.y - from.y))")
    shot("pan-p-before")
    at(from.x, from.y).press(forDuration: 0.05, thenDragTo: at(to.x, to.y))
    settle()
    shot("pan-p-after")
    XCTAssertEqual(depth(personalStage), second, "the pan changed the semantic depth")
    stage.pinch(withScale: 0.4, velocity: -2)
    settle()
    XCTAssertEqual(depth(personalStage), first, "a native pinch in did not step OUT to the first depth")
    note("p-pinch-depths", "\(first) -> pinch out -> \(second) -> pan -> pinch in -> \(depth(personalStage))")
  }

  // ── Shared and Public: the current depth bead passes its touch to the stage (PO 2026-11-18, item 3) ──────────

  /// At FAR, a tap on the current depth's word reaches the stage, whose FAR tap discloses Far -> Mid; Back returns.
  func testSharedTapOnTheCurrentDepthWordReachesTheStage() {
    _ = enterShared()
    wordTapReachesTheStage(sharedStage, "s")
  }

  func testPublicTapOnTheCurrentDepthWordReachesTheStage() {
    _ = enterPublic()
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

  /// A two-finger pinch out at FAR steps IN, and a pinch in returns to FAR (the Shared stage).
  func testSharedPinchStepsInAndOut() {
    let stage = enterShared()
    let first = depth(sharedStage)
    stage.pinch(withScale: 2.5, velocity: 2)
    settle()
    let second = depth(sharedStage)
    XCTAssertNotEqual(second, first, "a native pinch out did not step IN")
    stage.pinch(withScale: 0.4, velocity: -2)
    settle()
    XCTAssertEqual(depth(sharedStage), first, "a native pinch in did not step OUT")
    note("s-pinch-depths", "\(first) -> \(second) -> \(depth(sharedStage))")
  }
}
