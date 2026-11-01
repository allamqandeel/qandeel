import { GoogleAuth } from 'google-auth-library';
import { VERTEX_SPEECH_SCOPE } from './vertex-speech.config';

/**
 * S8B-04 (CP1) — the access token for one Vertex request. Application Default Credentials ONLY (VA-11R): no API key, no
 * key file named here, nothing read from a client. The token lives in memory for the one request; it is never logged,
 * returned, stored or put in an error.
 */
export interface AccessTokenSource {
  accessToken(): Promise<string>;
}

export class AdcAccessTokenSource implements AccessTokenSource {
  private readonly auth = new GoogleAuth({ scopes: [VERTEX_SPEECH_SCOPE] });

  async accessToken(): Promise<string> {
    const token = await this.auth.getAccessToken();
    if (typeof token !== 'string' || token.length < 20) throw new Error('VERTEX_SPEECH_NO_CREDENTIALS');
    return token;
  }
}
