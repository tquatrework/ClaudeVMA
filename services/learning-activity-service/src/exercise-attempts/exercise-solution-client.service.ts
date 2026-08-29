import {
  Injectable,
  Logger,
  BadGatewayException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExerciseContentItem } from './entities/exercise-attempt-part.entity';

export interface ExerciseSolutionResult {
  content: ExerciseContentItem[];
}

/**
 * Client HTTP interne vers content-catalog-service
 * (POST /internal/exercises/:exerciseId/parts/:partId/solution), protégé par
 * X-Internal-Secret — même modèle que les autres routes /internal/* du
 * projet et que la notation Quizz (docs/architecture.md > « Refonte des
 * Exercices », point 8).
 *
 * Le front ne doit jamais contacter content-catalog-service directement pour
 * une solution : c'est cette médiation, déclenchée par l'action "révéler",
 * qui va chercher le contenu une seule fois. Le résultat est ensuite mis en
 * cache côté ExerciseAttemptPart pour ne plus jamais rappeler cette route
 * pour le même bloc.
 */
@Injectable()
export class ExerciseSolutionClientService {
  private readonly logger = new Logger(ExerciseSolutionClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async reveal(
    exerciseId: string,
    partId: string,
    correlationId?: string,
  ): Promise<ExerciseSolutionResult> {
    const baseUrl = this.configService.get<string>('CONTENT_CATALOG_SERVICE_URL');
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET');

    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'CONTENT_CATALOG_SERVICE_URL non configuré : impossible de révéler la solution',
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
      response = await fetch(
        `${baseUrl}/internal/exercises/${exerciseId}/parts/${partId}/solution`,
        { method: 'POST', headers },
      );
    } catch (error) {
      this.logger.error(
        `content-catalog-service injoignable pour révéler la solution du bloc ${partId} (exercice ${exerciseId}): ${error}`,
      );
      throw new ServiceUnavailableException(
        'Le service de contenu (content-catalog-service) est injoignable',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(
        `Solution introuvable pour le bloc ${partId} de l'exercice ${exerciseId}`,
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Échec de la révélation de solution (content-catalog-service a répondu ${response.status})`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException('Réponse de solution illisible (content-catalog-service)');
    }

    if (!this.isValidSolutionResult(body)) {
      throw new BadGatewayException('Réponse de solution malformée (content-catalog-service)');
    }

    return body;
  }

  private isValidSolutionResult(body: unknown): body is ExerciseSolutionResult {
    if (!body || typeof body !== 'object') return false;
    const candidate = body as Record<string, unknown>;

    if (!Array.isArray(candidate.content)) return false;

    return candidate.content.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const contentItem = item as Record<string, unknown>;
      return (
        (contentItem.type === 'text' || contentItem.type === 'formula' || contentItem.type === 'image') &&
        typeof contentItem.value === 'string'
      );
    });
  }
}
