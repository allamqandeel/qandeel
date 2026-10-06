/**
 * S5-03B — the Product Visual Review fixture (VALIDATION fixture guard).
 *
 * The S4-01 proof world answers the three Public field reads from the SYNTHETIC fixture `s503b-visual-field.ts` only after
 * `publicSeed()` (so every earlier device leg meets the field as before), and what it answers is what the production
 * strict client accepts — so a device render of the field cannot silently fall back to the unavailable state.
 */
import { PublicWorldApiClient } from '../../runtime-entry';
import { PUBLIC_FIELD_MAX_COORD, PUBLIC_FIELD_MIN_COORD } from '../../public-world/field/public-field-camera';
import { createS401ProofWorld } from '../__validation__/s401-proof-world';

const WHOLE = { minX: PUBLIC_FIELD_MIN_COORD, minY: PUBLIC_FIELD_MIN_COORD, maxX: PUBLIC_FIELD_MAX_COORD, maxY: PUBLIC_FIELD_MAX_COORD };

describe('S5-03B — the visual-review fixture of the proof world', () => {
  it('is off until public/seed, then answers field, search and panel as the strict client accepts', async () => {
    const world = createS401ProofWorld('ar');
    const client = new PublicWorldApiClient({ baseUrl: world.config.apiBaseUrl, fetch: world.fetch }).field;
    expect(await client.field(WHOLE)).toEqual({ kind: 'NO_ANSWER' });
    world.publicSeed();
    const field = await client.field(WHOLE);
    expect(field.kind).toBe('ANSWER');
    const entries = field.kind === 'ANSWER' ? field.value : [];
    expect(entries.length).toBeGreaterThanOrEqual(25);
    expect(new Set(entries.map((e) => e.region)).size).toBeGreaterThanOrEqual(5);
    const search = await client.search('الخوف');
    expect(search.kind === 'ANSWER' && search.value.length).toBeGreaterThan(0);
    const panel = await client.experience(entries[0].id);
    expect(panel.kind === 'ANSWER' && panel.value.kind).toBe('SERVED');
  });
});
