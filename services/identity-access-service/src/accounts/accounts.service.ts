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

  // ---------------------------------------------------------------------------
  // Login identifier generation
  // ---------------------------------------------------------------------------

  /**
   * Derives a unique loginIdentifier from an email address.
   * - Extracts the local part (before @)
   * - Lower-cases and strips characters outside [a-z0-9.-]
   * - Collapses consecutive dots and trims leading/trailing dots
   * - Appends .2, .3, … until an available identifier is found
   */
  private async generateLoginIdentifier(email: string): Promise<string> {
    const localPart = email.split('@')[0];
    let baseIdentifier = localPart
      .toLowerCase()
      .replace(/[^a-z0-9.\-]/g, '.')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.|\.$/g, '');

    if (baseIdentifier.length === 0) {
      baseIdentifier = 'user';
    }

    let candidateIdentifier = baseIdentifier;
    let collisionCounter = 1;

    while (await this.userRepo.findOne({ where: { loginIdentifier: candidateIdentifier } })) {
      collisionCounter += 1;
      candidateIdentifier = `${baseIdentifier}.${collisionCounter}`;
    }

    return candidateIdentifier;
  }

  /**
   * Resolves the loginIdentifier for a new account:
   * - If dto.loginIdentifier is provided, check it is free (409 if taken).
   * - Otherwise, auto-generate from the email.
   */
  private async resolveLoginIdentifier(email: string, requestedIdentifier?: string): Promise<string> {
    if (requestedIdentifier) {
      const alreadyTaken = await this.userRepo.findOne({ where: { loginIdentifier: requestedIdentifier } });
      if (alreadyTaken) {
        throw new ConflictException(`Login identifier '${requestedIdentifier}' is already taken`);
      }
      return requestedIdentifier;
    }
    return this.generateLoginIdentifier(email);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async createAccount(dto: CreateAccountDto, ipAddress?: string) {
    const role = dto.role ?? UserRole.ELEVE;

    if (INTERNAL_ROLES.includes(role)) {
      throw new ForbiddenException('Cannot self-register with an internal role (IAM-FB-002)');
    }

    const loginIdentifier = await this.resolveLoginIdentifier(dto.email, dto.loginIdentifier);

    const emailAlreadyUsed = !!(await this.userRepo.findOne({ where: { email: dto.email } }));

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const newUser = this.userRepo.create({
      loginIdentifier,
      email: dto.email,
      passwordHash,
      role,
      validationStatus: ValidationStatus.PENDING,
      consentSigned: false,
    });
    const savedUser = await this.userRepo.save(newUser);

    this.eventsService.publish('AccountCreated', {
      userId: savedUser.id,
      loginIdentifier: savedUser.loginIdentifier,
      email: savedUser.email,
      role: savedUser.role,
      ipAddress,
    });

    return {
      ...this.toPublic(savedUser),
      ...(emailAlreadyUsed ? { emailAlreadyUsed: true, suggestedLoginIdentifier: loginIdentifier } : {}),
    };
  }

  async getAccount(accountId: string) {
    const user = await this.findOrFail(accountId);
    return this.toPublic(user);
  }

  /**
   * PATCH /accounts/me — update the authenticated user's own account.
   * email, loginIdentifier and password can be changed via this route.
   * Role and status modifications are handled by dedicated admin routes.
   */
  async updateMe(currentUserId: string, dto: UpdateMeDto) {
    const account = await this.findOrFail(currentUserId);

    if (dto.loginIdentifier !== undefined && dto.loginIdentifier !== account.loginIdentifier) {
      const alreadyTaken = await this.userRepo.findOne({ where: { loginIdentifier: dto.loginIdentifier } });
      if (alreadyTaken) throw new ConflictException('Login identifier already in use');
      account.loginIdentifier = dto.loginIdentifier;
    }

    if (dto.email !== undefined) {
      account.email = dto.email;
    }

    if (dto.password !== undefined) {
      account.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    const updatedAccount = await this.userRepo.save(account);
    return this.toPublic(updatedAccount);
  }

  async updateRoles(accountId: string, dto: UpdateRolesDto, actor: User) {
    const targetAccount = await this.findOrFail(accountId);

    const canAssignInternal = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ].includes(actor.role);

    if (INTERNAL_ROLES.includes(dto.role) && !canAssignInternal) {
      throw new ForbiddenException('Only RP or TI can assign internal roles');
    }

    const oldRole = targetAccount.role;
    targetAccount.role = dto.role;
    await this.userRepo.save(targetAccount);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: targetAccount.id,
        actorId: actor.id,
        action: 'ROLE_CHANGED',
        oldValue: { role: oldRole },
        newValue: { role: dto.role },
      }),
    );

    this.eventsService.publish('RoleChanged', {
      userId: targetAccount.id,
      oldRole,
      newRole: dto.role,
      actorId: actor.id,
    });

    return this.toPublic(targetAccount);
  }

  async validateAccount(accountId: string, actor: User) {
    const targetAccount = await this.findOrFail(accountId);

    const canValidate = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ].includes(actor.role);
    if (!canValidate) throw new ForbiddenException('Only RP or TI can validate accounts');

    if (!targetAccount.consentSigned) {
      throw new ForbiddenException('Account cannot be validated before mandatory consents are signed (IAM-FB-003)');
    }

    targetAccount.validationStatus = ValidationStatus.ACTIVE;
    await this.userRepo.save(targetAccount);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: targetAccount.id,
        actorId: actor.id,
        action: 'ACCOUNT_VALIDATED',
        oldValue: { validationStatus: ValidationStatus.PENDING },
        newValue: { validationStatus: ValidationStatus.ACTIVE },
      }),
    );

    this.eventsService.publish('AccountValidated', { userId: targetAccount.id, actorId: actor.id });

    return this.toPublic(targetAccount);
  }

  async suspendAccount(accountId: string, actor: User) {
    if (actor.role !== UserRole.TECHNICIEN_INFORMATIQUE) {
      throw new ForbiddenException('Only TI can suspend accounts');
    }

    const targetAccount = await this.findOrFail(accountId);
    const previousValidationStatus = targetAccount.validationStatus;

    targetAccount.validationStatus = ValidationStatus.SUSPENDED;
    targetAccount.isActive = false;
    await this.userRepo.save(targetAccount);

    await this.auditRepo.save(
      this.auditRepo.create({
        targetUserId: targetAccount.id,
        actorId: actor.id,
        action: 'ACCOUNT_SUSPENDED',
        oldValue: { validationStatus: previousValidationStatus },
        newValue: { validationStatus: ValidationStatus.SUSPENDED },
      }),
    );

    this.eventsService.publish('AccountSuspended', { userId: targetAccount.id, actorId: actor.id });

    return this.toPublic(targetAccount);
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
    loginIdentifier: string;
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
      loginIdentifier: user.loginIdentifier,
      role: user.role,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      phone: user.phone ?? null,
    }));
  }

  /**
   * Creates a student account (eleve role).
   * Optionally links or creates a parent financeur account in the same call.
   *
   * Parent resolution rules:
   *   - parentLoginIdentifier provided → find by loginIdentifier (404 if not found)
   *   - parentEmail provided only:
   *       0 results → create new parent account
   *       1 result  → link that existing account
   *       2+ results → 409: ask to use parentLoginIdentifier instead
   */
  async createStudentAccount(dto: CreateStudentAccountDto, ipAddress?: string) {
    const studentLoginIdentifier = await this.resolveLoginIdentifier(dto.email, dto.loginIdentifier);
    const studentEmailAlreadyUsed = !!(await this.userRepo.findOne({ where: { email: dto.email } }));

    const studentPasswordHash = await bcrypt.hash(dto.password, 12);
    const student = this.userRepo.create({
      loginIdentifier: studentLoginIdentifier,
      email: dto.email,
      passwordHash: studentPasswordHash,
      role: UserRole.ELEVE,
      validationStatus: ValidationStatus.PENDING,
      consentSigned: false,
    });
    const savedStudent = await this.userRepo.save(student);

    this.eventsService.publish('AccountCreated', {
      userId: savedStudent.id,
      loginIdentifier: savedStudent.loginIdentifier,
      email: savedStudent.email,
      role: savedStudent.role,
      ipAddress,
    });

    let savedParent: User | null = null;
    let parentCreated = false;

    if (dto.parentLoginIdentifier) {
      // Explicit identifier — find the account or fail
      const existingParent = await this.userRepo.findOne({ where: { loginIdentifier: dto.parentLoginIdentifier } });
      if (!existingParent) {
        throw new NotFoundException(`No account found with loginIdentifier '${dto.parentLoginIdentifier}'`);
      }
      savedParent = existingParent;
    } else if (dto.parentEmail) {
      const matchingParents = await this.userRepo.find({ where: { email: dto.parentEmail } });

      if (matchingParents.length === 0) {
        // Create new parent account
        const parentLoginIdentifier = await this.generateLoginIdentifier(dto.parentEmail);
        const parentPasswordHash = await bcrypt.hash(dto.parentPassword ?? dto.password, 12);
        const parent = this.userRepo.create({
          loginIdentifier: parentLoginIdentifier,
          email: dto.parentEmail,
          passwordHash: parentPasswordHash,
          role: UserRole.PARENT_FINANCEUR,
          validationStatus: ValidationStatus.PENDING,
          consentSigned: false,
        });
        savedParent = await this.userRepo.save(parent);
        parentCreated = true;

        this.eventsService.publish('AccountCreated', {
          userId: savedParent.id,
          loginIdentifier: savedParent.loginIdentifier,
          email: savedParent.email,
          role: savedParent.role,
          ipAddress,
        });
      } else if (matchingParents.length === 1) {
        // Link existing account
        savedParent = matchingParents[0];
      } else {
        // Ambiguous — multiple accounts share this email
        throw new ConflictException(
          'Plusieurs comptes existent avec cet email parent. Utilisez parentLoginIdentifier à la place.',
        );
      }
    }

    return {
      student: {
        ...this.toPublic(savedStudent),
        ...(studentEmailAlreadyUsed ? { emailAlreadyUsed: true, suggestedLoginIdentifier: studentLoginIdentifier } : {}),
      },
      parent: savedParent
        ? { ...this.toPublic(savedParent), created: parentCreated }
        : null,
    };
  }

  /**
   * Creates a teacher account (formateur role) in PENDING status.
   * The teacher remains pending until RP validates after interview/test, contract and financial info.
   */
  async createTeacherAccount(dto: CreateTeacherAccountDto, ipAddress?: string) {
    const loginIdentifier = await this.resolveLoginIdentifier(dto.email, dto.loginIdentifier);
    const emailAlreadyUsed = !!(await this.userRepo.findOne({ where: { email: dto.email } }));

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const teacher = this.userRepo.create({
      loginIdentifier,
      email: dto.email,
      passwordHash,
      role: UserRole.FORMATEUR,
      validationStatus: ValidationStatus.PENDING,
      consentSigned: false,
    });
    const savedTeacher = await this.userRepo.save(teacher);

    this.eventsService.publish('AccountCreated', {
      userId: savedTeacher.id,
      loginIdentifier: savedTeacher.loginIdentifier,
      email: savedTeacher.email,
      role: savedTeacher.role,
      ipAddress,
      cvReference: dto.cvReference,
    });

    return {
      ...this.toPublic(savedTeacher),
      ...(emailAlreadyUsed ? { emailAlreadyUsed: true, suggestedLoginIdentifier: loginIdentifier } : {}),
    };
  }

  /**
   * Creates a standalone parent financeur account.
   */
  async createParentAccount(dto: CreateParentAccountDto, ipAddress?: string) {
    const loginIdentifier = await this.resolveLoginIdentifier(dto.email, dto.loginIdentifier);
    const emailAlreadyUsed = !!(await this.userRepo.findOne({ where: { email: dto.email } }));

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const parent = this.userRepo.create({
      loginIdentifier,
      email: dto.email,
      passwordHash,
      role: UserRole.PARENT_FINANCEUR,
      validationStatus: ValidationStatus.PENDING,
      consentSigned: false,
    });
    const savedParent = await this.userRepo.save(parent);

    this.eventsService.publish('AccountCreated', {
      userId: savedParent.id,
      loginIdentifier: savedParent.loginIdentifier,
      email: savedParent.email,
      role: savedParent.role,
      ipAddress,
    });

    return {
      ...this.toPublic(savedParent),
      ...(emailAlreadyUsed ? { emailAlreadyUsed: true, suggestedLoginIdentifier: loginIdentifier } : {}),
    };
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

  /**
   * GET /accounts/check-email?email=xxx — public endpoint.
   * Returns whether an email is already associated with one or more accounts,
   * and what loginIdentifier would be suggested for a new registration with that email.
   */
  async checkEmail(email: string): Promise<{ alreadyUsed: boolean; suggestedLoginIdentifier: string }> {
    const existingUsers = await this.userRepo.find({ where: { email } });
    const suggestedLoginIdentifier = await this.generateLoginIdentifier(email);
    return {
      alreadyUsed: existingUsers.length > 0,
      suggestedLoginIdentifier,
    };
  }

  async findByLoginIdentifier(loginIdentifier: string): Promise<{ userId: string; role: string }> {
    const user = await this.userRepo.findOne({ where: { loginIdentifier } });
    if (!user) throw new NotFoundException('Identifiant élève introuvable');
    return { userId: user.id, role: user.role };
  }

  async findByUserId(userId: string): Promise<{ userId: string; loginIdentifier: string; role: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable');
    return { userId: user.id, loginIdentifier: user.loginIdentifier, role: user.role };
  }

  private async findOrFail(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Account ${id} not found`);
    return user;
  }

  private toPublic(user: User) {
    return {
      id: user.id,
      loginIdentifier: user.loginIdentifier,
      email: user.email,
      role: user.role,
      validationStatus: user.validationStatus,
      consentSigned: user.consentSigned,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
