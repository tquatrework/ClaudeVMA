import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * `phone` (et non `phoneNumber`) : nom de champ imposé par le contrat de
 * profile-service, cohérent avec les autres routes internes existantes
 * (create-student-profiles.dto.ts, create-teacher-profiles.dto.ts,
 * update-administrative-profile.dto.ts). Le DTO d'entrée public
 * d'identity-access-service garde `phoneNumber` (ex: CreateAccountDto) — seul
 * le mapping effectué au moment de cet appel change de nom, voir
 * AccountsService.persistAdministrativeProfile.
 */
export interface CreateAdministrativeProfileInput {
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  /**
   * Date calendaire ISO `YYYY-MM-DD`. Même nom des deux côtés (règle « un seul
   * nom par donnée ») : contrairement à `phone`/`phoneNumber`, aucun mapping
   * n'est nécessaire. Optionnel côté profile-service, qui renvoie un 400
   * explicite si la date est mal formée — la validation locale
   * (IsIsoBirthDate) existe pour que ce 400 arrive à l'appelant tel quel,
   * plutôt que transformé en 503 par l'échec de l'appel sortant.
   */
  birthDate?: string | null;
}

export interface LinkParentToStudentInput {
  studentId: string;
  financeOwnerId: string;
}

/**
 * Erreur levée par ProfileServiceClient lorsque profile-service est injoignable,
 * en timeout, ou renvoie une erreur HTTP non-2xx.
 *
 * identity-access-service ne stocke plus firstName/lastName/phone localement
 * (décision d'architecture du 2026-08-05 : voir user.entity.ts). profile-service
 * est l'unique lieu de stockage de ces données saisies à l'inscription — ce
 * n'est donc plus une "synchronisation best-effort d'une copie" (approche
 * abandonnée), mais l'écriture primaire elle-même. Un échec ici est par
 * conséquent traité comme un échec métier de la création de compte par
 * AccountsService (rollback transactionnel de la ligne `users` tout juste
 * insérée), et non comme un avertissement journalisé silencieusement.
 */
export class ProfileServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileServiceUnavailableError';
  }
}

/**
 * Typed adapter for interservice calls to profile-service (services-convention:
 * "les appels interservices passent par des clients/adaptateurs typés avec
 * timeout, correlation ID, politique d'erreur et idempotence"). Symétrique de
 * IdentityAccessClient côté profile-service
 * (services/profile-service/src/common/clients/identity-access.client.ts).
 */
@Injectable()
export class ProfileServiceClient {
  private readonly logger = new Logger(ProfileServiceClient.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Stocke le profil administratif (firstName/lastName/phone/birthDate) d'un utilisateur
   * nouvellement créé — seule écriture de ces données, profile-service ne
   * possédant pas de copie locale côté identity-access-service. Route interne
   * idempotente côté profile-service (upsert par userId).
   */
  async createAdministrativeProfile(
    input: CreateAdministrativeProfileInput,
    correlationId?: string,
  ): Promise<void> {
    await this.post(
      '/internal/create-administrative-profile',
      input,
      correlationId,
      `la création du profil administratif de l'utilisateur ${input.userId}`,
    );
  }

  /**
   * Crée le lien financeur/élève (finance-owner-student) lorsqu'un élève et un
   * parent financeur sont créés ou associés dans le même appel de création de
   * compte (décision produit du 2026-08-05 : pas de flow de demande dans ce cas
   * précis, la liaison est immédiate et implicite). Appelle la route système
   * idempotente `POST /internal/link-parent` de profile-service
   * (relationsService.createFinanceOwnerStudentLinkForSystem), qui ne publie
   * pas d'événement métier (lien créé par le système, pas par une action RP).
   */
  async linkParentToStudent(
    input: LinkParentToStudentInput,
    correlationId?: string,
  ): Promise<void> {
    await this.post(
      '/internal/link-parent',
      input,
      correlationId,
      `la liaison automatique du financeur ${input.financeOwnerId} à l'élève ${input.studentId}`,
    );
  }

  private async post(
    path: string,
    body: unknown,
    correlationId: string | undefined,
    operationDescription: string,
  ): Promise<void> {
    const profileServiceUrl = this.configService.get<string>(
      'PROFILE_SERVICE_URL',
      'http://profile-service:3002',
    );
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET', '');

    let response: Response;
    try {
      response = await fetch(`${profileServiceUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
          ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (networkError) {
      const message =
        `Impossible de joindre profile-service pour ${operationDescription} : ` +
        `${(networkError as Error).message}. Vérifier PROFILE_SERVICE_URL et la disponibilité réseau.`;
      this.logger.error(message);
      throw new ProfileServiceUnavailableError(message);
    }

    if (!response.ok) {
      const message =
        `profile-service a retourné HTTP ${response.status} pour ${operationDescription}. ` +
        'Vérifier INTERNAL_SECRET et la configuration réseau entre les deux services.';
      this.logger.error(message);
      throw new ProfileServiceUnavailableError(message);
    }
  }
}
