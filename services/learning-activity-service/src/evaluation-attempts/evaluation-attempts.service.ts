import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvaluationAttempt, EvaluationAnswerEntry } from './entities/evaluation-attempt.entity';
import {
  EvaluationCorrectionRequest,
} from './entities/evaluation-correction-request.entity';
import { StartEvaluationAttemptDto } from './dto/start-evaluation-attempt.dto';
import { SubmitEvaluationAnswerDto } from './dto/submit-evaluation-answer.dto';
import { EvaluationStructureClientService } from './evaluation-structure-client.service';
import { ProfileRelationsClientService } from './profile-relations-client.service';
import { EventsService } from './events/events.service';
import { EVALUATION_CORRECTION_REQUESTED, EVALUATION_CORRECTION_ALL_DECLINED } from './events/evaluation-event-types';
import { EvaluationAttemptStatus } from '../common/enums/evaluation-attempt-status.enum';
import { EvaluationCorrectionStatus } from '../common/enums/evaluation-correction-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * Peuvent démarrer et passer une Évaluation : élèves, professeurs, RP, AP —
 * mêmes 4 rôles que le Quizz et l'Exercice (docs/architecture.md >
 * « Refonte des Evaluations », point 5 : « Les droits et historiques se
 * gerent de la meme maniere que les quizz et exercices »).
 */
const EVALUATION_TAKER_ROLES: string[] = [
  UserRole.ELEVE,
  UserRole.FORMATEUR,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
];

export interface EvaluationAttemptView {
  id: string;
  evaluationId: string;
  userId: string;
  userRole: string;
  status: EvaluationAttemptStatus;
  startedAt: Date;
  deadlineAt: Date;
  completedAt: Date | null;
  answers: EvaluationAnswerEntry[];
  timeExpired: boolean;
}

@Injectable()
export class EvaluationAttemptsService {
  constructor(
    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepository: Repository<EvaluationAttempt>,
    @InjectRepository(EvaluationCorrectionRequest)
    private readonly correctionRepository: Repository<EvaluationCorrectionRequest>,
    private readonly structureClient: EvaluationStructureClientService,
    private readonly relationsClient: ProfileRelationsClientService,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Démarre une tentative d'Évaluation : vérifie que l'Évaluation est
   * `validated` et calcule `deadlineAt` à partir de `durationSeconds`
   * (docs/architecture.md > « Refonte des Evaluations », points 3-4).
   */
  async start(
    startDto: StartEvaluationAttemptDto,
    userId: string,
    userRole: string,
    authorizationHeader: string | undefined,
    correlationId?: string,
  ): Promise<EvaluationAttemptView> {
    if (!EVALUATION_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent démarrer une Évaluation',
      );
    }

    const structure = await this.structureClient.getStructure(
      startDto.evaluationId,
      authorizationHeader,
      correlationId,
    );

    if (structure.status !== 'validated') {
      throw new BadRequestException('Cette Évaluation n\'est pas encore validée');
    }

    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + structure.durationSeconds * 1000);

    const attempt = await this.attemptRepository.save(
      this.attemptRepository.create({
        evaluationId: startDto.evaluationId,
        userId,
        userRole,
        status: EvaluationAttemptStatus.IN_PROGRESS,
        exerciseIds: structure.exerciseItems.map((item) => item.exerciseId),
        answers: [],
        deadlineAt,
      }),
    );

