import { Body, ConflictException, Controller, HttpCode, Post, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { LoginIdSignInService } from './login-id-sign-in.service';

/**
 * W2-01 — the pre-authentication Login ID routes. The Login ID, the password and the code travel in the
 * body, never a URL. Every answer is a fixed shape that names an outcome and nothing else — and never an
 * Email, a masked Email or an account id (P1 §3, W2-01 R1: including after the password was proved).
 *
 * `POST /account/login-id-sign-in` — `{ loginId, password }`
 *   200  { accessToken, refreshToken }           the provider accepted the password
 *   401  { outcome: 'INVALID_CREDENTIALS' }      unknown Login ID, malformed Login ID, wrong password — one answer
 *   409  { outcome: 'EMAIL_NOT_CONFIRMED' }      the password was PROVED; the account's Email awaits verification
 *   503  { outcome: 'UNAVAILABLE' }              no usable provider answer, or the route is not configured
 *   400  { outcome: 'INVALID_REQUEST' }          not exactly one bounded Login ID and one password
 *
 * W2-01 R1 — `POST /account/login-id-verify-email` — `{ loginId, code }`
 *   200  { accessToken, refreshToken }           the provider verified the code
 *   401  { outcome: 'CODE_REJECTED' }            wrong, expired, or no such Login ID — one answer
 *   503  { outcome: 'UNAVAILABLE' }
 *   400  { outcome: 'INVALID_REQUEST' }          not exactly one bounded Login ID and one 6-digit code
 *
 * W2-01 R1 — `POST /account/login-id-resend-verification` — `{ loginId }`
 *   200  { outcome: 'ACCEPTED' }                 the provider answered — whatever it answered, for any Login ID
 *   503  { outcome: 'UNAVAILABLE' }              no answer at all, or the route is not configured
 *   400  { outcome: 'INVALID_REQUEST' }
 */
@Controller('account')
export class LoginIdSignInController {
  constructor(private readonly signIn: LoginIdSignInService) {}

  @Post('login-id-sign-in')
  @HttpCode(200)
  async signInWithLoginId(@Body() body: unknown, @Req() request: { readonly ip?: string }) {
    const outcome = await this.signIn.exchange(body, request.ip);
    switch (outcome.kind) {
      case 'SESSION':
        return { accessToken: outcome.accessToken, refreshToken: outcome.refreshToken };
      case 'EMAIL_NOT_CONFIRMED':
        throw new ConflictException({ outcome: 'EMAIL_NOT_CONFIRMED' });
      case 'INVALID_CREDENTIALS':
        throw new UnauthorizedException({ outcome: 'INVALID_CREDENTIALS' });
      case 'UNAVAILABLE':
        throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  @Post('login-id-verify-email')
  @HttpCode(200)
  async verifyLoginIdEmail(@Body() body: unknown, @Req() request: { readonly ip?: string }) {
    const outcome = await this.signIn.verifyEmail(body, request.ip);
    switch (outcome.kind) {
      case 'SESSION':
        return { accessToken: outcome.accessToken, refreshToken: outcome.refreshToken };
      case 'CODE_REJECTED':
        throw new UnauthorizedException({ outcome: 'CODE_REJECTED' });
      case 'UNAVAILABLE':
        throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  @Post('login-id-resend-verification')
  @HttpCode(200)
  async resendLoginIdVerification(@Body() body: unknown, @Req() request: { readonly ip?: string }) {
    const outcome = await this.signIn.resendVerification(body, request.ip);
    if (outcome.kind === 'UNAVAILABLE') throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' });
    return { outcome: 'ACCEPTED' };
  }
}
