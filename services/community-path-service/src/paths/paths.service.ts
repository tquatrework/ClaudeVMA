import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningPath } from './entities/learning-path.entity';
import { PathStep } from './entities/path-step.entity';
import { PathEnrollment } from './entities/path-enrollment.entity';
import { PathProgress } from './entities/path-progress.entity';
import { Certificate } from './entities/certificate.entity';
import { CreatePathDto } from './dto/create-path.dto';
import { UpdateEnrollmentProgressDto } from './dto/update-enrollment-progress.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { PathStatus } from '../common/enums/path-status.enum';
import { EnrollmentStatus } from '../common/enums/enrollment-status.enum';

const PATH_CREATOR_ROLES: string[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
];

export const MAX_OPEN_ENROLLMENTS = 3;

@Injectable()
export class PathsService {
  constructor(
    @InjectRepository(LearningPath)
    private readonly pathRepository: Repository<LearningPath>,
    @InjectRepository(PathStep)
    private readonly stepRepository: Repository<PathStep>,
    @InjectRepository(PathEnrollment)
    private readonly enrollmentRepository: Repository<PathEnrollment>,
    @InjectRepository(PathProgress)
    private readonly progressRepository: Repository<PathProgress>,
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
  ) {}

  /**
   * Create a new learning path.
   * RP-created paths are immediately validated; AP-created paths need RP validation.
   */
  async createPath(
    createPathDto: CreatePathDto,
    creatorId: string,
    creatorRole: string,
  ): Promise<LearningPath> {
    if (!PATH_CREATOR_ROLES.includes(creatorRole)) {
      throw new ForbiddenException('Seuls les RP et AP peuvent créer des parcours');
    }

    const initialStatus =
      creatorRole === UserRole.RESPONSABLE_PEDAGOGIQUE
        ? PathStatus.VALIDATED
        : PathStatus.PENDING_VALIDATION;

    const newPath = this.pathRepository.create({
      title: createPathDto.title,
      description: createPathDto.description,
      level: createPathDto.level,
      difficulty: createPathDto.difficulty,
      theme: createPathDto.theme,
      competences: createPathDto.competences,
      tags: createPathDto.tags,
      imageUrl: createPathDto.imageUrl,
      status: initialStatus,
      createdById: creatorId,
      createdByRole: creatorRole,
    });

    const savedPath = await this.pathRepository.save(newPath);

    if (createPathDto.steps && createPathDto.steps.length > 0) {
      const stepEntities = createPathDto.steps.map((stepDto) =>
        this.stepRepository.create({
          learningPathId: savedPath.id,
          order: stepDto.order,
          title: stepDto.title,
          contentReferenceId: stepDto.contentReferenceId,
          contentType: stepDto.contentType,
        }),
      );
      await this.stepRepository.save(stepEntities);
    }

    return this.pathRepository.findOne({
      where: { id: savedPath.id },
      relations: ['steps'],
    });
  }

