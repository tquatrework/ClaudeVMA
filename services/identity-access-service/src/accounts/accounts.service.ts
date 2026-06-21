import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  User,
  UserRole,
  ValidationStatus,
  INTERNAL_ROLES,
  SELF_REGISTRATION_ROLES,
} from '../auth/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { CreateStudentAccountDto } from './dto/create-student-account.dto';
import { CreateTeacherAccountDto } from './dto/create-teacher-account.dto';
import { CreateParentAccountDto } from './dto/create-parent-account.dto';
import { UpdateAccountStatusDto, AccountStatusValue } from './dto/update-account-status.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { EventsService } from '../events/events.service';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    private readonly eventsService: EventsService,
  ) {}

  async createAccount(dto: CreateAccountDto, ipAddress?: string) {
    const role = dto.role ?? UserRole.ELEVE;

    if (INTERNAL_ROLES.includes(role)) {
      throw new ForbiddenException('Cannot self-register with an internal role (IAM-FB-002)');
    }

    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      role,
      validationStatus: ValidationStatus.PENDING,
      consentSigned: false,
    });
    const saved = await this.userRepo.save(user);

    this.eventsService.publish('AccountCreated', {
      userId: saved.id,
      email: saved.email,
      role: saved.role,
      ipAddress,
    });

    return this.toPublic(saved);
  }

  async getAccount(accountId: string) {
    const user = await this.findOrFail(accountId);
    return this.toPublic(user);
  }

  /**
   * PATCH /accounts/me — update the authenticated user's own account.
   * Only email and password can be changed via this route.
   * Role and status modifications are handled by dedicated admin routes.
   */
  async updateMe(currentUserId: string, dto: UpdateMeDto) {
    const account = await this.findOrFail(currentUserId);

    if (dto.email !== undefined && dto.email !== account.email) {
      const emailAlreadyTaken = await this.userRepo.findOne({ where: { email: dto.email } });
      if (emailAlreadyTaken) throw new ConflictException('Email already in use');
      account.email = dto.email;
    }

    if (dto.password !== undefined) {
      account.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const updatedAccount = await this.userRepo.save(account);
    return this.toPublic(updatedAccount);
  }

  async updateRoles(accountId: string, dto: UpdateRolesDto, actor: User) {
    const target = await this.findOrFail(accountId);

    const canAssignInternal = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ].includes(actor.role);

    if (INTERNAL_ROLES.includes(dto.role) && !canAssignInternal) {
      throw new ForbiddenException('Only RP or TI can assign internal roles');
    }

    const oldRole = target.role;
    target.role = dto.role;
    await this.userRepo.save(target);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: target.id,
        actorId: actor.id,
        action: 'ROLE_CHANGED',
        oldValue: { role: oldRole },
        newValue: { role: dto.role },
      }),
    );

    this.eventsService.publish('RoleChanged', {
      userId: target.id,
      oldRole,
      newRole: dto.role,
      actorId: actor.id,
    });

    return this.toPublic(target);
  }

  async validateAccount(accountId: string, actor: User) {
    const target = await this.findOrFail(accountId);

    const canValidate = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ].includes(actor.role);
    if (!canValidate) throw new ForbiddenException('Only RP or TI can validate accounts');

    if (!target.consentSigned) {
      throw new ForbiddenException('Account cannot be validated before mandatory consents are signed (IAM-FB-003)');
    }

    target.validationStatus = ValidationStatus.ACTIVE;
    await this.userRepo.save(target);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: target.id,
        actorId: actor.id,
        action: 'ACCOUNT_VALIDATED',
        oldValue: { validationStatus: ValidationStatus.PENDING },
        newValue: { validationStatus: ValidationStatus.ACTIVE },
      }),
    );

    this.eventsService.publish('AccountValidated', { userId: target.id, actorId: actor.id });

    return this.toPublic(target);
  }

  async suspendAccount(accountId: string, actor: User) {
    if (actor.role !== UserRole.TECHNICIEN_INFORMATIQUE) {
      throw new ForbiddenException('Only TI can suspend accounts');
    }

    const target = await this.findOrFail(accountId);
    const previousValidationStatus = target.validationStatus;

    target.validationStatus = ValidationStatus.SUSPENDED;
    target.isActive = false;
    await this.userRepo.save(target);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: target.id,
        actorId: actor.id,
        action: 'ACCOUNT_SUSPENDED',
        oldValue: { validationStatus: previousValidationStatus },
        newValue: { validationStatus: ValidationStatus.SUSPENDED },
      }),
    );

    this.eventsService.publish('AccountSuspended', { userId: target.id, actorId: actor.id });

    return this.toPublic(target);
  }

  async getAuditLogs(accountId: string) {
    await this.findOrFail(accountId);
    return this.auditRepo.find({
      where: { targetUserId: accountId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retourne la liste de tous les comptes (usage interne uniquement).
   * Filtre optionnel par rôle. N'expose pas les données sensibles.
   */
  async listAccounts(filterRole?: UserRole): Promise<{
    userId: string;
    role: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  }[]> {
    const whereClause = filterRole ? { role: filterRole } : {};
    const userList = await this.userRepo.find({ where: whereClause });
    return userList.map((user) => ({
      userId: user.id,
      role: user.role,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      phone: user.phone ?? null,
    }));
  }

  /**
   * Creates a student account (eleve role).
   * Optionally creates a linked parent financeur account in the same transaction.
   */
  async createStudentAccount(dto: CreateStudentAccountDto, ipAddress?: string) {
    const existingStudent = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingStudent) throw new ConflictException('Email already in use');

    const studentPasswordHash = await bcrypt.hash(dto.password, 12);
    const student = this.userRepo.create({
      email: dto.email,
      passwordHash: studentPasswordHash,
      role: UserRole.ELEVE,
      validationStatus: ValidationStatus.PENDING,
      consentSigned: false,
    });
    const savedStudent = await this.userRepo.save(student);

    this.eventsService.publish('AccountCreated', {
      userId: savedStudent.id,
      email: savedStudent.email,
      role: savedStudent.role,
      ipAddress,
    });

    let savedParent: User | null = null;

    if (dto.parentEmail) {
      const existingParent = await this.userRepo.findOne({ where: { email: dto.parentEmail } });
      if (existingParent) throw new ConflictException('Parent email already in use');

      const parentPasswordHash = await bcrypt.hash(dto.parentPassword ?? dto.password, 12);
      const parent = this.userRepo.create({
        email: dto.parentEmail,
        passwordHash: parentPasswordHash,
        role: UserRole.PARENT_FINANCEUR,
        validationStatus: ValidationStatus.PENDING,
        consentSigned: false,
      });
      savedParent = await this.userRepo.save(parent);

      this.eventsService.publish('AccountCreated', {
        userId: savedParent.id,
        email: savedParent.email,
        role: savedParent.role,
        ipAddress,
      });
    }

    return {
      student: this.toPublic(savedStudent),
      parent: savedParent ? this.toPublic(savedParent) : null,
    };
  }

  /**
   * Creates a teacher account (formateur role) in NON_APPROVED status.
   * The teacher remains non_approved until RP validates after interview/test, contract and financial info.
   */
  async createTeacherAccount(dto: CreateTeacherAccountDto, ipAddress?: string) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const teacher = this.userRepo.create({
      email: dto.email,
      passwordHash,
      role: UserRole.FORMATEUR,
      validationStatus: ValidationStatus.PENDING,
      consentSigned: false,
    });
    const savedTeacher = await this.userRepo.save(teacher);

    this.eventsService.publish('AccountCreated', {
      userId: savedTeacher.id,
      email: savedTeacher.email,
      role: savedTeacher.role,
      ipAddress,
      cvReference: dto.cvReference,
    });

    return this.toPublic(savedTeacher);
  }

  /**
   * Creates a standalone parent financeur account.
   */
  async createParentAccount(dto: CreateParentAccountDto, ipAddress?: string) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const parent = this.userRepo.create({
      email: dto.email,
      passwordHash,
      role: UserRole.PARENT_FINANCEUR,
      validationStatus: ValidationStatus.PENDING,
      consentSigned: false,
    });
    const savedParent = await this.userRepo.save(parent);

    this.eventsService.publish('AccountCreated', {
      userId: savedParent.id,
      email: savedParent.email,
      role: savedParent.role,
      ipAddress,
    });

    return this.toPublic(savedParent);
  }

  /**
   * PATCH /accounts/{id}/status — unified status endpoint.
   * Maps the business statuses (limited, member, non_approved, validated, suspended) to internal states.
   * - limited / non_approved → PENDING + isActive = true
   * - member / validated     → ACTIVE  + isActive = true
   * - suspended              → SUSPENDED + isActive = false (TI only)
   */
  async updateAccountStatus(accountId: string, dto: UpdateAccountStatusDto, actor: User) {
    const isTI = actor.role === UserRole.TECHNICIEN_INFORMATIQUE;
    const isRP = actor.role === UserRole.RESPONSABLE_PEDAGOGIQUE;

    if (!isTI && !isRP) {
      throw new ForbiddenException('Only TI or RP can change account status');
    }

    if (dto.status === AccountStatusValue.SUSPENDED && !isTI) {
      throw new ForbiddenException('Only TI can suspend accounts');
    }

    const targetAccount = await this.findOrFail(accountId);
    const previousValidationStatus = targetAccount.validationStatus;

    switch (dto.status) {
      case AccountStatusValue.LIMITED:
      case AccountStatusValue.NON_APPROVED:
        targetAccount.validationStatus = ValidationStatus.PENDING;
        targetAccount.isActive = true;
        break;
      case AccountStatusValue.MEMBER:
      case AccountStatusValue.VALIDATED:
        if (!targetAccount.consentSigned && dto.status === AccountStatusValue.VALIDATED) {
          throw new ForbiddenException('Account cannot be validated before mandatory consents are signed (IAM-FB-003)');
        }
        targetAccount.validationStatus = ValidationStatus.ACTIVE;
        targetAccount.isActive = true;
        break;
      case AccountStatusValue.SUSPENDED:
        targetAccount.validationStatus = ValidationStatus.SUSPENDED;
        targetAccount.isActive = false;
        break;
    }

    await this.userRepo.save(targetAccount);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: targetAccount.id,
        actorId: actor.id,
        action: 'STATUS_CHANGED',
        oldValue: { validationStatus: previousValidationStatus },
        newValue: { validationStatus: targetAccount.validationStatus, requestedStatus: dto.status },
      }),
    );

    if (dto.status === AccountStatusValue.SUSPENDED) {
      this.eventsService.publish('AccountSuspended', { userId: targetAccount.id, actorId: actor.id });
    } else if (dto.status === AccountStatusValue.VALIDATED || dto.status === AccountStatusValue.MEMBER) {
      this.eventsService.publish('AccountValidated', { userId: targetAccount.id, actorId: actor.id });
    }

    return this.toPublic(targetAccount);
  }

  /**
   * POST /accounts/{id}/access/regenerate — TI only.
   * Reactivates account and revokes all prior sessions.
   * Does NOT delete any business data.
   */
  async regenerateAccess(accountId: string, actor: User) {
    if (actor.role !== UserRole.TECHNICIEN_INFORMATIQUE) {
      throw new ForbiddenException('Only TI can regenerate account access');
    }

    const targetAccount = await this.findOrFail(accountId);
    targetAccount.isActive = true;

    if (targetAccount.validationStatus === ValidationStatus.SUSPENDED) {
      targetAccount.validationStatus = ValidationStatus.ACTIVE;
    }

    await this.userRepo.save(targetAccount);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: targetAccount.id,
        actorId: actor.id,
        action: 'ACCESS_REGENERATED',
        oldValue: { isActive: false },
        newValue: { isActive: true },
      }),
    );

    this.eventsService.publish('AccessRegenerated', { userId: targetAccount.id, actorId: actor.id });

    return { message: `Access regenerated for account ${accountId}. All existing sessions should be revoked by the client.` };
  }

  private async findOrFail(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Account ${id} not found`);
    return user;
  }

  private toPublic(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      validationStatus: user.validationStatus,
      consentSigned: user.consentSigned,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
