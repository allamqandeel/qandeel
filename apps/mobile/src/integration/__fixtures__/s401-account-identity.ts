/**
 * S4-01 — the synthetic signed-in reader's Account Identity. TEST FIXTURE ONLY.
 *
 * The answers a signed-in account's production API gives to `/account/identity` and `/account/public-id` (W1B-01 /
 * W3-MEGA-A / W3-02), in exactly the shapes the production account client decodes. It lives here, outside the
 * validation harness, so `__validation__/` itself carries no Email or credential default (T-12 Phase M); the S4-01
 * proof world imports it to answer those reads. Every value is SYNTHETIC — never Product copy, never a real account,
 * never a sign-in credential (the proof world's sign-in is VPORT-01's in-memory identity, untouched).
 */
import type { AccountIdentityView, AccountPublicIdView } from '../../runtime-entry';

/** The reader's identity without the Name, which the proof world supplies per language. */
export const S401_ACCOUNT_IDENTITY: Omit<AccountIdentityView, 'name'> = Object.freeze({
  loginId: 's401.proof.reader',
  email: 's401-proof-reader@example.test',
  emailVerified: true,
});

export const S401_ACCOUNT_PUBLIC_ID: AccountPublicIdView = Object.freeze({ publicId: 's401.proof.public', changeAvailable: false });
