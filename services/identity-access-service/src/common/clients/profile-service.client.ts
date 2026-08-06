import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_TIMEOUT_MS = 3000;

export interface LinkParentToStudentInput {
  studentId: string;
  financeOwnerId: string;
}

/**
 * Erreur levée par ProfileServiceClient lorsque profile-service est injoignable,
 * en timeout, ou renvoie une erreur HTTP non-2xx.
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
 * timeout, correlation ID, politique d'erreur et idempotence").
 *
 * Ne porte plus aucune écriture de firstName/lastName/phone : depuis
 * l'arbitrage d'architecture du 2026-08-06 (docs/architecture.md >
 * "Arbitrages rendus"), ces champs sont exclusivement collectés et stockés
 * par profile-service — identity-access-service ne les collecte plus du tout
 * (ni à la création de compte, ni ailleurs) et n'a donc plus besoin de les
 * transmettre. Ce client ne conserve que linkParentToStudent (relation
 * finance-owner-student), qui ne porte aucune donnée d'identité.
 *
 * Aucune méthode de lecture n'a été ajoutée : le contrat interne de
 * profile-service (docs/routes.md > profile-service) n'expose pas de route
 * GET pour récupérer firstName/lastName/phone, et aucun consommateur
 * d'identity-access-service n'en a besoin aujourd'hui (MailService envoie des
 * emails avec une salutation générique, la notification dashboard formateur
 * utilise l'email). À réévaluer si un besoin de lecture apparaît et si
 * profile-service expose la route correspondante.
 */
@Injectable()
export class ProfileServiceClient {
  private readonly logger = new Logger(ProfileServiceClient.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Crée le lien financeur/élève (finance-owner-student) lorsqu'un élève et un
   * parent financeur sont créés ou associés dans le même appel de création de
   * compte. Appelle la route système idempotente `POST /internal/link-parent`
   * de profile-service (relationsService.createFinanceOwnerStudentLinkForSystem),
   * qui ne publie pas d'événement métier (lien créé par le système, pas par
   * une action RP).
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
