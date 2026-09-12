/**
 * T-14 — the Product sign-in gateway's whole public surface.
 *
 * It is an INTEGRATION Product surface that consumes the frozen auth owner. It is not the auth owner
 * and it does not become one: nothing in this directory constructs a client, holds a storage, or
 * decides anything about identity. T-12P's `runtime-entry/auth/` remains the owner, reached only
 * through its barrel, exactly as every other owner is.
 *
 * An allowlist, like every other barrel in this layer — never a wildcard.
 */

export type { ProductSignInGatewayProps } from './ProductSignInGateway';
export {
  PRODUCT_SIGN_IN_GATEWAY_TEST_ID,
  ProductSignInGateway,
  SIGN_IN_EMAIL_TEST_ID,
  SIGN_IN_NOTICE_TEST_ID,
  SIGN_IN_PASSWORD_TEST_ID,
  SIGN_IN_SUBMIT_TEST_ID,
  SIGN_IN_TITLE_TEST_ID,
} from './ProductSignInGateway';

export type { ProductSignInCopy, SignInFailureKind } from './product-sign-in-copy';
export { clearsPasswordAfter, productSignInCopy, signInFailureMessage } from './product-sign-in-copy';
