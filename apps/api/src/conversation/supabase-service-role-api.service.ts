import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from './supabase-data-api.service';

// Explicit, server-only privileged channel for conversation authority commands
// (claim / finalize / fail). It uses SUPABASE_SERVICE_ROLE_KEY and NEVER accepts
// a caller-supplied user token, so a server command can never be executed with a
// client credential. It fails closed when server authority is not configured
// rather than falling back to authenticated-client authority.
@Injectable()
export class SupabaseServiceRoleApiService {
  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRoleKey) {
      throw new ServiceUnavailableException('Server conversation authority is not configured.');
    }
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('Server conversation authority is unavailable.');
    }
    if (!response.ok) throw new DataApiError(response.status);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
