import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExerciseAttempt } from './entities/exercise-attempt.entity';
import { ExerciseAttemptPart } from './entities/exercise-attempt-part.entity';
import { StartExerciseAttemptDto } from './dto/start-exercise-attempt.dto';
import { SubmitExerciseAnswerDto } from './dto/submit-exercise-answer.dto';
import { RevealExerciseSolutionDto } from './dto/reveal-exercise-solution.dto';
import { ExerciseStructureClientService } from './exercise-structure-client.service';
import {
  ExerciseSolutionClientService,
  ExerciseSolutionImage,
} from './exercise-solution-client.service';
import { ExerciseAttemptStatus } from '../common/enums/exercise-attempt-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * Peuvent démarrer et passer un Exercice : élèves, professeurs, RP, AP —
 * mêmes 4 rôles que le Quizz (docs/architecture.md > « Refonte des
 * Exercices », point 5 : « lecture d'un Exercice validated ouverte à eleve,
 * professeur, AP, RP — memes 4 roles que le Quizz »).
 */
const EXERCISE_TAKER_ROLES: string[] = [
  UserRole.ELEVE,
  UserRole.FORMATEUR,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
];

export interface ExerciseAttemptPartView {
  partId: string;
  answerContent: unknown;
  answeredAt: Date | null;
  solutionRevealed: boolean;
  revealedAt: Date | null;
  revealedContent: unknown;
}

export interface ExerciseAttemptView {
  id: string;
  exerciseId: string;
  userId: string;
  userRole: string;
  status: ExerciseAttemptStatus;
  startedAt: Date;
  updatedAt: Date;
  parts: ExerciseAttemptPartView[];
}

@Injectable()
export class ExerciseAttemptsService {
  constructor(
    @InjectRepository(ExerciseAttempt)
    private readonly attemptRepository: Repository<ExerciseAttempt>,
    @InjectRepository(ExerciseAttemptPart)
    private readonly partRepository: Repository<ExerciseAttemptPart>,
    private readonly structureClient: ExerciseStructureClientService,
    private readonly solutionClient: ExerciseSolutionClientService,
  ) {}

  /**
   * Démarre une tentative d'Exercice : lit la structure (blocs question,
   * dans l'ordre) auprès de content-catalog-service, puis crée une ligne de
   * détail par bloc question — jamais de duplication du contenu de
   * l'exercice, seulement l'identifiant et la position de chaque question.
   */
  async start(
    startDto: StartExerciseAttemptDto,
    userId: string,
    userRole: string,
    authorizationHeader: string | undefined,
    correlationId?: string,
  ): Promise<ExerciseAttemptView> {
    if (!EXERCISE_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent démarrer un Exercice',
      );
    }

    const structure = await this.structureClient.getStructure(
      startDto.exerciseId,
      authorizationHeader,
      correlationId,
    );
    const questionParts = structure.parts.filter((part) => part.category === 'question');

    const attempt = await this.attemptRepository.save(
      this.attemptRepository.create({
        exerciseId: startDto.exerciseId,
        userId,
        userRole,
      }),
    );

    const parts =
      questionParts.length > 0
        ? await this.partRepository.save(
            questionParts.map((part) =>
              this.partRepository.create({ attemptId: attempt.id, partId: part.id }),
            ),
          )
        : [];

