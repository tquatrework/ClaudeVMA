import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeProfile } from '../profiles/entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from '../profiles/entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from '../profiles/entities/teacher-pedagogical-profile.entity';
import { FinanceOwnerStudentLink } from '../relations/entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from '../relations/entities/teacher-student-link.entity';

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
  ) {}

  async createStudentProfiles(dto: {
    accountId: string;
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    level?: string;
  }) {
    const admin = this.adminRepo.create({
      userId: dto.accountId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateNaissance: dto.birthDate,
    });
    await this.adminRepo.save(admin);

    const peda = this.studentPedaRepo.create({
      userId: dto.accountId,
      niveauScolaire: dto.level,
    });
    await this.studentPedaRepo.save(peda);

    return { profileId: dto.accountId };
  }

  async createTeacherProfiles(dto: {
    accountId: string;
    firstName?: string;
    lastName?: string;
    subjects?: string[];
    levels?: string[];
    bio?: string;
  }) {
    const admin = this.adminRepo.create({
      userId: dto.accountId,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    await this.adminRepo.save(admin);

    const peda = this.teacherPedaRepo.create({
      userId: dto.accountId,
      matieresEnseignees: dto.subjects,
      niveauxEnseignes: dto.levels,
      experiencePedagogique: dto.bio,
    });
    await this.teacherPedaRepo.save(peda);

    return { profileId: dto.accountId };
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
    await this.teacherLinkRepo.save(link);

    return { linked: true };
  }
}
