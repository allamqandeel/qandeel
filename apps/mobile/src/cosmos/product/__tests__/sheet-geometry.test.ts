/**
 * COSMOS-INT-01 Slice D (Contract v1.5 §19.3 / §19.7) — the Detail Sheet's geometry and its snap decision. Deterministic:
 * every case names its travel and its velocity, so the PO's gesture amendment is read as numbers — a small fast motion
 * never changes the phase, a slow deliberate drag does, velocity only assists, and a long drag continues.
 */
import {
  SHEET_ASSIST_MAX_SHARE, SHEET_DELIBERATE_MIN, SHEET_HANDLE_HEIGHT, SHEET_PEEK_MAX, clampOffset, dragOffset, keyboardLift, keyboardOverlap, keyboardTopOf, rubberband, sheetGeometry, sheetOffset, sheetStops, snapPhase,
  type SheetGeometry, type SheetPhase,
} from '../sheet/sheet-geometry';

const ROOM = 700;
const INSET = 34;
/** A long content: PEEK = 156 + 34 = 190; EXPANDED ↔ PEEK gap = 510 (40 % = 204); PEEK ↔ CLOSED gap = 190 (50 % = 95). */
const LONG = sheetGeometry(ROOM, 1200, INSET);
const ALL = sheetStops(LONG, true);
const snap = (from: SheetPhase, travel: number, velocity: number, geometry: SheetGeometry = LONG, stops = ALL) => snapPhase({ from, travel, velocity, geometry, stops });

describe('sheet geometry', () => {
  it('a short content is shown whole in PEEK and has no EXPANDED stop', () => {
    const short = sheetGeometry(ROOM, 100, INSET);
    expect(short).toEqual({ room: ROOM, peek: SHEET_HANDLE_HEIGHT + 100, overflows: false });
    expect(sheetStops(short, true)).toEqual(['PEEK', 'CLOSED']);
  });

  it('a long content peeks at the accepted card height above the inset and overflows into EXPANDED', () => {
    expect(LONG).toEqual({ room: ROOM, peek: SHEET_PEEK_MAX + INSET, overflows: true });
    expect(ALL).toEqual(['EXPANDED', 'PEEK', 'CLOSED']);
    expect([sheetOffset('EXPANDED', LONG), sheetOffset('PEEK', LONG), sheetOffset('CLOSED', LONG)]).toEqual([0, ROOM - 190, ROOM]);
  });

  it('a world that allows PEEK only (Personal, G-7) never offers EXPANDED, however long the content', () => {
    expect(sheetStops(LONG, false)).toEqual(['PEEK', 'CLOSED']);
    expect(snap('PEEK', -600, -3000, LONG, sheetStops(LONG, false))).toBe('PEEK');
  });

  it('the PEEK never exceeds the room, and a negative measure is no content', () => {
    expect(sheetGeometry(120, 1200, INSET).peek).toBe(120);
    expect(sheetGeometry(ROOM, -50, INSET).peek).toBe(SHEET_HANDLE_HEIGHT);
  });
});

describe('the snap decision — distance leads', () => {
  it('a travel under the deliberate minimum keeps the phase, at any velocity (no accidental flick)', () => {
    for (const v of [0, 600, 3000, 9000]) {
      expect(snap('PEEK', SHEET_DELIBERATE_MIN - 0.1, v)).toBe('PEEK');
      expect(snap('PEEK', -(SHEET_DELIBERATE_MIN - 0.1), -v)).toBe('PEEK');
      expect(snap('EXPANDED', SHEET_DELIBERATE_MIN - 0.1, v)).toBe('EXPANDED');
    }
  });

  it('a slow deliberate drag past the share reaches the adjacent phase; short of it, it springs back', () => {
    expect(snap('PEEK', -205, 0)).toBe('EXPANDED');
    expect(snap('PEEK', -203, 0)).toBe('PEEK');
    expect(snap('EXPANDED', 205, 0)).toBe('PEEK');
    expect(snap('EXPANDED', 203, 0)).toBe('EXPANDED');
  });

  it('closing asks for half the PEEK, not 40 %', () => {
    expect(snap('PEEK', 96, 0)).toBe('CLOSED');
    expect(snap('PEEK', 80, 0)).toBe('PEEK');
  });

  it('one long deliberate drag continues through PEEK: EXPANDED → CLOSED needs the whole first gap and half the next', () => {
    expect(snap('EXPANDED', 600, 0)).toBe('PEEK');
    expect(snap('EXPANDED', 510 + 96, 0)).toBe('CLOSED');
    expect(snap('EXPANDED', 2000, 0)).toBe('CLOSED');
    expect(snap('PEEK', -2000, 0)).toBe('EXPANDED');
  });
});

describe('the snap decision — velocity only assists a deliberate drag', () => {
  it('a fast small motion past the minimum cannot change the phase: its credit is capped at a quarter of the gap', () => {
    // 30 pt + min(5000 × 0.1, 0.25 × 510 = 127.5) = 157.5 < 204.
    expect(snap('PEEK', -30, -5000)).toBe('PEEK');
    // 30 pt + min(500, 0.25 × 190 = 47.5) = 77.5 < 95.
    expect(snap('PEEK', 30, 5000)).toBe('PEEK');
    expect(SHEET_ASSIST_MAX_SHARE).toBe(0.25);
  });

  it('a deliberate drag that is a little short is carried by a real release velocity in its direction', () => {
    // 150 + min(80, 127.5) = 230 ≥ 204.
    expect(snap('PEEK', -150, -800)).toBe('EXPANDED');
    // 80 + min(70, 47.5) = 127.5 ≥ 95.
    expect(snap('PEEK', 80, 700)).toBe('CLOSED');
    // Under the assist speed there is no credit.
    expect(snap('PEEK', -150, -599)).toBe('PEEK');
  });

  it('a release velocity against the drag keeps the starting phase', () => {
    expect(snap('PEEK', 150, -700)).toBe('PEEK');
    expect(snap('PEEK', -400, 700)).toBe('PEEK');
    expect(snap('EXPANDED', 600, -900)).toBe('EXPANDED');
  });

  it('the credit applies to the first gap only, so a flick never skips a phase', () => {
    expect(snap('EXPANDED', 300, 9000)).toBe('PEEK');
    expect(snap('EXPANDED', 510 + 30, 9000)).toBe('PEEK');
  });
});

