import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IdentityAccount {
  userId: string;
  loginIdentifier: string;
  role: string;
}

/** Thrown when identity-access-service returns a 404 for the given lookup. */
export class IdentityAccessNotFoundError extends Error {}

/**
 * Thrown when identity-access-service cannot be reached, times out, or
 * returns an unexpected non-2xx/404 status.
 */
export class IdentityAccessUnavailableError extends Error {}

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Typed adapter for interservice calls to identity-access-service
 * (services-convention: "les appels interservices passent par des
 * clients/adaptateurs typés avec timeout, correlation ID, politique
 * d'erreur et idempotence"). Both lookups are read-only, hence naturally
 * idempotent.
 *
 * The client normalizes transport-level outcomes into a small typed error
 * taxonomy (IdentityAccessNotFoundError / IdentityAccessUnavailableError);
 * how a caller reacts to each (fail loudly vs degrade gracefully) is a
 * business decision that stays in the consuming service.
 *
 * correlationId is accepted and forwarded as X-Correlation-Id when the
 * caller has one available. Propagating the inbound request's
 * x-correlation-id automatically (via an interceptor/AsyncLocalStorage) is
 * not wired yet — see docs/services/profile-service.md, "points en
 * suspens".
 */
@Injectable()
export class IdentityAccessClient {
  private readonly logger = new Logger(IdentityAccessClient.name);

  constructor(private readonly configService: ConfigService) {}

  async findAccountByUserId(userId: string, correlationId?: string): Promise<IdentityAccount> {
    return this.fetchAccount(`/internal/accounts/by-user-id/${userId}`, correlationId);
  }

  async findAccountByLoginIdentifier(
    loginIdentifier: string,
    correlationId?: string,
  ): Promise<IdentityAccount> {
    return this.fetchAccount(
      `/internal/accounts/by-login-identifier?loginIdentifier=${encodeURIComponent(loginIdentifier)}`,
      correlationId,
    );
  }

  private async fetchAccount(path: string, correlationId?: string): Promise<IdentityAccount> {
    const identityServiceUrl = this.configService.get<string>(
      'IDENTITY_ACCESS_SERVICE_URL',
      'http://identity-access-service:3001',
    );
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET', '');

    let response: Response;
    try {
      response = await fetch(`${identityServiceUrl}${path}`, {
        method: 'GET',
        headers: {
          'X-Internal-Secret': internalSecret,
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (networkError) {
      this.logger.warn(
        `Impossible de joindre identity-access-service (${path}) : ${(networkError as Error).message}`,
      );
      throw new IdentityAccessUnavailableError('identity-access-service unreachable or timed out');
    }

    if (response.status === 404) {
      throw new IdentityAccessNotFoundError(`No account found for ${path}`);
    }

    if (!response.ok) {
      this.logger.warn(`identity-access-service a retourné HTTP ${response.status} pour ${path}`);
      throw new IdentityAccessUnavailableError(`identity-access-service returned HTTP ${response.status}`);
    }

    return response.json() as Promise<IdentityAccount>;
  }
}
