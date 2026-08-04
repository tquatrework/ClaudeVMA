import { Injectable } from '@nestjs/common';
import { ProfilesService } from '../profiles/profiles.service';
import { RelationsService } from '../relations/relations.service';

/**
 * System-to-system adapter consumed by orchestration-service during account
 * onboarding (student, teacher, parent, coordinator bootstrap). It owns no
 * entity: every write goes through ProfilesService or RelationsService, the
 * modules that actually own the underlying data (modules-convention:
 * "une feature n'injecte jamais directement le repository d'une entité
 * possédée par une autre feature").
 *
 * Authorization for this whole module is enforced once at the HTTP boundary
 * by InternalGuard (X-Internal-Secret) — individual methods below do not take
 * an Actor because there is no human actor for a system-triggered bootstrap.
 */
@Injectable()
export class InternalService {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly relationsService: RelationsService,
  ) {}

  async createAdministrativeProfile(dto: {
    userId: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    const administrativeProfile = await this.profilesService.bootstrapAdministrativeProfile(dto);
    return { userId: dto.userId, administrativeProfile };
  }

  async createStudentProfiles(dto: {
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthDate?: string;
    level?: string;
  }) {
    const administrativeProfile = await this.profilesService.bootstrapAdministrativeProfile(dto);
    const pedagogicalProfile = await this.profilesService.bootstrapStudentPedagogicalProfile(dto);

    return {
      userId: dto.userId,
      administrativeProfile,
      pedagogicalProfile,
    };
  }

  async createTeacherProfiles(dto: {
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    subjects?: string[];
    levels?: string[];
    bio?: string;
  }) {
    const administrativeProfile = await this.profilesService.bootstrapAdministrativeProfile(dto);
    const pedagogicalProfile = await this.profilesService.bootstrapTeacherPedagogicalProfile(dto);

    return {
      userId: dto.userId,
      administrativeProfile,
      pedagogicalProfile,
    };
  }

  async linkParent(dto: { studentId: string; financeOwnerId: string }) {
    await this.relationsService.createFinanceOwnerStudentLinkForSystem(
      dto.financeOwnerId,
      dto.studentId,
    );
    return { linked: true, contacts: [dto.financeOwnerId] };
  }

  async createTeacherStudentRelation(dto: {
    teacherId: string;
    studentId: string;
    isPrincipalTeacher?: boolean;
  }) {
    const saved = await this.relationsService.createTeacherStudentLinkForSystem(
      dto.teacherId,
      dto.studentId,
      dto.isPrincipalTeacher ?? false,
    );
    return { teacherId: saved.teacherId, studentId: saved.studentId, isPrincipalTeacher: saved.isPrincipalTeacher };
  }

  async linkCoordinator(dto: {
    coordinatorId: string;
    studentId: string;
    coordinatorRole: string;
  }) {
    const saved = await this.relationsService.createPedagogicalCoordinatorLinkForSystem(
      dto.coordinatorId,
      dto.studentId,
      dto.coordinatorRole,
    );
    return {
      coordinatorId: saved.coordinatorId,
      studentId: saved.studentId,
      coordinatorRole: saved.coordinatorRole,
    };
  }
}