    return this.toView(attempt, parts);
  }

  /**
   * Soumet ou remplace la réponse à un bloc question. Idempotent : un même
   * partId écrase la réponse précédente (l'élève peut changer d'avis avant
   * de la considérer définitive).
   */
  async submitAnswer(
    attemptId: string,
    submitDto: SubmitExerciseAnswerDto,
    userId: string,
    userRole: string,
  ): Promise<ExerciseAttemptView> {
    if (!EXERCISE_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent répondre à un Exercice',
      );
    }

    const attempt = await this.findOwnedAttemptOrFail(attemptId, userId);
    const part = await this.findPartOrFail(attempt.id, submitDto.partId);

    part.answerContent = submitDto.content;
    part.answeredAt = new Date();
    await this.partRepository.save(part);

    const allParts = await this.partRepository.find({ where: { attemptId: attempt.id } });
    return this.toView(attempt, allParts);
  }

  /**
   * Révèle la solution d'un bloc question, via la médiation de
   * content-catalog-service. Idempotent : une solution déjà révélée n'est
   * jamais redemandée, la valeur mise en cache est renvoyée telle quelle.
   */
  async reveal(
    attemptId: string,
    revealDto: RevealExerciseSolutionDto,
    userId: string,
    userRole: string,
    correlationId?: string,
  ): Promise<ExerciseAttemptView> {
    if (!EXERCISE_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent révéler une solution d\'Exercice',
      );
    }

    const attempt = await this.findOwnedAttemptOrFail(attemptId, userId);
    const part = await this.findPartOrFail(attempt.id, revealDto.partId);

    if (!part.solutionRevealed) {
      const solution = await this.solutionClient.reveal(
        attempt.exerciseId,
        revealDto.partId,
        correlationId,
      );

      part.solutionRevealed = true;
      part.revealedAt = new Date();
      part.revealedContent = solution.content;
      await this.partRepository.save(part);
    }

    const allParts = await this.partRepository.find({ where: { attemptId: attempt.id } });
    return this.toView(attempt, allParts);
  }

  /**
   * État courant d'une tentative, avec son statut calculé
   * (docs/architecture.md > « Refonte des Exercices », point 9).
   */
  async findOne(
    attemptId: string,
    userId: string,
    userRole: string,
  ): Promise<ExerciseAttemptView> {
    if (!EXERCISE_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent consulter une tentative d\'Exercice',
      );
    }

    const attempt = await this.findOwnedAttemptOrFail(attemptId, userId);
    const parts = await this.partRepository.find({ where: { attemptId: attempt.id } });
    return this.toView(attempt, parts);
  }

  /**
   * Octets d'une image de solution déjà révélée, via la seconde médiation
   * interne (content-catalog-service ne transite jamais d'image en base64
   * dans un JSON). L'itemId doit appartenir à un bloc de cette tentative dont
   * la solution a déjà été révélée — jamais un id orphelin accepté à
   * l'aveugle : on ne sert pas une image de solution qui n'a pas été
   * explicitement révélée par cette tentative, même si content-catalog-service
   * l'accepterait techniquement (pas de fuite d'une solution non révélée par
   * ce biais).
   */
  async getRevealedImage(
    attemptId: string,
    itemId: string,
    userId: string,
    userRole: string,
    correlationId?: string,
  ): Promise<ExerciseSolutionImage> {
    if (!EXERCISE_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent consulter une image de solution d\'Exercice',
      );
    }

    const attempt = await this.findOwnedAttemptOrFail(attemptId, userId);
    const parts = await this.partRepository.find({ where: { attemptId: attempt.id } });

    const hasRevealedImageItem = parts.some(
      (part) =>
        part.solutionRevealed &&
        part.revealedContent?.some((item) => item.id === itemId && item.type === 'image'),
    );

    if (!hasRevealedImageItem) {
      throw new NotFoundException(`Image de solution ${itemId} introuvable pour cette tentative`);
    }

    return this.solutionClient.getImageBytes(itemId, correlationId);
  }

  /**
   * Historique des tentatives d'Exercice de l'utilisateur authentifié,
   * passées et en cours, avec leur statut — même principe que l'historique
   * de tentatives Quizz.
   */
  async history(userId: string): Promise<ExerciseAttemptView[]> {
    const attempts = await this.attemptRepository.find({
      where: { userId },
      order: { startedAt: 'DESC' },
    });

    const views: ExerciseAttemptView[] = [];
    for (const attempt of attempts) {
      const parts = await this.partRepository.find({ where: { attemptId: attempt.id } });
      views.push(this.toView(attempt, parts));
    }
    return views;
  }

  /**
   * Fait quand *toutes* les solutions ont été révélées, ou quand *toutes*
   * les questions ont reçu une réponse (l'une des deux conditions suffit).
   * Un exercice sans bloc question est trivialement fait (vérité vacueuse) :
   * il n'y a rien à compléter.
   */
  private computeStatus(parts: ExerciseAttemptPart[]): ExerciseAttemptStatus {
    if (parts.length === 0) {
      return ExerciseAttemptStatus.DONE;
    }

    const allRevealed = parts.every((part) => part.solutionRevealed);
    const allAnswered = parts.every(
      (part) => part.answerContent !== null && part.answerContent !== undefined,
    );

    return allRevealed || allAnswered
      ? ExerciseAttemptStatus.DONE
      : ExerciseAttemptStatus.IN_PROGRESS;
  }

  private toView(attempt: ExerciseAttempt, parts: ExerciseAttemptPart[]): ExerciseAttemptView {
    return {
      id: attempt.id,
      exerciseId: attempt.exerciseId,
      userId: attempt.userId,
      userRole: attempt.userRole,
      status: this.computeStatus(parts),
      startedAt: attempt.startedAt,
      updatedAt: attempt.updatedAt,
      parts: parts.map((part) => ({
        partId: part.partId,
        answerContent: part.answerContent,
        answeredAt: part.answeredAt,
        solutionRevealed: part.solutionRevealed,
        revealedAt: part.revealedAt,
        revealedContent: part.solutionRevealed ? part.revealedContent : null,
      })),
    };
  }

  /**
   * Une tentative appartient strictement à celui qui l'a démarrée. Une
   * tentative absente ou appartenant à un tiers renvoie la même erreur 404 :
   * on ne révèle pas l'existence d'une tentative sur laquelle on n'a aucun
   * droit (même convention que les autres masquages du projet).
   */
  private async findOwnedAttemptOrFail(attemptId: string, userId: string): Promise<ExerciseAttempt> {
    const attempt = await this.attemptRepository.findOne({ where: { id: attemptId } });

    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException(`Tentative d'Exercice ${attemptId} introuvable`);
    }

    return attempt;
  }

  private async findPartOrFail(attemptId: string, partId: string): Promise<ExerciseAttemptPart> {
    const part = await this.partRepository.findOne({ where: { attemptId, partId } });

    if (!part) {
      throw new NotFoundException(`Bloc question ${partId} introuvable pour cette tentative`);
    }

    return part;
  }
}
