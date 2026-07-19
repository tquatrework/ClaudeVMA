import {
  Injectable,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceOwnerStudentLink } from './entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from './entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from './entities/pedagogical-coordinator-link.entity';
import { CreateFinanceOwnerStudentLinkDto } from './dto/create-finance-owner-student-link.dto';
import { CreateTeacherStudentLinkDto } from './dto/create-teacher-student-link.dto';
import { CreatePedagogicalCoordinatorLinkDto } from './dto/create-pedagogical-coordinator-link.dto';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';
import { Actor } from '../profiles/profiles.service';

@Injectable()
export class RelationsService {
  constructor(
    @InjectRepository(FinanceOwnerStudentLink)
    private readonly financeRepo: Repository<FinanceOwnerStudentLink>,
    @InjectRepository(TeacherStudentLink)
    private readonly teacherRepo: Repository<TeacherStudentLink>,
    @InjectRepository(PedagogicalCoordinatorLink)
    private readonly coordinatorRepo: Repository<PedagogicalCoordinatorLink>,
    private readonly events: EventsService,
  ) {}

  /**
   * Create a financeur→élève link.
   * Allowed for RP and AdministrateurFinancier.
   */
  async linkFinanceOwnerToStudent(dto: CreateFinanceOwnerStudentLinkDto, actor: Actor) {
    const allowed = [UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ADMINISTRATEUR_FINANCIER];
    if (!allowed.includes(actor.role)) {
      throw new ForbiddenException('Only RP or AdministrateurFinancier can create financeur–étudiant links');
    }

    const existing = await this.financeRepo.findOne({
      where: { financeOwnerId: dto.financeOwnerId, studentId: dto.studentId },
    });
    if (existing) {
      throw new ConflictException('This financeur is already linked to this student');
    }

    const link = this.financeRepo.create(dto);
    const saved = await this.financeRepo.save(link);

    this.events.publish('StudentLinkedToFinanceOwner', {
      financeOwnerId: dto.financeOwnerId,
      studentId: dto.studentId,
      actorId: actor.id,
    });

    return saved;
  }

  /**
   * List all students linked to a financeur.
   * Accessible to RP, AdministrateurFinancier, and the financeur themselves.
   */
  async getStudentsByFinanceOwner(financeOwnerId: string, actor: Actor) {
    const allowed = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (!allowed.includes(actor.role) && actor.id !== financeOwnerId) {
      throw new ForbiddenException('You may only list your own linked students');
    }

    return this.financeRepo.find({ where: { financeOwnerId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Create a formateur→élève link.
   * Restricted to RP only.
   */
  async linkTeacherToStudent(dto: CreateTeacherStudentLinkDto, actor: Actor) {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only RP can create formateur–étudiant links');
    }

    const existing = await this.teacherRepo.findOne({
      where: { teacherId: dto.teacherId, studentId: dto.studentId },
    });
    if (existing) {
      throw new ConflictException('This teacher is already linked to this student');
    }

    const link = this.teacherRepo.create({
      teacherId: dto.teacherId,
      studentId: dto.studentId,
      isPrincipalTeacher: dto.isPrincipalTeacher ?? false,
    });
    const saved = await this.teacherRepo.save(link);

    this.events.publish('TeacherLinkedToStudent', {
      teacherId: dto.teacherId,
      studentId: dto.studentId,
      isPrincipalTeacher: saved.isPrincipalTeacher,
      actorId: actor.id,
    });

    return saved;
  }

  /**
   * List all teachers linked to a student.
   * Accessible to RP, TI, AdministrateurFinancier, the student themselves,
   * and any PARENT_FINANCEUR who is actually linked to that student.
   * Formateurs may also see their own links to that student.
   */
  async getTeachersByStudent(studentId: string, actor: Actor) {
    const privileged = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];

    if (privileged.includes(actor.role) || actor.id === studentId) {
      return this.teacherRepo.find({ where: { studentId }, order: { createdAt: 'ASC' } });
    }

    // A formateur may see only their own link to the student (PROF-FB-003)
    if (actor.role === UserRole.FORMATEUR) {
      return this.teacherRepo.find({ where: { teacherId: actor.id, studentId } });
    }

    // A PARENT_FINANCEUR may see all teachers of a student they are linked to
    if (actor.role === UserRole.PARENT_FINANCEUR) {
      const parentStudentLink = await this.financeRepo.findOne({
        where: { financeOwnerId: actor.id, studentId },
      });
      if (!parentStudentLink) {
        throw new ForbiddenException(
          'You are not linked to this student and cannot list their teachers',
        );
      }
      return this.teacherRepo.find({ where: { studentId }, order: { createdAt: 'ASC' } });
    }

    throw new ForbiddenException('Insufficient rights to list teachers for this student');
  }

  /**
   * List all financeurs (parents) linked to a given student.
   * Symmetric counterpart of getStudentsByFinanceOwner.
   * Accessible to the student themselves, RP, TI, and AdministrateurFinancier.
   */
  async getFinanceOwnersByStudent(studentId: string, actor: Actor) {
    const privilegedRoles = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];

    if (!privilegedRoles.includes(actor.role) && actor.id !== studentId) {
      throw new ForbiddenException(
        'Vous ne pouvez consulter que vos propres financeurs rattachés',
      );
    }

    return this.financeRepo.find({ where: { studentId }, order: { createdAt: 'ASC' } });
  }

  /**
   * Assign a RP or AP as coordinator for a student (PROF-BR-004 / responsibility 4).
   * Restricted to RP only.
   */
  async linkPedagogicalCoordinator(dto: CreatePedagogicalCoordinatorLinkDto, actor: Actor) {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only RP can assign a pedagogical coordinator');
    }

    const existing = await this.coordinatorRepo.findOne({
      where: { coordinatorId: dto.coordinatorId, studentId: dto.studentId },
    });
    if (existing) {
      throw new ConflictException('This coordinator is already linked to this student');
    }

    const link = this.coordinatorRepo.create(dto);
    const saved = await this.coordinatorRepo.save(link);

    this.events.publish('CoordinatorLinkedToStudent', {
      coordinatorId: dto.coordinatorId,
      studentId: dto.studentId,
      coordinatorRole: dto.coordinatorRole,
      actorId: actor.id,
    });

    return saved;
  }

  /**
   * List all students assigned to a coordinator.
   * Accessible to RP, TI, and the coordinator themselves.
   */
  async getStudentsByCoordinator(coordinatorId: string, actor: Actor) {
    const privileged = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (!privileged.includes(actor.role) && actor.id !== coordinatorId) {
      throw new ForbiddenException('You may only list your own students');
    }
    return this.coordinatorRepo.find({ where: { coordinatorId }, order: { createdAt: 'ASC' } });
  }
}