describe('the snap decision — the edges', () => {
  it('a phase the geometry no longer allows settles at the highest phase that remains', () => {
    const short = sheetGeometry(ROOM, 100, INSET);
    expect(snap('EXPANDED', 0, 0, short, sheetStops(short, true))).toBe('PEEK');
  });

  it('a non-finite travel keeps the phase; a non-finite velocity is no velocity', () => {
    expect(snap('PEEK', Number.NaN, 4000)).toBe('PEEK');
    expect(snap('PEEK', -205, Number.NaN)).toBe('EXPANDED');
  });

  it('a dragged offset never rises above the highest stop or below the room', () => {
    expect(clampOffset(-80, LONG, ALL)).toBe(0);
    expect(clampOffset(-80, LONG, sheetStops(LONG, false))).toBe(ROOM - 190);
    expect(clampOffset(ROOM + 300, LONG, ALL)).toBe(ROOM);
  });

  it('the keyboard overlap is the part of the sheet below the keyboard, never negative', () => {
    expect(keyboardOverlap(800, 500)).toBe(300);
    expect(keyboardOverlap(400, 500)).toBe(0);
    expect(keyboardOverlap(800, null)).toBe(0);
  });

  // COSMOS E-2 final corrections (PO 2026-11-21 §7): on the Android 16 emulator (1080 x 2400 px at 2.625, gesture
  // navigation 63 px = 24 dp) React Native reported the keyboard's top at 1582 px while the keyboard began at 1518 px; the
  // PEEK lifted to 1582 kept its topic-name field and Save under the keyboard. The top is derived from the reported height.
  it("the keyboard's top is the higher of the reported top and the window bottom less the keyboard and the inset", () => {
    const dp = (px: number) => px / 2.625;
    // Emulator: screenY 1582 px, height = IME 882 px less the 63 px bar = 819 px, window bottom 2400 px, inset 24 dp.
    expect(keyboardTopOf(dp(1582), dp(819), dp(2400), 24)).toBeCloseTo(dp(1518), 6);
    // A device whose reported top is already exact keeps it.
    expect(keyboardTopOf(500, 276, 800, 24)).toBe(500);
    expect(keyboardTopOf(Number.NaN, 276, 800, 24)).toBe(500);
    expect(keyboardTopOf(500, 0, 800, 24)).toBe(500);
    expect(keyboardTopOf(Number.NaN, 0, 800, 24)).toBeNull();
    // End to end on the emulator: the field row's bottom (1582 px) now clears the keyboard (1518 px).
    const overlap = keyboardOverlap(dp(2400), keyboardTopOf(dp(1582), dp(819), dp(2400), 24));
    expect(overlap - 24).toBeCloseTo(dp(2400 - 1518) - 24, 6);
    expect(keyboardOverlap(dp(2400), dp(1582)) - 24).toBeLessThan(overlap - 24);
  });

  // COSMOS E-2 HONOR acceptance (PO decision 2026-11-20, DEFECT-4): the keyboard lifts a PEEK, and only a PEEK.
  it('the keyboard lifts a PEEK by its overlap less the bottom inset, never above the top band', () => {
    const peek = sheetGeometry(ROOM, 120, INSET);
    expect(keyboardLift('PEEK', 300, INSET, peek)).toBe(300 - INSET);
    expect(keyboardLift('PEEK', 20, INSET, peek)).toBe(0);
    expect(keyboardLift('PEEK', 0, INSET, peek)).toBe(0);
    // A keyboard taller than the room beneath the PEEK stops the PEEK at the band.
    expect(keyboardLift('PEEK', ROOM * 2, INSET, peek)).toBe(sheetOffset('PEEK', peek));
  });

  it('an EXPANDED or CLOSED sheet is not lifted (EXPANDED keeps its keyboard spacer)', () => {
    expect(keyboardLift('EXPANDED', 300, INSET, LONG)).toBe(0);
    expect(keyboardLift('CLOSED', 300, INSET, LONG)).toBe(0);
  });
});

describe('the drag edge (rubber band)', () => {
  it('past the highest stop the sheet follows less and less, and never jumps', () => {
    const a = dragOffset(-20, LONG, ALL);
    const b = dragOffset(-200, LONG, ALL);
    expect(a).toBeLessThan(0);
    expect(b).toBeLessThan(a);
    expect(-b).toBeLessThan(200 * 0.55);
    expect(dragOffset(0, LONG, ALL)).toBe(0);
    expect(rubberband(0, ROOM)).toBe(0);
  });

  it('between the stops it follows the finger exactly, and it never goes below the room', () => {
    expect(dragOffset(300, LONG, ALL)).toBe(300);
    expect(dragOffset(ROOM + 50, LONG, ALL)).toBe(ROOM);
    // A world without EXPANDED resists above its PEEK.
    expect(dragOffset(ROOM - 190 - 40, LONG, sheetStops(LONG, false))).toBeGreaterThan(ROOM - 190 - 40);
  });
});
