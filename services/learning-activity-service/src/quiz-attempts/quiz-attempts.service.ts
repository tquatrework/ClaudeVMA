import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { StartQuizAttemptDto } from './dto/start-quiz-attempt.dto';
import { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto';
import { QuizGradingClientService } from './quiz-grading-client.service';
import { QuizAttemptStatus } from '../common/enums/quiz-attempt-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * Peuvent démarrer et passer un Quizz : élèves, professeurs, RP, AP
 * (docs/architecture.md > « Fonctionnalite Quizz », point 2).
 */
const QUIZ_TAKER_ROLES: string[] = [
  UserRole.ELEVE,
  UserRole.FORMATEUR,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
];

@Injectable()
export class QuizAttemptsService {
  constructor(
    @InjectRepository(QuizAttempt)
    private readonly quizAttemptRepository: Repository<QuizAttempt>,
    private readonly gradingClient: QuizGradingClientService,
  ) {}

  /**
   * Démarre (inscrit) une tentative de Quizz pour l'utilisateur authentifié.
   */
  async start(
    startDto: StartQuizAttemptDto,
    userId: string,
    userRole: string,
  ): Promise<QuizAttempt> {
    if (!QUIZ_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent démarrer un Quizz',
      );
    }

    const newAttempt = this.quizAttemptRepository.create({
      quizId: startDto.quizId,
      userId,
      userRole,
      status: QuizAttemptStatus.IN_PROGRESS,
    });

    return this.quizAttemptRepository.save(newAttempt);
  }

  /**
   * Reçoit les réponses soumises pour une tentative en cours, fait noter la
   * copie par content-catalog-service (seul propriétaire de la solution),
   * persiste le résultat et clôture la tentative.
   *
   * Refuse explicitement de re-soumettre une tentative déjà terminée.
   */
  async submit(
    attemptId: string,
    submitDto: SubmitQuizAttemptDto,
    userId: string,
    userRole: string,
    correlationId?: string,
  ): Promise<QuizAttempt> {
    if (!QUIZ_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent passer un Quizz',
      );
    }

    const attempt = await this.findOwnedAttemptOrFail(attemptId, userId);

    if (attempt.status === QuizAttemptStatus.COMPLETED) {
      throw new BadRequestException('Cette tentative est déjà terminée, elle ne peut pas être re-soumise');
    }

    const gradingResult = await this.gradingClient.grade(
      attempt.quizId,
      submitDto.answers,
      correlationId,
    );

    attempt.score = gradingResult.score;
    attempt.maxScore = gradingResult.maxScore;
    attempt.details = gradingResult.details;
    attempt.status = QuizAttemptStatus.COMPLETED;
    attempt.completedAt = new Date();

    return this.quizAttemptRepository.save(attempt);
  }

  /**
   * Historique des tentatives terminées de l'utilisateur authentifié, avec
   * leurs scores rapportés au maximum possible et leur date de fin.
   */
  async history(userId: string): Promise<QuizAttempt[]> {
    return this.quizAttemptRepository.find({
      where: { userId, status: QuizAttemptStatus.COMPLETED },
      order: { completedAt: 'DESC' },
    });
  }

  /**
   * Une tentative appartient strictement à celui qui l'a démarrée. Une
   * tentative absente ou appartenant à un tiers renvoie la même erreur 404 :
   * on ne révèle pas l'existence d'une tentative sur laquelle on n'a aucun
   * droit (même convention que les autres masquages du projet).
   */
  private async findOwnedAttemptOrFail(attemptId: string, userId: string): Promise<QuizAttempt> {
    const attempt = await this.quizAttemptRepository.findOne({ where: { id: attemptId } });

    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException(`Tentative de Quizz ${attemptId} introuvable`);
    }

    return attempt;
  }
}
