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

  async getValidationHistory(contentId: string, contentType: ContentType): Promise<ContentValidation[]> {
    return this.validationRepository.find({
      where: { contentId, contentType },
      order: { createdAt: 'DESC' },
    });
  }
}
