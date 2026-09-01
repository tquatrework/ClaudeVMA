import {
  Injectable,
  Logger,
  BadGatewayException,
  ServiceUnavailableException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Forme (partielle) de GET /evaluations/:id chez content-catalog-service,
 * telle qu'attendue par ce client — seuls les champs consommés ici sont
 * validés : `id`, `status` (pour vérifier `validated`) et `durationSeconds`
 * (pour calculer `deadlineAt`), plus `exerciseItems` (liste des Exercices
 * composant l'Évaluation, pour valider que les réponses soumises portent
 * bien sur un Exercice de cette Évaluation). Le reste des champs de
 * l'entité (titre, niveau, difficulté, thème, tags, blockBackNavigation)
 * n'est jamais dupliqué dans ce service.
 *
 * ATTENTION — contrat non confirmé par une PR réelle de
 * content-catalog-service au moment de ce chantier (développé en parallèle,
 * cf. rapport de chantier) : `durationSeconds` obligatoire et statut aligné
 * Quizz/Exercice (`pending_validation`/`validated`/`rejected`) sont des
 * évolutions demandées le même jour par le même arbitrage, pas encore
 * vérifiées contre la pile réelle. Ce client valide strictement la forme
 * reçue et lève une 502 explicite en cas d'écart plutôt que d'absorber
 * silencieusement une réponse inattendue.
 */
export interface EvaluationExerciseItemSummary {
  exerciseId: string;
  order?: number;
  titleOverride?: unknown;
}

export interface EvaluationStructure {
  id: string;
  status: string;
  durationSeconds: number;
  exerciseItems: EvaluationExerciseItemSummary[];
}

@Injectable()
export class EvaluationStructureClientService {
  private readonly logger = new Logger(EvaluationStructureClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async getStructure(
    evaluationId: string,
    authorizationHeader: string | undefined,
    correlationId?: string,
  ): Promise<EvaluationStructure> {
    const baseUrl = this.configService.get<string>('CONTENT_CATALOG_SERVICE_URL');

    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'CONTENT_CATALOG_SERVICE_URL non configuré : impossible de lire l\'Évaluation',
      );
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authorizationHeader) {
      headers['Authorization'] = authorizationHeader;
    }
    if (correlationId) {
      headers['x-correlation-id'] = correlationId;
    }

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(`${baseUrl}/evaluations/${evaluationId}`, {
        method: 'GET',
        headers,
      });
    } catch (error) {
      this.logger.error(
        `content-catalog-service injoignable pour lire l'évaluation ${evaluationId}: ${error}`,
      );
      throw new ServiceUnavailableException(
        'Le service de contenu (content-catalog-service) est injoignable',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(`Évaluation ${evaluationId} introuvable`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ForbiddenException('Accès refusé à cette Évaluation');
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Échec de la lecture de l'Évaluation (content-catalog-service a répondu ${response.status})`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException('Réponse d\'Évaluation illisible (content-catalog-service)');
    }

    if (!this.isValidStructure(body)) {
      throw new BadGatewayException('Réponse d\'Évaluation malformée (content-catalog-service)');
    }

    return body;
  }

  private isValidStructure(body: unknown): body is EvaluationStructure {
    if (!body || typeof body !== 'object') return false;
    const candidate = body as Record<string, unknown>;

    if (typeof candidate.id !== 'string') return false;
    if (typeof candidate.status !== 'string') return false;
    if (typeof candidate.durationSeconds !== 'number' || candidate.durationSeconds <= 0) return false;
    if (!Array.isArray(candidate.exerciseItems)) return false;

    return candidate.exerciseItems.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      return typeof (item as Record<string, unknown>).exerciseId === 'string';
    });
  }
}
