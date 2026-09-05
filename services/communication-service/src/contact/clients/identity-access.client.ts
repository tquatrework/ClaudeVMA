import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AccountByLoginIdentifier {
  userId: string;
  role: string;
}

/**
 * Outbound HTTP client to identity-access-service's internal API (`X-Internal-Secret`).
 */
@Injectable()
export class IdentityAccessClient {
  private readonly logger = new Logger(IdentityAccessClient.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return this.config.getOrThrow<string>('IDENTITY_ACCESS_SERVICE_URL');
  }

  private headers(): Record<string, string> {
    return { 'X-Internal-Secret': this.config.getOrThrow<string>('INTERNAL_SECRET') };
  }

  /**
   * docs/routes.md > identity-access-service > API interne > GET /internal/accounts/by-login-identifier
   * Real contract confirmed empirically by identity-access-service against the real stack
   * (2026-09-04): success response is `{userId, role}` — no `loginIdentifier` field. Callers
   * must reuse the `loginIdentifier` they already passed as a search parameter, never read it
   * back from the response.
   */
  async findByLoginIdentifier(loginIdentifier: string): Promise<AccountByLoginIdentifier | null> {
    const url = new URL(`${this.baseUrl()}/internal/accounts/by-login-identifier`);
    url.searchParams.set('loginIdentifier', loginIdentifier);
    let response: Response;
    try {
      response = await fetch(url.toString(), { headers: this.headers() });
    } catch (error) {
      this.logger.warn(`identity-access-service call failed: ${error}`);
      throw new ServiceUnavailableException('identity-access-service injoignable');
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new ServiceUnavailableException('identity-access-service injoignable');
    return response.json();
  }
}
