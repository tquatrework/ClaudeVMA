import {
  Injectable,
  Logger,
  BadGatewayException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuizAttemptQuestionResult } from './entities/quiz-attempt.entity';

export interface QuizAnswerPayload {
  questionId: string;
  selectedOptionIds?: string[];
  text?: string;
}

export interface QuizGradingResult {
  score: number;
  maxScore: number;
  details: QuizAttemptQuestionResult[];
}

/**
 * Client HTTP interne vers content-catalog-service, seul propriétaire de la
 * définition et de la solution d'un Quizz (contrat fixé le 2026-08-28,
 * docs/architecture.md > « Fonctionnalite Quizz »).
 *
 * Ce client ne connaît et ne persiste jamais la solution : il ne lit que le
 * résultat renvoyé (score, score maximum, détail correct/incorrect par
 * question). Toute réponse qui ne respecte pas strictement cette forme est
 * considérée comme une erreur explicite, jamais absorbée en silence.
 */
@Injectable()
export class QuizGradingClientService {
  private readonly logger = new Logger(QuizGradingClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async grade(
    quizId: string,
    answers: QuizAnswerPayload[],
    correlationId?: string,
  ): Promise<QuizGradingResult> {
    const baseUrl = this.configService.get<string>('CONTENT_CATALOG_SERVICE_URL');
    const internalSecret = this.configService.get<string>('INTERNAL_SECRET');

    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'CONTENT_CATALOG_SERVICE_URL non configuré : impossible de noter le Quizz',
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
      response = await fetch(`${baseUrl}/internal/quizzes/${quizId}/grade`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers }),
      });
    } catch (error) {
      this.logger.error(
        `content-catalog-service injoignable pour la notation du Quizz ${quizId}: ${error}`,
      );
      throw new ServiceUnavailableException(
        'Le service de notation (content-catalog-service) est injoignable',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(`Quizz ${quizId} introuvable`);
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Échec de la notation du Quizz (content-catalog-service a répondu ${response.status})`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException('Réponse de notation illisible (content-catalog-service)');
    }

    if (!this.isValidGradingResult(body)) {
      throw new BadGatewayException('Réponse de notation malformée (content-catalog-service)');
    }

    return body;
  }

  private isValidGradingResult(body: unknown): body is QuizGradingResult {
    if (!body || typeof body !== 'object') return false;
    const candidate = body as Record<string, unknown>;

    if (typeof candidate.score !== 'number' || typeof candidate.maxScore !== 'number') {
      return false;
    }
    if (!Array.isArray(candidate.details)) return false;

    return candidate.details.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const detail = item as Record<string, unknown>;
      return (
        typeof detail.questionId === 'string' &&
        typeof detail.isCorrect === 'boolean' &&
        typeof detail.pointsEarned === 'number' &&
        typeof detail.pointsPossible === 'number'
      );
    });
  }
}
