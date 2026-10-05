/**
 * VPORT-02 — the production P2 primitive layer for the Stage-2 surfaces that need it.
 *
 * Generated geometry (`p2-production.generated.ts`, from the merged P2-A package) and the Skia drawings that consume
 * it: the Temporal Spine + Aperture C "Parting" and the Live terminal, and the Call Rail A "Keyed Seam". The W1A-01
 * glyphs (send, the depth door, the back chevron) stay where W1A-01 put them, in `conversation/visual`, from the same
 * P2 source. S4-01 ports P2's navigation family (`NavGlyph`: navMine, navShared) for the first production Global
 * Switcher, the surface that uses it; navPublic waits for a Public World destination.
 *
 * A3-01 adds the two P3 members P3 §5 freezes — Open Ledger (the Activity entry) and Open Link (the Introductions row
 * source mark) — generated the same way from the merged P3-A package (`p3-production.generated.ts`).
 */
export { P2_CALL_GLYPHS, P2_CALL_RAIL, P2_SPINE } from './p2-production.generated';
export type { ApertureProps, LiveTerminalProps } from './TemporalMachine';
export { Aperture, LiveTerminal } from './TemporalMachine';
export type { SpineInput, SpineNotch, SpinePresentation } from './spine';
export { spinePresentation } from './spine';
export type { SpineLayerProps } from './SpineLayer';
export { SpineLayer } from './SpineLayer';
export type { CallRailLabels, CallRailProps } from './CallRail';
export { CALL_RAIL_MORPH_MS, CALL_RAIL_TEST_ID, CallRail } from './CallRail';
export { P3_GLYPHS } from './p3-production.generated';
export type { P3GlyphName, P3GlyphProps } from './P3Glyph';
export { P3Glyph } from './P3Glyph';
// S4-01 — the first production Global Switcher carries P2's navigation family (navMine, navShared; navPublic is not
// emitted until a Public World destination exists).
export { P2_NAV_GLYPHS } from './p2-production.generated';
export type { NavGlyphName, NavGlyphProps } from './NavGlyph';
export { NavGlyph } from './NavGlyph';
