import {
  Injectable,
  Logger,
  BadGatewayException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExerciseSolutionItem } from './entities/exercise-attempt-part.entity';

export interface ExerciseSolutionResult {
  content: ExerciseSolutionItem[];
}

export interface ExerciseSolutionImage {
  buffer: Buffer;
  contentType: string;
}

/**
 * Client HTTP interne vers content-catalog-service, protégé par
 * X-Internal-Secret — même modèle que les autres routes /internal/* du
 * projet et que la notation Quizz (docs/architecture.md > « Refonte des
 * Exercices », point 8). Contrat confirmé par content-catalog-service
 * (PR #184) :
 *   - POST /internal/exercises/:exerciseId/parts/:partId/solution → 200
 *     { content: [{id, type, order, content, imageMimeType?, imageSizeBytes?}] }.
 *   - Un seul comportement d'erreur, jamais de 400 dédié : partId inexistant,
 *     bloc "statement" (jamais de solution), ou bloc question sans solution
 *     répondent tous 404. Ce client ne distingue pas ces cas, conformément
 *     au contrat — toute réponse non-404/non-2xx est traitée comme un échec
 *     générique (502).
 *   - GET /internal/exercises/images/:itemId → octets bruts (pas de base64),
 *     pour les items solution de type image, référencés par leur propre `id`
 *     (pas de champ imageId séparé).
 *
 * Le front ne doit jamais contacter content-catalog-service directement pour
 * une solution ou une image de solution : c'est cette médiation, déclenchée
 * par l'action "révéler", qui va chercher le contenu une seule fois. Le
 * résultat JSON est ensuite mis en cache côté ExerciseAttemptPart pour ne
 * plus jamais rappeler cette route pour le même bloc — les octets d'image
 * restent proxyfiés à la demande (pas de cache binaire ici).
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
    const baseUrl = this.getBaseUrlOrFail('révéler la solution');
    const headers = this.buildHeaders(correlationId);

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

    // Un seul comportement d'erreur côté content-catalog-service : 404 pour
    // partId inexistant, bloc "statement" (jamais de solution), ou bloc
    // question sans solution — jamais de 400 dédié à distinguer.
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

  /**
   * Octets bruts d'un item solution de type image, via la seconde route
   * interne dédiée. L'itemId est celui de l'item lui-même (pas d'imageId
   * séparé) — voir ExerciseSolutionItem.
   */
  async getImageBytes(itemId: string, correlationId?: string): Promise<ExerciseSolutionImage> {
    const baseUrl = this.getBaseUrlOrFail('récupérer l\'image de solution');
    const headers = this.buildHeaders(correlationId);

    let response: Awaited<ReturnType<typeof fetch>>;
    try {
      response = await fetch(`${baseUrl}/internal/exercises/images/${itemId}`, {
        method: 'GET',
        headers,
      });
    } catch (error) {
      this.logger.error(
        `content-catalog-service injoignable pour récupérer l'image de solution ${itemId}: ${error}`,
      );
      throw new ServiceUnavailableException(
        'Le service de contenu (content-catalog-service) est injoignable',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(`Image de solution ${itemId} introuvable`);
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Échec de la récupération de l'image de solution (content-catalog-service a répondu ${response.status})`,
      );
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
    } catch {
      throw new BadGatewayException('Image de solution illisible (content-catalog-service)');
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }

  private getBaseUrlOrFail(action: string): string {
    const baseUrl = this.configService.get<string>('CONTENT_CATALOG_SERVICE_URL');
    if (!baseUrl) {
      throw new ServiceUnavailableException(
        `CONTENT_CATALOG_SERVICE_URL non configuré : impossible de ${action}`,
      );
    }
    return baseUrl;
  }

  private buildHeaders(correlationId?: string): Record<string, string> {
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Internal-Secret': internalSecret ?? '',
    };
    if (correlationId) {
      headers['x-correlation-id'] = correlationId;
    }
    return headers;
  }

  private isValidSolutionResult(body: unknown): body is ExerciseSolutionResult {
    if (!body || typeof body !== 'object') return false;
    const candidate = body as Record<string, unknown>;

    if (!Array.isArray(candidate.content)) return false;

    return candidate.content.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const contentItem = item as Record<string, unknown>;

      if (typeof contentItem.id !== 'string') return false;
      if (typeof contentItem.order !== 'number') return false;
      if (typeof contentItem.content !== 'string') return false;
      if (
        contentItem.type !== 'text' &&
        contentItem.type !== 'formula' &&
        contentItem.type !== 'image'
      ) {
        return false;
      }
      if (
        contentItem.imageMimeType !== undefined &&
        typeof contentItem.imageMimeType !== 'string'
      ) {
        return false;
      }
      if (
        contentItem.imageSizeBytes !== undefined &&
        typeof contentItem.imageSizeBytes !== 'number'
      ) {
        return false;
      }
      return true;
    });
  }
}
