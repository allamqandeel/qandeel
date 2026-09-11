/**
 * T-12 — deriving T-05's disclosed Track from the ONE projection this reader holds.
 *
 * T-05 owns the Track's geometry and its rules; T-06 owns what may be targeted on it. Neither
 * fetches, and neither knows where the disclosed Moments come from — the Track is handed to them.
 * This is the hand-off, and it is a translation and nothing more: Session Positions in, Session
 * Positions out, no reordering, no filtering, no inference and no addition.
 *
 * ## Why the Track needs its own request
 *
 * A disclosure discloses the rungs down to the depth it was asked for, and the Moments live on the
 * SESSION rung. The Map asks at the camera's own rung, which at `WORLD` withholds that rung entirely
 * — so a Track derived from the Map's disclosure would be empty whenever the reader is looking at the
 * world, which is most of the time. The temporal surface therefore has its own request at the same
 * Session and the same effective `TC`, differing only in depth. Both live in the one cache, whose key
 * already includes depth, so this adds a KEY rather than a cache.
 *
 * ## Withheld is not empty, and not-fetched is not empty either
 *
 * `null` is returned for both, and the caller leaves the Track it already has alone rather than
 * replacing it with an empty one. That distinction is the whole point: an empty Track asserts that
 * this reader has been disclosed no Moment, and neither "we have not asked yet" nor "this depth did
 * not include that rung" is evidence of that. The genuinely empty Track — a brand-new Session with
 * nothing committed — comes back as an empty DISCLOSED rung and is passed through as the empty Track
 * it is, which T-05 accepts as valid.
 */

import type { HistoricalDisclosureEntry } from '../../projection';
import { sessionPosition } from '../../state';
import { disclosedTrack, type DisclosedTrack } from '../../timeline';

/** The depth at which the disclosed Moments are disclosed. */
export const TIMELINE_TRACK_DEPTH = 'SESSION' as const;

/**
 * The Track this entry discloses, or `null` when it discloses none.
 *
 * `null` means "leave the Track alone", never "there are no Moments".
 */
export function trackFromDisclosure(entry: HistoricalDisclosureEntry): DisclosedTrack | null {
  if (entry.status !== 'FETCHED') return null;
  const rung = entry.value.session;
  if (rung.status !== 'DISCLOSED') return null;
  try {
    return disclosedTrack(
      entry.value.sessionId,
      rung.value.moments.map((moment) => ({ sessionPosition: sessionPosition(moment.sp) })),
    );
  } catch {
    // T-05 refuses anything that is not the complete SP1-anchored contiguous prefix, and the wire
    // decoder already refuses an incoherent family upstream — so this is unreachable in practice and
    // is caught rather than thrown because a malformed payload must not take the surface down. No
    // Track is produced, which leaves the previous one standing and claims nothing new.
    return null;
  }
}
