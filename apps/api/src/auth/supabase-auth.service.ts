import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

interface SupabaseUserResponse {
  id?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class SupabaseAuthService {
  async authenticate(authorization: string | undefined): Promise<{ userId: string; accessToken: string }> {
    const accessToken = this.readBearerToken(authorization);
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!baseUrl || !publishableKey) {
      throw new ServiceUnavailableException('Authentication service is not configured.');
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/auth/v1/user`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('Authentication service is unavailable.');
    }
    if (!response.ok) throw new UnauthorizedException('Invalid access token.');

    const payload = (await response.json().catch(() => null)) as SupabaseUserResponse | null;
    if (typeof payload?.id !== 'string' || !UUID_PATTERN.test(payload.id)) {
      throw new UnauthorizedException('Invalid authenticated identity.');
    }
    return { userId: payload.id, accessToken };
  }

  private readBearerToken(authorization: string | undefined): string {
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/iu);
    if (!match) throw new UnauthorizedException('Bearer access token is required.');
    return match[1];
  }
}
