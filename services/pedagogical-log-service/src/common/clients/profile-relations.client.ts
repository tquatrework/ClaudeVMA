import { Injectable, ForbiddenException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RelationCheckResult {
  viewerId: string;
  targetId: string;
  isSelf: boolean;
  isAdministrator: boolean;
  relations: Array<{ kind: string; isPrincipalTeacher?: boolean; throughUserIds?: string[] }>;
}

/**
 * Client interservices vers profile-service, unique propriétaire des relations
 * (docs/architecture.md, arbitrages du 2026-08-11/12). Interrogé à chaque action,
 * jamais en cache — un lien peut être rompu entre deux appels.
 *
 * Contrat : `GET /internal/relations/:viewerId/:targetId?viewerRole=`, protégé par
 * `X-Internal-Secret` (docs/routes.md, teacher-request-service > "Ce que le service
 * demande à profile-service").
 *
 * Politique d'échec : `profile-service` injoignable ou en erreur → 503 (échec fermé,
 * laisser passer donnerait l'illusion du contrôle) ; relation absente → 403.
 */
@Injectable()
export class ProfileRelationsClient {
  private readonly logger = new Logger(ProfileRelationsClient.name);

  constructor(private readonly config: ConfigService) {}

  async getRelation(
    viewerId: string,
    targetId: string,
    viewerRole: string,
  ): Promise<RelationCheckResult> {
    const baseUrl = this.config.get<string>('PROFILE_SERVICE_URL');
    if (!baseUrl) {
      this.logger.error('PROFILE_SERVICE_URL not configured — cannot verify relation');
      throw new ServiceUnavailableException('profile-service is not configured');
    }

    const url = `${baseUrl}/internal/relations/${viewerId}/${targetId}?viewerRole=${encodeURIComponent(viewerRole)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'X-Internal-Secret': this.config.get<string>('INTERNAL_SECRET') ?? '' },
      });
    } catch (error) {
      this.logger.error(`profile-service unreachable: ${(error as Error).message}`);
      throw new ServiceUnavailableException('profile-service is unreachable');
    }

    if (!response.ok) {
      this.logger.error(`profile-service returned ${response.status} for relation check`);
      throw new ServiceUnavailableException('profile-service relation check failed');
    }

    return (await response.json()) as RelationCheckResult;
  }

  /**
   * Vérifie qu'un formateur est bien titulaire de la relation `teacher_of_student`
   * avec l'élève ciblé. Lève 403 si absente, 503 si profile-service est injoignable.
   */
  async assertTeacherOfStudent(teacherId: string, studentId: string): Promise<void> {
    const result = await this.getRelation(teacherId, studentId, 'formateur');
    const hasRelation = result.relations.some((relation) => relation.kind === 'teacher_of_student');
    if (!hasRelation) {
      throw new ForbiddenException(
        "Seul le formateur titulaire de la relation avec cet élève peut écrire dans son cahier de texte",
      );
    }
  }
}