  /**
   * List learning paths. Returns only validated paths unless the requester is RP or TI.
   */
  async findAllPaths(requesterRole: string): Promise<LearningPath[]> {
    const isPrivilegedViewer =
      requesterRole === UserRole.RESPONSABLE_PEDAGOGIQUE ||
      requesterRole === UserRole.TECHNICIEN_INFORMATIQUE;

    const whereClause = isPrivilegedViewer ? {} : { status: PathStatus.VALIDATED };

    return this.pathRepository.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
      relations: ['steps'],
    });
  }

  /**
   * Validate a learning path created by AP. Only RP can validate.
   */
  async validatePath(
    pathId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<LearningPath> {
    if (requesterRole !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Seul un RP peut valider un parcours');
    }

    const learningPath = await this.pathRepository.findOne({
      where: { id: pathId },
    });

    if (!learningPath) {
      throw new NotFoundException(`Parcours ${pathId} introuvable`);
    }

    if (learningPath.status !== PathStatus.PENDING_VALIDATION) {
      throw new BadRequestException('Ce parcours n\'est pas en attente de validation');
    }

    learningPath.status = PathStatus.VALIDATED;

    return this.pathRepository.save(learningPath);
  }

  /**
   * Enroll a student in a learning path.
   * A student cannot have more than MAX_OPEN_ENROLLMENTS open enrollments.
   */
  async enrollStudent(
    pathId: string,
    studentId: string,
    requesterRole: string,
  ): Promise<PathEnrollment> {
    const learningPath = await this.pathRepository.findOne({
      where: { id: pathId },
    });

    if (!learningPath) {
      throw new NotFoundException(`Parcours ${pathId} introuvable`);
    }

    if (learningPath.status !== PathStatus.VALIDATED) {
      throw new BadRequestException('Ce parcours n\'est pas disponible pour l\'inscription');
    }

    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: { learningPathId: pathId, studentId },
    });

    if (existingEnrollment) {
      throw new BadRequestException('Vous êtes déjà inscrit à ce parcours');
    }

    const activeEnrollmentCount = await this.enrollmentRepository.count({
      where: { studentId, status: EnrollmentStatus.IN_PROGRESS },
    });

    if (activeEnrollmentCount >= MAX_OPEN_ENROLLMENTS) {
      throw new BadRequestException(
        `Vous ne pouvez pas avoir plus de ${MAX_OPEN_ENROLLMENTS} parcours ouverts simultanément`,
      );
    }

    const newEnrollment = this.enrollmentRepository.create({
      learningPathId: pathId,
      studentId,
      status: EnrollmentStatus.IN_PROGRESS,
      progressPercent: 0,
    });

    return this.enrollmentRepository.save(newEnrollment);
  }

  /**
   * Update the progress of a path enrollment.
   * Automatically computes percentage and issues a certificate when completed.
   */
  async updateEnrollmentProgress(
    enrollmentId: string,
    updateDto: UpdateEnrollmentProgressDto,
    requesterId: string,
  ): Promise<PathEnrollment> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id: enrollmentId },
      relations: ['progressEntries'],
    });

    if (!enrollment) {
      throw new NotFoundException(`Inscription ${enrollmentId} introuvable`);
    }

    if (enrollment.studentId !== requesterId) {
      throw new ForbiddenException('Vous ne pouvez mettre à jour que votre propre progression');
    }

    if (enrollment.status === EnrollmentStatus.COMPLETED) {
      throw new BadRequestException('Ce parcours est déjà terminé');
    }

    if (updateDto.completedStepId) {
      const existingProgress = await this.progressRepository.findOne({
        where: { enrollmentId, stepId: updateDto.completedStepId },
      });

      if (!existingProgress) {
        const newProgress = this.progressRepository.create({
          enrollmentId,
          stepId: updateDto.completedStepId,
          isCompleted: true,
        });
        await this.progressRepository.save(newProgress);
      } else {
        existingProgress.isCompleted = true;
        await this.progressRepository.save(existingProgress);
      }

      const learningPath = await this.pathRepository.findOne({
        where: { id: enrollment.learningPathId },
        relations: ['steps'],
      });

      if (learningPath && learningPath.steps.length > 0) {
        const completedCount = await this.progressRepository.count({
          where: { enrollmentId, isCompleted: true },
        });

        const totalSteps = learningPath.steps.length;
        enrollment.progressPercent = Math.round((completedCount / totalSteps) * 100);

        if (enrollment.progressPercent >= 100) {
          enrollment.status = EnrollmentStatus.COMPLETED;
          await this.issueCertificate(enrollment, learningPath.title);
        }
      }
    }

    if (updateDto.status && updateDto.status !== EnrollmentStatus.COMPLETED) {
      enrollment.status = updateDto.status;
    }

    return this.enrollmentRepository.save(enrollment);
  }

  private async issueCertificate(
    enrollment: PathEnrollment,
    pathTitle: string,
  ): Promise<Certificate> {
    const existingCertificate = await this.certificateRepository.findOne({
      where: { enrollmentId: enrollment.id },
    });

    if (existingCertificate) {
      return existingCertificate;
    }

    const newCertificate = this.certificateRepository.create({
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      learningPathId: enrollment.learningPathId,
      learningPathTitle: pathTitle,
    });

    return this.certificateRepository.save(newCertificate);
  }
}
