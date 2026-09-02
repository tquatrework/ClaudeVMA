import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface IdentityAccount {
  userId: string;
  loginIdentifier: string;
  role: string;
}

/**
 * Une entrée de `GET /internal/accounts?role=`. Même socle que
 * `IdentityAccount` (le contrat ne documente pas de champs supplémentaires
 * garantis — `email` est présent en pratique mais n'est pas consommé ici,
 * `identity-access-service` en restant l'unique propriétaire).
 */
export interface IdentityAccountSummary {
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

  /**
   * Liste des comptes détenant un rôle donné (`GET /internal/accounts?role=`),
   * déjà consommée ailleurs dans la pile pour le fan-out par rôle des
   * notifications (`docs/routes.md`, `POST /internal/notify`). Non paginée côté
   * `identity-access-service` : c'est l'appelant qui pagine, après avoir croisé
   * cette liste avec ses propres données (voir `RoleDirectoryService`).
   *
   * Un rôle vide renvoie `[]`, jamais une erreur — `identity-access-service`
   * refuse en amont (`400`) une valeur hors de son enum de rôles, ce que
   * l'appelant doit de toute façon valider avant d'émettre la requête.
   */
  async listAccountsByRole(
    role: string,
    correlationId?: string,
  ): Promise<IdentityAccountSummary[]> {
    return this.fetchAccountList(
      `/internal/accounts?role=${encodeURIComponent(role)}`,
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
      // Unreachable host, DNS failure or timeout: this is an infrastructure/config
      // problem (wrong IDENTITY_ACCESS_SERVICE_URL, network partition…), not a
      // business "account not found". Logged at error level so it surfaces in
      // observability instead of silently degrading (see profiles.service.ts
      // fetchLoginIdentifier, which turns this into a null and never fails the
      // caller).
      this.logger.error(
        `Impossible de joindre identity-access-service (${path}) : ${(networkError as Error).message}. ` +
          'Vérifier IDENTITY_ACCESS_SERVICE_URL et la disponibilité réseau.',
      );
      throw new IdentityAccessUnavailableError('identity-access-service unreachable or timed out');
    }

    if (response.status === 404) {
      throw new IdentityAccessNotFoundError(`No account found for ${path}`);
    }

    if (!response.ok) {
      // A non-404 non-2xx status (in particular 401/403) most often signals a
      // configuration mismatch — e.g. INTERNAL_SECRET differing between this
      // service and identity-access-service — rather than a transient issue.
      // Logged at error level (not warn) so it is not confused with the
      // expected 404 "not found" case and stays visible in observability.
      this.logger.error(
        `identity-access-service a retourné HTTP ${response.status} pour ${path}. ` +
          'Vérifier INTERNAL_SECRET et la configuration réseau entre les deux services.',
      );
      throw new IdentityAccessUnavailableError(`identity-access-service returned HTTP ${response.status}`);
    }

    return response.json() as Promise<IdentityAccount>;
  }

  /**
   * Variante DE LISTE de `fetchAccount` : pas de cas `404` (une liste vide est
   * une réponse `200 []` normale, jamais une absence de ressource), sinon même
   * politique d'erreur réseau/config.
   */
  private async fetchAccountList(
    path: string,
    correlationId?: string,
  ): Promise<IdentityAccountSummary[]> {
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
      this.logger.error(
        `Impossible de joindre identity-access-service (${path}) : ${(networkError as Error).message}. ` +
          'Vérifier IDENTITY_ACCESS_SERVICE_URL et la disponibilité réseau.',
      );
      throw new IdentityAccessUnavailableError('identity-access-service unreachable or timed out');
    }

    if (!response.ok) {
      this.logger.error(
        `identity-access-service a retourné HTTP ${response.status} pour ${path}. ` +
          'Vérifier INTERNAL_SECRET et la configuration réseau entre les deux services.',
      );
      throw new IdentityAccessUnavailableError(`identity-access-service returned HTTP ${response.status}`);
    }

    return response.json() as Promise<IdentityAccountSummary[]>;
  }
}
