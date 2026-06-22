import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeProfile } from '../profiles/entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from '../profiles/entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from '../profiles/entities/teacher-pedagogical-profile.entity';
import { FinanceOwnerStudentLink } from '../relations/entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from '../relations/entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from '../relations/entities/pedagogical-coordinator-link.entity';

@Injectable()
export class InternalService {
  constructor(
    @InjectRepository(AdministrativeProfile)
    private readonly adminRepo: Repository<AdministrativeProfile>,
    @InjectRepository(StudentPedagogicalProfile)
    private readonly studentPedaRepo: Repository<StudentPedagogicalProfile>,
    @InjectRepository(TeacherPedagogicalProfile)
    private readonly teacherPedaRepo: Repository<TeacherPedagogicalProfile>,
    @InjectRepository(FinanceOwnerStudentLink)
    private readonly financeRepo: Repository<FinanceOwnerStudentLink>,
    @InjectRepository(TeacherStudentLink)
    private readonly teacherLinkRepo: Repository<TeacherStudentLink>,
    @InjectRepository(PedagogicalCoordinatorLink)
    private readonly coordinatorLinkRepo: Repository<PedagogicalCoordinatorLink>,
  ) {}

  async createStudentProfiles(dto: {
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthDate?: string;
    level?: string;
  }) {
    // Idempotence: upsert administrative profile
    let admin = await this.adminRepo.findOne({ where: { userId: dto.userId } });
    if (!admin) {
      admin = this.adminRepo.create({
        userId: dto.userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        telephone: dto.phone ?? undefined,
        dateNaissance: dto.birthDate,
      });
      await this.adminRepo.save(admin);
    }

    // Idempotence: upsert student pedagogical profile
    let peda = await this.studentPedaRepo.findOne({ where: { userId: dto.userId } });
    if (!peda) {
      peda = this.studentPedaRepo.create({
        userId: dto.userId,
        niveauScolaire: dto.level,
      });
      await this.studentPedaRepo.save(peda);
    }

    return {
      userId: dto.userId,
      administrativeProfile: admin,
      pedagogicalProfile: peda,
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
    // Idempotence: upsert administrative profile
    let admin = await this.adminRepo.findOne({ where: { userId: dto.userId } });
    if (!admin) {
      admin = this.adminRepo.create({
        userId: dto.userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        telephone: dto.phone ?? undefined,
      });
      await this.adminRepo.save(admin);
    }

    // Idempotence: upsert teacher pedagogical profile
    let peda = await this.teacherPedaRepo.findOne({ where: { userId: dto.userId } });
    if (!peda) {
      peda = this.teacherPedaRepo.create({
        userId: dto.userId,
        matieresEnseignees: dto.subjects,
        niveauxEnseignes: dto.levels,
        experiencePedagogique: dto.bio,
      });
      await this.teacherPedaRepo.save(peda);
    }

    return {
      userId: dto.userId,
      administrativeProfile: admin,
      pedagogicalProfile: peda,
    };
  }

  /**
   * Create a minimal administrative profile for any user role not covered by
   * createStudentProfiles or createTeacherProfiles (e.g. PARENT_FINANCEUR,
   * RESPONSABLE_PEDAGOGIQUE, TECHNICIEN_INFORMATIQUE, ADMINISTRATEUR_FINANCIER).
   * Idempotent: skips creation when a profile already exists.
   */
  async createAdministrativeProfile(dto: {
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    let admin = await this.adminRepo.findOne({ where: { userId: dto.userId } });
    if (!admin) {
      admin = this.adminRepo.create({
        userId: dto.userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        telephone: dto.phone ?? undefined,
      });
      await this.adminRepo.save(admin);
    }

    return { userId: dto.userId, administrativeProfile: admin };
  }

  async linkParent(dto: { studentId: string; financeOwnerId: string }) {
    const existing = await this.financeRepo.findOne({
      where: { financeOwnerId: dto.financeOwnerId, studentId: dto.studentId },
    });
    if (existing) throw new ConflictException('Parent already linked to this student');

    const link = this.financeRepo.create({
      financeOwnerId: dto.financeOwnerId,
      studentId: dto.studentId,
    });
    await this.financeRepo.save(link);

    return { linked: true, contacts: [dto.financeOwnerId] };
  }

  async createTeacherStudentRelation(dto: {
    teacherId: string;
    studentId: string;
    isPrincipalTeacher?: boolean;
  }) {
    const existing = await this.teacherLinkRepo.findOne({
      where: { teacherId: dto.teacherId, studentId: dto.studentId },
    });
    if (existing) throw new ConflictException('Teacher already linked to this student');

    const link = this.teacherLinkRepo.create({
      teacherId: dto.teacherId,
      studentId: dto.studentId,
      isPrincipalTeacher: dto.isPrincipalTeacher ?? false,
    });
    const saved = await this.teacherLinkRepo.save(link);

    return { teacherId: saved.teacherId, studentId: saved.studentId, isPrincipalTeacher: saved.isPrincipalTeacher };
  }

  async linkCoordinator(dto: {
    coordinatorId: string;
    studentId: string;
    coordinatorRole: string;
  }) {
    const existing = await this.coordinatorLinkRepo.findOne({
      where: { coordinatorId: dto.coordinatorId, studentId: dto.studentId },
    });
    if (existing) throw new ConflictException('Coordinator already linked to this student');

    const link = this.coordinatorLinkRepo.create({
      coordinatorId: dto.coordinatorId,
      studentId: dto.studentId,
      coordinatorRole: dto.coordinatorRole,
    });
    const saved = await this.coordinatorLinkRepo.save(link);

    return { coordinatorId: saved.coordinatorId, studentId: saved.studentId, coordinatorRole: saved.coordinatorRole };
  }
}