    return this.toView(attempt);
  }

  /**
   * Soumet ou remplace la réponse à un bloc question d'un des Exercices de
   * l'Évaluation. Refuse explicitement après l'échéance ou une fois la
   * tentative close — verrouillage de confiance, pas une protection
   * anti-triche durcie (point 3 de l'arbitrage).
   */
  async submitAnswer(
    attemptId: string,
    answerDto: SubmitEvaluationAnswerDto,
    userId: string,
    userRole: string,
  ): Promise<EvaluationAttemptView> {
    if (!EVALUATION_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent répondre à une Évaluation',
      );
    }

    const attempt = await this.findOwnedAttemptOrFail(attemptId, userId);

    if (attempt.status !== EvaluationAttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Cette tentative est déjà terminée, elle ne peut plus être modifiée');
    }

    if (new Date() >= attempt.deadlineAt) {
      throw new BadRequestException(
        'Le temps imparti est écoulé, vous ne pouvez plus modifier vos réponses',
      );
    }

    if (!attempt.exerciseIds.includes(answerDto.exerciseId)) {
      throw new BadRequestException(
        `L'Exercice ${answerDto.exerciseId} ne fait pas partie de cette Évaluation`,
      );
    }

    const answeredAt = new Date().toISOString();
    const newEntry: EvaluationAnswerEntry = {
      exerciseId: answerDto.exerciseId,
      partId: answerDto.partId,
      content: answerDto.content,
      answeredAt,
    };

    const remaining = attempt.answers.filter(
      (entry) => !(entry.exerciseId === answerDto.exerciseId && entry.partId === answerDto.partId),
    );
    attempt.answers = [...remaining, newEntry];

    await this.attemptRepository.save(attempt);
    return this.toView(attempt);
  }

  /**
   * « Enregistrer sa réponse » : clôture la tentative sans déclencher quoi
   * que ce soit d'autre (docs/architecture.md > « Refonte des Evaluations »,
   * point 4a). Autorisé même après l'échéance — il s'agit de figer ce qui a
   * été répondu, pas d'ouvrir une nouvelle fenêtre de saisie.
   */
  async submit(attemptId: string, userId: string, userRole: string): Promise<EvaluationAttemptView> {
    if (!EVALUATION_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent clôturer une tentative d\'Évaluation',
      );
    }

    const attempt = await this.findOwnedAttemptOrFail(attemptId, userId);

    if (attempt.status !== EvaluationAttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('Cette tentative est déjà terminée');
    }

    attempt.status = EvaluationAttemptStatus.COMPLETED;
    attempt.completedAt = new Date();
    await this.attemptRepository.save(attempt);

    return this.toView(attempt);
  }

  /**
   * « Demander une correction » : peut être appelée juste après submit() ou
   * plus tard depuis l'historique. Notifie les professeurs liés à l'élève
   * et le RP (point 4b). Un élève sans aucun professeur lié bascule
   * directement en ALL_DECLINED (vérité vacueuse : « tous » les zéro
   * professeurs liés ont refusé), pour que le RP soit notifié sans attendre
   * un refus qui ne peut jamais survenir.
   */
  async requestCorrection(
    attemptId: string,
    userId: string,
    userRole: string,
    correlationId?: string,
  ): Promise<EvaluationCorrectionRequest> {
    if (!EVALUATION_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent demander une correction',
      );
    }

    const attempt = await this.findOwnedAttemptOrFail(attemptId, userId);

    if (attempt.status !== EvaluationAttemptStatus.COMPLETED) {
      throw new BadRequestException(
        'La tentative doit être enregistrée (« enregistrer sa réponse ») avant de demander une correction',
      );
    }

    const existing = await this.correctionRepository.findOne({ where: { attemptId: attempt.id } });
    if (
      existing &&
      [
        EvaluationCorrectionStatus.PENDING,
        EvaluationCorrectionStatus.ACCEPTED,
        EvaluationCorrectionStatus.CORRECTED,
      ].includes(existing.status)
    ) {
      throw new BadRequestException('Une demande de correction est déjà en cours pour cette tentative');
    }

    const linkedTeacherIds = await this.relationsClient.getLinkedTeacherIds(userId, correlationId);

    const correctionRequest = await this.correctionRepository.save(
      this.correctionRepository.create({
        attemptId: attempt.id,
        evaluationId: attempt.evaluationId,
        studentId: userId,
        status:
          linkedTeacherIds.length > 0
            ? EvaluationCorrectionStatus.PENDING
            : EvaluationCorrectionStatus.ALL_DECLINED,
        linkedTeacherIds,
        declinedByTeacherIds: [],
      }),
    );

    if (linkedTeacherIds.length > 0) {
      await this.eventsService.emit(
        EVALUATION_CORRECTION_REQUESTED,
        {
          correctionRequestId: correctionRequest.id,
          attemptId: attempt.id,
          evaluationId: attempt.evaluationId,
          studentId: userId,
          teacherIds: linkedTeacherIds,
        },
        correlationId,
      );
    } else {
      await this.eventsService.emit(
        EVALUATION_CORRECTION_ALL_DECLINED,
        {
          correctionRequestId: correctionRequest.id,
          attemptId: attempt.id,
          evaluationId: attempt.evaluationId,
          studentId: userId,
          reason: 'no_linked_teacher',
        },
        correlationId,
      );
    }

    return correctionRequest;
  }

  /**
   * État courant d'une tentative, avec l'indicateur `timeExpired` calculé à
   * la volée (jamais persisté) pour que le front sache s'il doit encore
   * proposer la saisie de réponses.
   */
  async findOne(attemptId: string, userId: string, userRole: string): Promise<EvaluationAttemptView> {
    if (!EVALUATION_TAKER_ROLES.includes(userRole)) {
      throw new ForbiddenException(
        'Seuls les élèves, formateurs, RP et AP peuvent consulter une tentative d\'Évaluation',
      );
    }

    const attempt = await this.findOwnedAttemptOrFail(attemptId, userId);
    return this.toView(attempt);
  }

  /**
   * Historique des tentatives d'Évaluation de l'utilisateur authentifié,
   * passées et en cours — même principe que l'historique Quizz/Exercice. Le
   * front joint la demande de correction éventuelle via
   * GET /evaluation-corrections?attemptId=... si besoin (pas embarquée ici
   * pour garder cette méthode indépendante du module de correction).
   */
  async history(userId: string): Promise<EvaluationAttemptView[]> {
    const attempts = await this.attemptRepository.find({
      where: { userId },
      order: { startedAt: 'DESC' },
    });

    return attempts.map((attempt) => this.toView(attempt));
  }

  private toView(attempt: EvaluationAttempt): EvaluationAttemptView {
    return {
      id: attempt.id,
      evaluationId: attempt.evaluationId,
      userId: attempt.userId,
      userRole: attempt.userRole,
      status: attempt.status,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      completedAt: attempt.completedAt,
      answers: attempt.answers,
      timeExpired: new Date() >= attempt.deadlineAt,
    };
  }

  /**
   * Une tentative appartient strictement à celui qui l'a démarrée. Une
   * tentative absente ou appartenant à un tiers renvoie la même erreur 404 :
   * on ne révèle pas l'existence d'une tentative sur laquelle on n'a aucun
   * droit (même convention que les autres masquages du projet).
   */
  private async findOwnedAttemptOrFail(attemptId: string, userId: string): Promise<EvaluationAttempt> {
    const attempt = await this.attemptRepository.findOne({ where: { id: attemptId } });

    if (!attempt || attempt.userId !== userId) {
      throw new NotFoundException(`Tentative d'Évaluation ${attemptId} introuvable`);
    }

    return attempt;
  }
}
