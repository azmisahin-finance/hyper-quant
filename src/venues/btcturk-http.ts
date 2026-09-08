import type { VenueTransport } from './types.js';

export class FetchVenueTransport implements VenueTransport {
  constructor(private readonly baseUrl = 'https://api.btcturk.com', private readonly fetchImpl: typeof fetch = fetch) {}

  async request<T>(input: { method: string; pathWithQuery: string; body?: unknown; headers?: Readonly<Record<string, string>> }): Promise<{ status: number; body: T }> {
    const response = await this.fetchImpl(`${this.baseUrl}${input.pathWithQuery}`, {
      method: input.method,
      headers: { 'Content-Type': 'application/json', ...(input.headers ?? {}) },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
    let body: T;
    try {
      body = (await response.json()) as T;
    } catch (error) {
      throw new Error(`VENUE_INVALID_JSON:${response.status}:${error instanceof Error ? error.message : 'unknown'}`);
    }
    if (!response.ok) throw new Error(`VENUE_HTTP_ERROR:${response.status}`);
    return { status: response.status, body };
  }
}
