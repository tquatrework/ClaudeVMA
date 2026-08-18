import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Levée quand `identity-access-service` est injoignable, expire, ou répond un
 * statut inattendu (autre que `404`, traité séparément — voir `resolveRole`).
 * Le service appelant DOIT échouer bruyamment : sans rôle connu, on ne peut
 * pas décider une politique d'accès qui en dépend, et deviner reviendrait
 * soit à ouvrir un calendrier à un inconnu, soit à le fermer à quelqu'un qui
 * y a droit.
 *
 * Écrit sur le même modèle que `ProfileRelationsClient`
 * (`../clients/profile-relations.client.ts`).
 */
export class IdentityAccessUnavailableError extends Error {}

const DEFAULT_TIMEOUT_MS = 3000;

interface InternalAccountSummary {
  userId: string;
  loginIdentifier: string;
  role: string;
}

/**
 * Adaptateur typé vers `GET /internal/accounts/by-user-id/:userId` de
 * `identity-access-service`, unique propriétaire du rôle
 * (`docs/architecture.md` > « Propriété du rôle »).
 *
 * Introduit pour corriger CAL-FB-004 : `resolveCalendarBusyFreeAccess`
 * dépendait jusqu'ici du champ `Calendar.ownerRole`, renseigné seulement à la
 * création paresseuse de la ligne `Calendar` (premier appel à
 * `GET /calendars/:ownerId`, `PUT .../availability` ou
 * `POST .../availability-slots`). Un titulaire qui n'avait encore jamais
 * déclenché cette création voyait son rôle traité comme « inconnu », et le
 * repli défensif de la politique fermait alors l'accès à tout le monde sauf
 * lui-même et le RP — y compris à un parent financeur ou un formateur ayant
 * une relation réelle et active. Résoudre le rôle auprès de la source de
 * vérité rend la décision indépendante de l'existence de la ligne
 * `Calendar`.
 */
@Injectable()
export class IdentityAccessClient {
  private readonly logger = new Logger(IdentityAccessClient.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Résout le rôle du compte `userId` auprès d'`identity-access-service`.
   *
   * Renvoie `undefined` si le compte est inconnu (`404`) — traité par
   * l'appelant comme un rôle inconnu (repli fermé de la politique), jamais
   * comme une panne technique. Toute autre réponse non-`ok`, une erreur
   * réseau ou un dépassement de délai lève `IdentityAccessUnavailableError`.
   */
  async resolveRole(userId: string, correlationId?: string): Promise<string | undefined> {
    const baseUrl = this.configService.get<string>(
      'IDENTITY_ACCESS_SERVICE_URL',
      'http://identity-access-service:3001',
    );
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET', '');
    const path = `/internal/accounts/by-user-id/${encodeURIComponent(userId)}`;

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
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

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      // 401 (INTERNAL_SECRET divergent) ou 5xx : erreurs de configuration ou
      // de contrat, jamais une réponse métier. Journalisées en error pour
      // rester visibles.
      this.logger.error(
        `identity-access-service a retourné HTTP ${response.status} pour ${path}. ` +
          'Vérifier INTERNAL_SECRET et la configuration réseau.',
      );
      throw new IdentityAccessUnavailableError(
        `identity-access-service returned HTTP ${response.status}`,
      );
    }

    const account = (await response.json()) as InternalAccountSummary;
    return account.role;
  }
}
