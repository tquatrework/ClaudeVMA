import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EvaluationCorrectionRequest } from './entities/evaluation-correction-request.entity';
import { EvaluationAttempt } from './entities/evaluation-attempt.entity';
import { CorrectEvaluationDto } from './dto/correct-evaluation.dto';
import { ProfileRelationsClientService } from './profile-relations-client.service';
import { EventsService } from './events/events.service';
import {
  EVALUATION_CORRECTION_ACCEPTED,
  EVALUATION_CORRECTION_DECLINED,
  EVALUATION_CORRECTION_ALL_DECLINED,
  EVALUATION_CORRECTED,
} from './events/evaluation-event-types';
import { EvaluationCorrectionStatus } from '../common/enums/evaluation-correction-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

export interface EvaluationCorrectionView {
  id: string;
  attemptId: string;
  evaluationId: string;
  studentId: string;
  status: EvaluationCorrectionStatus;
  linkedTeacherIds: string[];
  declinedByTeacherIds: string[];
  acceptedByTeacherId: string | null;
  score: number | null;
  comment: string | null;
  createdAt: Date;
  acceptedAt: Date | null;
  correctedAt: Date | null;
  /** Réponses de la tentative visée — jamais la solution officielle de
   *  l'Exercice (point 6 de l'arbitrage). N'est renvoyé que lorsque
   *  l'appelant a le droit de corriger (accepteur, ou RP). */
  attemptAnswers?: EvaluationAttempt['answers'];
}

/**
 * Gère la machine à états d'une demande de correction (docs/architecture.md
 * > « Refonte des Evaluations », points 4c-4d) : acceptation « premier
 * arrivé, premier servi » par un professeur lié à l'élève, refus individuel,
 * bascule en ALL_DECLINED quand tous les professeurs liés ont refusé (le RP
 * est alors sollicité manuellement — il peut accepter lui-même en override
 * d'escalade), et soumission de la correction par celui qui a accepté.
 *
 * La correction ne compare jamais à la solution officielle de l'Exercice :
 * le correcteur lit uniquement la réponse soumise par l'élève sur la
 * tentative visée (point 6).
 */
