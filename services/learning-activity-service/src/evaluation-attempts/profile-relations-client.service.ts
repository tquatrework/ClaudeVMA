import {
  Injectable,
  Logger,
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Client HTTP interne vers profile-service, protégé par X-Internal-Secret —
 * même modèle que les autres routes /internal/* déjà en place dans le
 * projet (résolution de nom, formateurs validés, relations financeur-élève).
 *
 * Contrat confirmé contre la route réelle livrée par profile-service
 * (PR #197) : `GET /internal/relations/teachers/:studentId` répond
 * `{ studentId: string, teacherUserIds: string[] }` — cohérent avec le nom
 * déjà utilisé pour la route équivalente des parents financeurs
 * (`financeOwnerUserIds`). La validation stricte de la réponse ci-dessous
 * lève une 502 explicite en cas d'écart, jamais une absorption silencieuse.
 */
export interface LinkedTeachers {
  teacherUserIds: string[];
}

@Injectable()
export class ProfileRelationsClientService {
  private readonly logger = new Logger(ProfileRelationsClientService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Professeurs actuellement liés à l'élève, lus en direct (jamais en
   * cache) — même discipline que partout ailleurs dans ce projet : un droit
   * accordé par une relation se revérifie à chaque action, la relation
   * pouvant avoir pris fin entre-temps (arbitrages du 2026-08-11/12).
   */
  async getLinkedTeacherIds(studentId: string, correlationId?: string): Promise<string[]> {
    const baseUrl = this.configService.get<string>('PROFILE_SERVICE_URL');
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET');

    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'PROFILE_SERVICE_URL non configuré : impossible de lire les professeurs liés à l\'élève',
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Internal-Secret': internalSecret ?? '',
    };
    if (correlationId) {
      headers['x-correlation-id'] = correlationId;
    }

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(`${baseUrl}/internal/relations/teachers/${studentId}`, {
        method: 'GET',
        headers,
      });
    } catch (error) {
      this.logger.error(
        `profile-service injoignable pour lire les professeurs liés à l'élève ${studentId}: ${error}`,
      );
      throw new ServiceUnavailableException('Le service de profils (profile-service) est injoignable');
    }

    // Un élève sans aucun professeur lié est un cas normal (pas une erreur) :
    // si profile-service renvoie 404 pour un élève inconnu ou sans relation,
    // ce client le traite comme une liste vide plutôt que de propager une 404
    // qui bloquerait la création de la demande de correction — voir
    // EvaluationAttemptsService.requestCorrection (bascule directe en
    // ALL_DECLINED quand la liste est vide).
    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Échec de la lecture des professeurs liés (profile-service a répondu ${response.status})`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException('Réponse de relations illisible (profile-service)');
    }

    if (!this.isValidLinkedTeachers(body)) {
      throw new BadGatewayException('Réponse de relations malformée (profile-service)');
    }

    return body.teacherUserIds;
  }

  private isValidLinkedTeachers(body: unknown): body is LinkedTeachers {
    if (!body || typeof body !== 'object') return false;
    const candidate = body as Record<string, unknown>;
    return (
      Array.isArray(candidate.teacherUserIds) &&
      candidate.teacherUserIds.every((id: unknown) => typeof id === 'string')
    );
  }
}
