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
import { Actor } from '../common/types/actor.type';
import {
  AdministrativeName,
  AdministrativeProfileLookupService,
} from '../profiles/administrative-profile-lookup.service';

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
    private readonly administrativeProfileLookup: AdministrativeProfileLookupService,
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
   * Each item is enriched with the student's name (studentName), resolved
   * from AdministrativeProfileLookupService — see attachStudentNames.
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

    const links = await this.financeRepo.find({ where: { financeOwnerId }, order: { createdAt: 'ASC' } });
    return this.attachStudentNames(links);
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
   * Each item is enriched with the financeur's name (financeOwnerName),
   * resolved from AdministrativeProfileLookupService — see
   * attachFinanceOwnerNames. Fixes a bug where the finance-owners tab on a
   * student's profile only ever showed the financeur's raw UUID.
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

    const links = await this.financeRepo.find({ where: { studentId }, order: { createdAt: 'ASC' } });
    return this.attachFinanceOwnerNames(links);
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

  // ---------------------------------------------------------------------------
  // Ports consumed by other features (profiles, parent-link-requests, internal)
  // ---------------------------------------------------------------------------
  //
  // These methods are the explicit ports through which other features consume
  // TeacherStudentLink / FinanceOwnerStudentLink / PedagogicalCoordinatorLink
  // capabilities without ever injecting these repositories directly
  // (modules-convention & services-convention: "une feature n'accède qu'aux
  // repositories des entités qu'elle possède").

  /**
   * Read-only port used by ProfilesService.assertReadAccess (PROF-FB-003):
   * a formateur may only read profiles of students they are linked to.
   */
  async isTeacherLinkedToStudent(teacherId: string, studentId: string): Promise<boolean> {
    const link = await this.teacherRepo.findOne({ where: { teacherId, studentId } });
    return !!link;
  }

  /**
   * Read-only port used by ProfilesService.assertReadAccess (PROF-RA-002):
   * a parent_financeur may only read profiles of students they are linked to.
   */
  async isFinanceOwnerLinkedToStudent(financeOwnerId: string, studentId: string): Promise<boolean> {
    const link = await this.financeRepo.findOne({ where: { financeOwnerId, studentId } });
    return !!link;
  }

  /**
   * Idempotent port used by ParentLinkRequestsService when a request is
   * approved: creates the finance-owner–student link if it does not exist
   * yet, or returns the existing one. Authorization is already enforced by
   * ParentLinkRequestsService.assertCanProcessRequest, so no actor/role
   * check is repeated here.
   */
  async ensureFinanceOwnerStudentLink(
    financeOwnerId: string,
    studentId: string,
  ): Promise<FinanceOwnerStudentLink> {
    const existing = await this.financeRepo.findOne({ where: { financeOwnerId, studentId } });
    if (existing) return existing;

    const link = this.financeRepo.create({ financeOwnerId, studentId });
    return this.financeRepo.save(link);
  }

  /**
   * System-triggered link creation used by InternalService during account
   * onboarding (no human actor — authorization is enforced upstream by
   * InternalGuard/X-Internal-Secret). Mirrors linkFinanceOwnerToStudent but
   * without a role check or event publication, preserving the existing
   * internal bootstrap contract (409 when the link already exists).
   */
  async createFinanceOwnerStudentLinkForSystem(
    financeOwnerId: string,
    studentId: string,
  ): Promise<FinanceOwnerStudentLink> {
    const existing = await this.financeRepo.findOne({ where: { financeOwnerId, studentId } });
    if (existing) {
      throw new ConflictException('This financeur is already linked to this student');
    }

    const link = this.financeRepo.create({ financeOwnerId, studentId });
    return this.financeRepo.save(link);
  }

  /**
   * System-triggered link creation used by InternalService during account
   * onboarding (no human actor). Mirrors linkTeacherToStudent without a role
   * check or event publication.
   */
  async createTeacherStudentLinkForSystem(
    teacherId: string,
    studentId: string,
    isPrincipalTeacher = false,
  ): Promise<TeacherStudentLink> {
    const existing = await this.teacherRepo.findOne({ where: { teacherId, studentId } });
    if (existing) {
      throw new ConflictException('This teacher is already linked to this student');
    }

    const link = this.teacherRepo.create({ teacherId, studentId, isPrincipalTeacher });
    return this.teacherRepo.save(link);
  }

  /**
   * System-triggered link creation used by InternalService during account
   * onboarding (no human actor). Mirrors linkPedagogicalCoordinator without a
   * role check or event publication.
   */
  async createPedagogicalCoordinatorLinkForSystem(
    coordinatorId: string,
    studentId: string,
    coordinatorRole: string,
  ): Promise<PedagogicalCoordinatorLink> {
    const existing = await this.coordinatorRepo.findOne({ where: { coordinatorId, studentId } });
    if (existing) {
      throw new ConflictException('This coordinator is already linked to this student');
    }

    const link = this.coordinatorRepo.create({ coordinatorId, studentId, coordinatorRole });
    return this.coordinatorRepo.save(link);
  }

  // ---------------------------------------------------------------------------
  // Response enrichment helpers (name resolution for relation list endpoints)
  // ---------------------------------------------------------------------------

  /**
   * Attaches studentName (firstName/lastName) to each finance-owner→student
   * link, resolved in a single batched query (services-convention: avoid
   * N+1). A student without an administrative profile — or without a
   * firstName/lastName on it — never fails the request: studentName is
   * simply null (link has no administrative profile at all) or
   * { firstName: null, lastName: null } (profile exists, name missing).
   */
  private async attachStudentNames<T extends { studentId: string }>(
    links: T[],
  ): Promise<(T & { studentName: AdministrativeName | null })[]> {
    const names = await this.administrativeProfileLookup.findNamesByUserIds(
      links.map((link) => link.studentId),
    );
    return links.map((link) => ({ ...link, studentName: names.get(link.studentId) ?? null }));
  }

  /**
   * Attaches financeOwnerName (firstName/lastName) to each
   * finance-owner→student link, resolved in a single batched query
   * (services-convention: avoid N+1). Same null-safety guarantee as
   * attachStudentNames.
   */
  private async attachFinanceOwnerNames<T extends { financeOwnerId: string }>(
    links: T[],
  ): Promise<(T & { financeOwnerName: AdministrativeName | null })[]> {
    const names = await this.administrativeProfileLookup.findNamesByUserIds(
      links.map((link) => link.financeOwnerId),
    );
    return links.map((link) => ({ ...link, financeOwnerName: names.get(link.financeOwnerId) ?? null }));
  }
}