@Injectable()
export class EvaluationCorrectionsService {
  constructor(
    @InjectRepository(EvaluationCorrectionRequest)
    private readonly correctionRepository: Repository<EvaluationCorrectionRequest>,
    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepository: Repository<EvaluationAttempt>,
    private readonly relationsClient: ProfileRelationsClientService,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Acceptation « premier arrivé, premier servi » : tout `accept` suivant
   * échoue explicitement (400), jamais silencieusement.
   *   - Un professeur ne peut accepter qu'une demande PENDING, et doit être
   *     actuellement lié à l'élève (revérifié en direct auprès de
   *     profile-service, jamais en cache).
   *   - Le RP peut accepter depuis PENDING ou ALL_DECLINED (override
   *     d'escalade — « le RP gère manuellement, peut corriger lui-même »).
   */
  async accept(
    correctionRequestId: string,
    userId: string,
    userRole: string,
    correlationId?: string,
  ): Promise<EvaluationCorrectionView> {
    const correctionRequest = await this.findOrFail(correctionRequestId);

    if (userRole === UserRole.RESPONSABLE_PEDAGOGIQUE) {
      if (
        correctionRequest.status !== EvaluationCorrectionStatus.PENDING &&
        correctionRequest.status !== EvaluationCorrectionStatus.ALL_DECLINED
      ) {
        throw new BadRequestException(
          'Cette demande de correction est déjà prise en charge ou clôturée',
        );
      }
    } else if (userRole === UserRole.FORMATEUR) {
      if (correctionRequest.status !== EvaluationCorrectionStatus.PENDING) {
        throw new BadRequestException(
          'Cette demande de correction a déjà été prise en charge par un autre professeur',
        );
      }

      const linkedTeacherIds = await this.relationsClient.getLinkedTeacherIds(
        correctionRequest.studentId,
        correlationId,
      );
      if (!linkedTeacherIds.includes(userId)) {
        throw new ForbiddenException('Vous n\'êtes pas lié à l\'élève de cette tentative');
      }
    } else {
      throw new ForbiddenException('Seuls les professeurs liés à l\'élève et le RP peuvent accepter une correction');
    }

    correctionRequest.status = EvaluationCorrectionStatus.ACCEPTED;
    correctionRequest.acceptedByTeacherId = userId;
    correctionRequest.acceptedAt = new Date();
    await this.correctionRepository.save(correctionRequest);

    await this.eventsService.emit(
      EVALUATION_CORRECTION_ACCEPTED,
      {
        correctionRequestId: correctionRequest.id,
        attemptId: correctionRequest.attemptId,
        evaluationId: correctionRequest.evaluationId,
        studentId: correctionRequest.studentId,
        teacherId: userId,
      },
      correlationId,
    );

    return this.toView(correctionRequest);
  }

  /**
   * Refus individuel — chaque professeur lié peut refuser indépendamment.
   * Bascule en ALL_DECLINED seulement quand *tous* les professeurs
   * actuellement liés (relus en direct, pas la seule photo prise à la
   * création) ont refusé.
   */
  async decline(
    correctionRequestId: string,
    userId: string,
    userRole: string,
    correlationId?: string,
  ): Promise<EvaluationCorrectionView> {
    if (userRole !== UserRole.FORMATEUR) {
      throw new ForbiddenException('Seuls les professeurs liés à l\'élève peuvent refuser une correction');
    }

    const correctionRequest = await this.findOrFail(correctionRequestId);

    if (correctionRequest.status !== EvaluationCorrectionStatus.PENDING) {
      throw new BadRequestException('Cette demande de correction n\'est plus en attente');
    }

    const linkedTeacherIds = await this.relationsClient.getLinkedTeacherIds(
      correctionRequest.studentId,
      correlationId,
    );
    if (!linkedTeacherIds.includes(userId)) {
      throw new ForbiddenException('Vous n\'êtes pas lié à l\'élève de cette tentative');
    }

    if (!correctionRequest.declinedByTeacherIds.includes(userId)) {
      correctionRequest.declinedByTeacherIds = [...correctionRequest.declinedByTeacherIds, userId];
    }

    const allDeclined = linkedTeacherIds.every((teacherId) =>
      correctionRequest.declinedByTeacherIds.includes(teacherId),
    );

    if (allDeclined) {
      correctionRequest.status = EvaluationCorrectionStatus.ALL_DECLINED;
    }

    await this.correctionRepository.save(correctionRequest);

    await this.eventsService.emit(
      EVALUATION_CORRECTION_DECLINED,
      {
        correctionRequestId: correctionRequest.id,
        attemptId: correctionRequest.attemptId,
        evaluationId: correctionRequest.evaluationId,
        studentId: correctionRequest.studentId,
        teacherId: userId,
      },
      correlationId,
    );

    if (allDeclined) {
      await this.eventsService.emit(
        EVALUATION_CORRECTION_ALL_DECLINED,
        {
          correctionRequestId: correctionRequest.id,
          attemptId: correctionRequest.attemptId,
          evaluationId: correctionRequest.evaluationId,
          studentId: correctionRequest.studentId,
          reason: 'all_linked_teachers_declined',
        },
        correlationId,
      );
    }

    return this.toView(correctionRequest);
  }

  /**
   * Soumission de la correction (score et/ou commentaire) par celui qui a
   * accepté — jamais de comparaison à la solution officielle de l'Exercice
   * (point 6 de l'arbitrage).
   */
  async correct(
    correctionRequestId: string,
    correctDto: CorrectEvaluationDto,
    userId: string,
    correlationId?: string,
  ): Promise<EvaluationCorrectionView> {
    if (correctDto.score === undefined && correctDto.comment === undefined) {
      throw new BadRequestException('La correction doit porter au moins un score ou un commentaire');
    }

    const correctionRequest = await this.findOrFail(correctionRequestId);

    if (correctionRequest.status !== EvaluationCorrectionStatus.ACCEPTED) {
      throw new BadRequestException('Cette demande de correction n\'est pas en cours de prise en charge');
    }

    if (correctionRequest.acceptedByTeacherId !== userId) {
      throw new ForbiddenException('Seul le professeur (ou le RP) ayant accepté cette demande peut la corriger');
    }

    correctionRequest.status = EvaluationCorrectionStatus.CORRECTED;
    correctionRequest.score = correctDto.score ?? null;
    correctionRequest.comment = correctDto.comment ?? null;
    correctionRequest.correctedAt = new Date();
    await this.correctionRepository.save(correctionRequest);

    await this.eventsService.emit(
      EVALUATION_CORRECTED,
      {
        correctionRequestId: correctionRequest.id,
        attemptId: correctionRequest.attemptId,
        evaluationId: correctionRequest.evaluationId,
        studentId: correctionRequest.studentId,
        teacherId: userId,
        score: correctionRequest.score,
        comment: correctionRequest.comment,
      },
      correlationId,
    );

    return this.toView(correctionRequest);
  }

  /**
   * File d'attente : pour un professeur, les demandes PENDING où il figure
   * parmi les professeurs liés (snapshot pris à la création) et qu'il n'a
   * pas encore refusées ; pour le RP, toutes les demandes PENDING et
   * ALL_DECLINED (état terminal actionnable).
   */
  async pending(userId: string, userRole: string): Promise<EvaluationCorrectionView[]> {
    if (userRole === UserRole.RESPONSABLE_PEDAGOGIQUE) {
      const requests = await this.correctionRepository.find({
        where: [
          { status: EvaluationCorrectionStatus.PENDING },
          { status: EvaluationCorrectionStatus.ALL_DECLINED },
        ],
        order: { createdAt: 'ASC' },
      });
      return requests.map((request) => this.toView(request));
    }

    if (userRole === UserRole.FORMATEUR) {
      const requests = await this.correctionRepository.find({
        where: { status: EvaluationCorrectionStatus.PENDING },
        order: { createdAt: 'ASC' },
      });
      return requests
        .filter(
          (request) =>
            request.linkedTeacherIds.includes(userId) &&
            !request.declinedByTeacherIds.includes(userId),
        )
        .map((request) => this.toView(request));
    }

    throw new ForbiddenException('Seuls les professeurs et le RP consultent la file de corrections');
  }

  /**
   * Corrections acceptées et/ou soumises par l'appelant (professeur ou RP).
   */
  async mine(userId: string, userRole: string): Promise<EvaluationCorrectionView[]> {
    if (userRole !== UserRole.FORMATEUR && userRole !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Seuls les professeurs et le RP consultent leurs corrections');
    }

    const requests = await this.correctionRepository.find({
      where: { acceptedByTeacherId: userId },
      order: { createdAt: 'DESC' },
    });

    return requests.map((request) => this.toView(request));
  }

  /**
   * Détail d'une demande — la réponse de l'élève (`attemptAnswers`) n'est
   * jointe que pour l'appelant autorisé à corriger (accepteur ou RP) ou
   * pour l'élève lui-même consultant sa propre demande ; les autres rôles
   * reçoivent le détail sans les réponses.
   */
  async findOne(
    correctionRequestId: string,
    userId: string,
    userRole: string,
  ): Promise<EvaluationCorrectionView> {
    const correctionRequest = await this.findOrFail(correctionRequestId);

    const canSeeAnswers =
      correctionRequest.studentId === userId ||
      correctionRequest.acceptedByTeacherId === userId ||
      userRole === UserRole.RESPONSABLE_PEDAGOGIQUE ||
      (userRole === UserRole.FORMATEUR && correctionRequest.linkedTeacherIds.includes(userId));

    if (!canSeeAnswers) {
      throw new ForbiddenException('Vous n\'avez pas accès à cette demande de correction');
    }

    const base = this.toView(correctionRequest);
    if (canSeeAnswers) {
      const attempt = await this.attemptRepository.findOne({ where: { id: correctionRequest.attemptId } });
      base.attemptAnswers = attempt?.answers ?? [];
    }
    return base;
  }

  private toView(correctionRequest: EvaluationCorrectionRequest): EvaluationCorrectionView {
    return {
      id: correctionRequest.id,
      attemptId: correctionRequest.attemptId,
      evaluationId: correctionRequest.evaluationId,
      studentId: correctionRequest.studentId,
      status: correctionRequest.status,
      linkedTeacherIds: correctionRequest.linkedTeacherIds,
      declinedByTeacherIds: correctionRequest.declinedByTeacherIds,
      acceptedByTeacherId: correctionRequest.acceptedByTeacherId,
      score: correctionRequest.score,
      comment: correctionRequest.comment,
      createdAt: correctionRequest.createdAt,
      acceptedAt: correctionRequest.acceptedAt,
      correctedAt: correctionRequest.correctedAt,
    };
  }

  private async findOrFail(correctionRequestId: string): Promise<EvaluationCorrectionRequest> {
    const correctionRequest = await this.correctionRepository.findOne({
      where: { id: correctionRequestId },
    });

    if (!correctionRequest) {
      throw new NotFoundException(`Demande de correction ${correctionRequestId} introuvable`);
    }

    return correctionRequest;
  }
}
