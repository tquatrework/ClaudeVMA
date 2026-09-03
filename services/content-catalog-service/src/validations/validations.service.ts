import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentValidation } from './entities/content-validation.entity';
import { ValidateContentDto } from './dto/validate-content.dto';
import { ContentType } from '../common/enums/content-type.enum';
import { ContentStatus } from '../common/enums/content-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { Exercise } from '../exercises/entities/exercise.entity';
import { Evaluation } from '../evaluations/entities/evaluation.entity';
import { Tutorial } from '../tutorials/entities/tutorial.entity';
import { Quiz } from '../quizzes/entities/quiz.entity';
import { ProfileRelationsClient } from '../common/clients/profile-relations.client';

/** Rôles à accès non restreint sur l'historique de validation (comportement inchangé). */
const ADMIN_ROLES = [
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

@Injectable()
export class ValidationsService {
  constructor(
    @InjectRepository(ContentValidation)
    private readonly validationRepository: Repository<ContentValidation>,

    @InjectRepository(Exercise)
    private readonly exerciseRepository: Repository<Exercise>,

    @InjectRepository(Evaluation)
    private readonly evaluationRepository: Repository<Evaluation>,

    @InjectRepository(Tutorial)
    private readonly tutorialRepository: Repository<Tutorial>,

    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,

    private readonly profileRelationsClient: ProfileRelationsClient,
  ) {}

  async validateContent(
    contentId: string,
    contentType: ContentType,
    validateDto: ValidateContentDto,
    validatorId: string,
    validatorRole: string,
  ): Promise<ContentValidation> {
    const allowedValidatorRoles = [
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
    ];
    if (!allowedValidatorRoles.includes(validatorRole as UserRole)) {
      throw new ForbiddenException('Seuls les AP et RP peuvent valider des contenus');
    }

    if (validateDto.decision === ContentStatus.REJECTED && !validateDto.comment) {
      throw new BadRequestException('Un commentaire est obligatoire pour rejeter un contenu');
    }

    // Validation AP scopée par la relation animator_of_teacher — Quizz
    // (arbitrage du 2026-08-28), puis Exercice (arbitrage du 2026-08-29,
    // "Refonte des Exercices", point 5), puis Évaluation (arbitrage du
    // 2026-09-01, "Refonte des Evaluations", point 5 : "cette restriction
    // est levée par le présent arbitrage" — une note du 2026-08-28 disait
    // explicitement ce scoping limité au Quizz, cette limitation n'est plus
    // vraie), puis Tutoriel (arbitrage du 2026-09-03, "Refonte des
    // Tutos/Vidéos", point 7 : "réutiliser exactement le mécanisme déjà
    // construit pour Quizz/Exercice/Évaluation" — une note du 2026-08-29
    // disait ce scoping "limité au Quizz [...] Tutorial reste seul
    // inchangé", cette limitation n'est plus vraie non plus). RP reste sans
    // restriction pour les 4 types.
    if (
      (contentType === ContentType.QUIZ ||
        contentType === ContentType.EXERCISE ||
        contentType === ContentType.EVALUATION ||
        contentType === ContentType.TUTORIAL) &&
      validatorRole === UserRole.ANIMATEUR_PEDAGOGIQUE
    ) {
      const authorId = await this.getContentAuthorId(contentId, contentType);
      if (authorId === null) {
        const label = this.contentTypeLabel(contentType);
        throw new NotFoundException(`${label} ${contentId} introuvable`);
      }
      const hasRelation = await this.profileRelationsClient.hasAnimatorOfTeacherRelation(
        validatorId,
        authorId,
      );
      if (!hasRelation) {
        const label = this.contentTypePluralLabel(contentType);
        throw new ForbiddenException(
          `Vous ne pouvez valider que les ${label} des formateurs que vous animez`,
        );
      }
    }

    // Mettre à jour le statut du contenu
    await this.updateContentStatus(contentId, contentType, validateDto.decision);

    const validation = this.validationRepository.create({
      contentId,
      contentType,
      validatorId,
      validatorRole,
      decision: validateDto.decision,
      comment: validateDto.comment,
    });

    return this.validationRepository.save(validation);
  }

  async requestValidation(
    contentId: string,
    contentType: ContentType,
    requesterId: string,
    requesterRole: string,
  ): Promise<void> {
    const allowedRoles = [
      UserRole.FORMATEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
    ];
    if (!allowedRoles.includes(requesterRole as UserRole)) {
      throw new ForbiddenException('Seuls les formateurs et rôles pédagogiques peuvent soumettre un contenu à validation');
    }

    await this.updateContentStatus(contentId, contentType, ContentStatus.PENDING_VALIDATION);
  }

  private async updateContentStatus(
    contentId: string,
    contentType: ContentType,
    newStatus: ContentStatus,
  ): Promise<void> {
    switch (contentType) {
      case ContentType.EXERCISE: {
        const exercise = await this.exerciseRepository.findOne({ where: { id: contentId } });
        if (!exercise) throw new NotFoundException(`Exercice ${contentId} introuvable`);
        exercise.status = newStatus;
        await this.exerciseRepository.save(exercise);
        break;
      }
      case ContentType.EVALUATION: {
        const evaluation = await this.evaluationRepository.findOne({ where: { id: contentId } });
        if (!evaluation) throw new NotFoundException(`Évaluation ${contentId} introuvable`);
        evaluation.status = newStatus;
        await this.evaluationRepository.save(evaluation);
        break;
      }
      case ContentType.TUTORIAL: {
        const tutorial = await this.tutorialRepository.findOne({ where: { id: contentId } });
        if (!tutorial) throw new NotFoundException(`Tutoriel ${contentId} introuvable`);
        tutorial.status = newStatus;
        await this.tutorialRepository.save(tutorial);
        break;
      }
      case ContentType.QUIZ: {
        const quiz = await this.quizRepository.findOne({ where: { id: contentId } });
        if (!quiz) throw new NotFoundException(`Quizz ${contentId} introuvable`);
        quiz.status = newStatus;
        await this.quizRepository.save(quiz);
        break;
      }
      default:
        throw new BadRequestException(`Type de contenu inconnu : ${contentType}`);
    }
  }

  /**
   * Historique des décisions de validation d'un contenu.
   *
   * Ouvert sans restriction aux AP/RP/TI (comportement inchangé), et à
   * l'auteur du contenu visé pour son propre historique — notamment pour
   * relire le motif de son propre refus (arbitrage du 2026-08-28, "Lecture
   * de sa propre solution... et de son propre motif de refus"). Mécanisme
   * partagé par les 4 types de contenu du flux de validation générique
   * (exercise/evaluation/tutorial/quiz), pas une exception réservée au
   * Quizz.
   */
  async getValidationHistory(
    contentId: string,
    contentType: ContentType,
    callerId: string,
    callerRole: string,
  ): Promise<ContentValidation[]> {
    if (!ADMIN_ROLES.includes(callerRole as UserRole)) {
      const authorId = await this.getContentAuthorId(contentId, contentType);
      if (authorId === null) {
        throw new NotFoundException(`Contenu ${contentId} introuvable`);
      }
      if (authorId !== callerId) {
        throw new ForbiddenException(
          'Vous ne pouvez consulter que l\'historique de validation de vos propres contenus',
        );
      }
    }

    return this.validationRepository.find({
      where: { contentId, contentType },
      order: { createdAt: 'DESC' },
    });
  }

  /** Libellé singulier capitalisé pour un message de 404, par type de contenu. */
  private contentTypeLabel(contentType: ContentType): string {
    switch (contentType) {
      case ContentType.QUIZ:
        return 'Quizz';
      case ContentType.EXERCISE:
        return 'Exercice';
      case ContentType.EVALUATION:
        return 'Évaluation';
      case ContentType.TUTORIAL:
        return 'Tutoriel';
      default:
        return 'Contenu';
    }
  }

  /** Libellé pluriel minuscule pour un message de 403 ("... que vous animez"), par type de contenu. */
  private contentTypePluralLabel(contentType: ContentType): string {
    switch (contentType) {
      case ContentType.QUIZ:
        return 'quizz';
      case ContentType.EXERCISE:
        return 'exercices';
      case ContentType.EVALUATION:
        return 'évaluations';
      case ContentType.TUTORIAL:
        return 'tutoriels';
      default:
        return 'contenus';
    }
  }

  private async getContentAuthorId(contentId: string, contentType: ContentType): Promise<string | null> {
    switch (contentType) {
      case ContentType.EXERCISE: {
        const exercise = await this.exerciseRepository.findOne({ where: { id: contentId } });
        return exercise?.authorId ?? null;
      }
      case ContentType.EVALUATION: {
        const evaluation = await this.evaluationRepository.findOne({ where: { id: contentId } });
        return evaluation?.authorId ?? null;
      }
      case ContentType.TUTORIAL: {
        const tutorial = await this.tutorialRepository.findOne({ where: { id: contentId } });
        return tutorial?.authorId ?? null;
      }
      case ContentType.QUIZ: {
        const quiz = await this.quizRepository.findOne({ where: { id: contentId } });
        return quiz?.authorId ?? null;
      }
      default:
        throw new BadRequestException(`Type de contenu inconnu : ${contentType}`);
    }
  }
}
