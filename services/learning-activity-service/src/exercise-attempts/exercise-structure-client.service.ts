import {
  Injectable,
  Logger,
  BadGatewayException,
  ServiceUnavailableException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ExercisePartSummary {
  id: string;
  category: 'statement' | 'question';
}

export interface ExerciseStructure {
  id: string;
  parts: ExercisePartSummary[];
}

/**
 * Client HTTP vers la route publique GET /exercises/:id de
 * content-catalog-service (docs/architecture.md > « Refonte des Exercices »,
 * point 10) : ouverte à tout authentifié, ne renvoie jamais de solution. On y
 * lit uniquement la séquence de blocs (id + catégorie) pour connaître le
 * nombre et l'ordre des zones de réponse à proposer, sans jamais dupliquer le
 * contenu (énoncés, tags, titre) dans ce service.
 *
 * Le jeton de l'appelant est transmis tel quel (route publique authentifiée,
 * pas de X-Internal-Secret ici) : jamais un contact direct du front avec
 * content-catalog-service, toujours médié par ce client.
 */
@Injectable()
export class ExerciseStructureClientService {
  private readonly logger = new Logger(ExerciseStructureClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async getStructure(
    exerciseId: string,
    authorizationHeader: string | undefined,
    correlationId?: string,
  ): Promise<ExerciseStructure> {
    const baseUrl = this.configService.get<string>('CONTENT_CATALOG_SERVICE_URL');

    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'CONTENT_CATALOG_SERVICE_URL non configuré : impossible de lire la structure de l\'exercice',
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
      response = await fetch(`${baseUrl}/exercises/${exerciseId}`, {
        method: 'GET',
        headers,
      });
    } catch (error) {
      this.logger.error(
        `content-catalog-service injoignable pour lire l'exercice ${exerciseId}: ${error}`,
      );
      throw new ServiceUnavailableException(
        'Le service de contenu (content-catalog-service) est injoignable',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(`Exercice ${exerciseId} introuvable`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ForbiddenException('Accès refusé à cet exercice');
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Échec de la lecture de l'exercice (content-catalog-service a répondu ${response.status})`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException('Réponse de structure d\'exercice illisible (content-catalog-service)');
    }

    if (!this.isValidStructure(body)) {
      throw new BadGatewayException('Réponse de structure d\'exercice malformée (content-catalog-service)');
    }

    return body;
  }

  private isValidStructure(body: unknown): body is ExerciseStructure {
    if (!body || typeof body !== 'object') return false;
    const candidate = body as Record<string, unknown>;

    if (typeof candidate.id !== 'string') return false;
    if (!Array.isArray(candidate.parts)) return false;

    return candidate.parts.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const part = item as Record<string, unknown>;
      return (
        typeof part.id === 'string' &&
        (part.category === 'statement' || part.category === 'question')
      );
    });
  }
}
