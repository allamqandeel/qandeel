import { Body, ConflictException, Controller, HttpCode, Post, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { LoginIdSignInService } from './login-id-sign-in.service';

/**
 * W2-01 — `POST /account/login-id-sign-in`, the one pre-authentication credential route.
 *
 * The Login ID and the password travel in the body, never a URL. Every answer is a fixed shape that
 * names an outcome and nothing else:
 *
 *   200  { accessToken, refreshToken }           the provider accepted the password
 *   401  { outcome: 'INVALID_CREDENTIALS' }      unknown Login ID, malformed Login ID, wrong password — one answer
 *   409  { outcome: 'EMAIL_NOT_CONFIRMED', email } the password was PROVED; the reader's own Email awaits verification
 *   503  { outcome: 'UNAVAILABLE' }              no usable provider answer, or the route is not configured
 *   400  { outcome: 'INVALID_REQUEST' }          not exactly one bounded Login ID and one password
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
        throw new ConflictException({ outcome: 'EMAIL_NOT_CONFIRMED', email: outcome.email });
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
}
