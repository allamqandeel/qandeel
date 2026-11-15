/**
 * MAP-CLOSE-01 CA-O1 (Product Owner, 2026-11-14): the opening composition is exactly what it was; only after the reader's
 * first act does a change of the band below the world leave the world where it is.
 */
import { render } from '@testing-library/react-native';

import { WORLD_ORIGIN, envelopeCenter, useSteadyEnvelope, viewportEnvelope, type SteadyEnvelopeCamera, type ViewportEnvelope } from '../camera';
import { canonicalWorldAddress } from '../world';

const glass = (height: number): ViewportEnvelope => {
  const envelope = viewportEnvelope(390, height, { top: 88 });
  if (envelope === null) throw new Error('no envelope');
  return envelope;
};
const elsewhere = (() => {
  const address = canonicalWorldAddress(WORLD_ORIGIN.x + 1000n, WORLD_ORIGIN.y);
  if (!address.ok) throw new Error('no address');
  return address.address;
})();

describe('CA-O1 — holding starts with the reader\'s first act', () => {
  it('while the screen composes, the anchor is the glass\'s centre; after an act, a band change moves nothing', async () => {
    const seen: number[] = [];
    function Probe({ envelope, camera }: { readonly envelope: ViewportEnvelope; readonly camera: SteadyEnvelopeCamera }) {
      seen.push(envelopeCenter(useSteadyEnvelope(envelope, camera)).y);
      return null;
    }
    const world: SteadyEnvelopeCamera = { anchor: WORLD_ORIGIN, depth: 'WORLD' };
    const view = await render(<Probe envelope={glass(452)} camera={world} />);
    // The opening layout settles in two passes (measured on the phone: 452, then 523): both are composed from the centre.
    await view.rerender(<Probe envelope={glass(523)} camera={world} />);
    expect(seen.at(-1)).toBe(88 + (523 - 88) / 2);
    // The reader zooms in; then the return acts appear and the band takes 28 points.
    const zoomed: SteadyEnvelopeCamera = { anchor: elsewhere, depth: 'THREAD' };
    await view.rerender(<Probe envelope={glass(523)} camera={zoomed} />);
    await view.rerender(<Probe envelope={glass(495)} camera={zoomed} />);
    expect(seen.at(-1)).toBe(88 + (523 - 88) / 2);
    await view.unmount();
  });
});
