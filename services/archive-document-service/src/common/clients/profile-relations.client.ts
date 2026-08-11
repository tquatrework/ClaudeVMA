import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RelationSnapshot } from '../relations/relation-kind';

/**
 * Levée quand `profile-service` est injoignable, expire, ou répond un statut
 * inattendu. Le service appelant DOIT échouer bruyamment : sans relation
 * connue, on ne sait ni autoriser ni refuser, et deviner reviendrait soit à
 * ouvrir une archive à un inconnu, soit à la fermer à son titulaire.
 */
export class ProfileRelationsUnavailableError extends Error {}

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Adaptateur typé vers `GET /internal/relations/:viewerId/:targetId` de
 * `profile-service`, unique propriétaire des relations métier (arbitrage du
 * 2026-08-11, point 4 : « les autres services les lui demandent, ils n'en
 * tiennent pas de copie »).
 *
 * La lecture est naturellement idempotente, d'où l'absence de clé
 * d'idempotence. `x-correlation-id` est propagé quand l'appelant en a un.
 */
@Injectable()
export class ProfileRelationsClient {
  private readonly logger = new Logger(ProfileRelationsClient.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Résout les relations entre un lecteur et une cible.
   *
   * `viewerRole` est OBLIGATOIRE côté `profile-service` (400 sinon) : le rôle
   * accompagne systématiquement les appels interservices, au même titre que
   * `x-correlation-id`.
   */
  async resolveRelations(
    viewerId: string,
    targetId: string,
    viewerRole: string,
    correlationId?: string,
  ): Promise<RelationSnapshot> {
    const profileServiceUrl = this.configService.get<string>(
      'PROFILE_SERVICE_URL',
      'http://profile-service:3002',
    );
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET', '');
    const path =
      `/internal/relations/${encodeURIComponent(viewerId)}/${encodeURIComponent(targetId)}` +
      `?viewerRole=${encodeURIComponent(viewerRole)}`;

    let response: Response;
    try {
      response = await fetch(`${profileServiceUrl}${path}`, {
        method: 'GET',
        headers: {
          'X-Internal-Secret': internalSecret,
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (networkError) {
      this.logger.error(
        `Impossible de joindre profile-service (${path}) : ${(networkError as Error).message}. ` +
          'Vérifier PROFILE_SERVICE_URL et la disponibilité réseau.',
      );
      throw new ProfileRelationsUnavailableError('profile-service unreachable or timed out');
    }

    if (!response.ok) {
      // 400 (viewerRole hors énumération), 401 (INTERNAL_SECRET divergent) ou
      // 5xx : toutes des erreurs de configuration ou de contrat, jamais une
      // réponse métier. Journalisées en error pour rester visibles.
      this.logger.error(
        `profile-service a retourné HTTP ${response.status} pour ${path}. ` +
          'Vérifier INTERNAL_SECRET, le rôle transmis et la configuration réseau.',
      );
      throw new ProfileRelationsUnavailableError(
        `profile-service returned HTTP ${response.status}`,
      );
    }

    return (await response.json()) as RelationSnapshot;
  }
}
