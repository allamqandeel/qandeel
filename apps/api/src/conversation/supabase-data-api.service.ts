import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export class DataApiError extends Error {
  constructor(readonly status: number) {
    super(`Data API request failed with status ${status}.`);
  }
}

@Injectable()
export class SupabaseDataApiService {
  async request<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!baseUrl || !publishableKey) {
      throw new ServiceUnavailableException('Conversation persistence is not configured.');
    }
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('Conversation persistence is unavailable.');
    }
    if (!response.ok) throw new DataApiError(response.status);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
