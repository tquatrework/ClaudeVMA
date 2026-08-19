import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Levée quand `profile-service` est injoignable, expire, ou répond un statut
 * inattendu en résolvant des noms d'affichage.
 *
 * Contrairement à `ProfileRelationsUnavailableError` /
 * `IdentityAccessUnavailableError` (décisions d'accès, échec fermé
 * obligatoire), une résolution de nom qui échoue ne doit PAS faire échouer
 * la lecture du calendrier tout entière : l'appelant (`CalendarsService`)
 * dégrade gracieusement en `creatorName: null` plutôt que de renvoyer `503`
 * sur une route de lecture centrale, consultée à chaque chargement de page
 * (règle du 2026-08-10, « Chargement des données »). Ce qui reste non
 * négociable, en toute circonstance : ne jamais afficher un UUID à la place
 * (arbitrage du 2026-08-09, « Affichage des identifiants techniques »).
 */
export class ProfileDisplayNameUnavailableError extends Error {}

const DEFAULT_TIMEOUT_MS = 3000;

export interface DisplayName {
  firstName: string | null;
  lastName: string | null;
}

interface DisplayNamesBatchResponse {
  displayNames: Array<{ userId: string; firstName: string | null; lastName: string | null }>;
}

/**
 * Adaptateur typé vers `POST /internal/profiles/display-names` de
 * `profile-service` — variante par lot de `GET /internal/profiles/:userId/display-name`
 * (arbitrage du 2026-08-12, « Resolution des noms entre services »),
 * réutilisée ici sur le même modèle que `dashboard-notification-service`
 * (arbitrage du 2026-08-14, « Systeme de notifications transversal », point 4) :
 * jamais un `userId` seul affiché comme donnée, toujours un nom résolu au
 * préalable.
 *
 * Contrat figé côté serveur : `firstName`/`lastName` uniquement, jamais un
 * champ de plus — voir `docs/routes.md`. Un `userId` sans profil
 * administratif est absent de la réponse plutôt que de faire échouer le lot.
 */
@Injectable()
export class ProfileDisplayNameClient {
  private readonly logger = new Logger(ProfileDisplayNameClient.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Résout les noms d'une liste d'identifiants (dédupliqués avant l'appel).
   * Renvoie une `Map` indexée par `userId` — un identifiant absent de la
   * réponse de `profile-service` est simplement absent de la `Map`, jamais
   * une entrée avec des valeurs `null` inventées.
   */
  async resolveDisplayNames(
    userIds: string[],
    correlationId?: string,
  ): Promise<Map<string, DisplayName>> {
    const uniqueUserIds = Array.from(new Set(userIds));
    if (uniqueUserIds.length === 0) return new Map();

    const profileServiceUrl = this.configService.get<string>(
      'PROFILE_SERVICE_URL',
      'http://profile-service:3002',
    );
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET', '');
    const path = '/internal/profiles/display-names';

    let response: Response;
    try {
      response = await fetch(`${profileServiceUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
        body: JSON.stringify({ userIds: uniqueUserIds }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (networkError) {
      this.logger.error(
        `Impossible de joindre profile-service (${path}) : ${(networkError as Error).message}. ` +
          'Vérifier PROFILE_SERVICE_URL et la disponibilité réseau.',
      );
      throw new ProfileDisplayNameUnavailableError('profile-service unreachable or timed out');
    }

    if (!response.ok) {
      this.logger.error(
        `profile-service a retourné HTTP ${response.status} pour ${path}. ` +
          'Vérifier INTERNAL_SECRET et la configuration réseau.',
      );
      throw new ProfileDisplayNameUnavailableError(
        `profile-service returned HTTP ${response.status}`,
      );
    }

    const body = (await response.json()) as DisplayNamesBatchResponse;
    const namesByUserId = new Map<string, DisplayName>();
    for (const entry of body.displayNames) {
      namesByUserId.set(entry.userId, { firstName: entry.firstName, lastName: entry.lastName });
    }
    return namesByUserId;
  }
}
