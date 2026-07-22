import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  User,
  UserRole,
  ValidationStatus,
  INTERNAL_ROLES,
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
import { ConfigService } from '@nestjs/config';
import { Actor } from '../common/types/actor';

/** Nombre maximal d'enregistrements retournés par les listes non paginées explicitement. */
const DEFAULT_LIST_LIMIT = 200;

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
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
   *
   * Accepts an optional repository so callers running inside a transaction can
   * pass the transactional repository and see uncommitted rows from the same transaction.
   */
  private async generateLoginIdentifier(email: string, userRepo: Repository<User> = this.userRepo): Promise<string> {
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

    while (await userRepo.findOne({ where: { loginIdentifier: candidateIdentifier } })) {
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
  private async resolveLoginIdentifier(
    email: string,
    requestedIdentifier?: string,
    userRepo: Repository<User> = this.userRepo,
  ): Promise<string> {
    if (requestedIdentifier) {
      const alreadyTaken = await userRepo.findOne({ where: { loginIdentifier: requestedIdentifier } });
      if (alreadyTaken) {
        throw new ConflictException(`Login identifier '${requestedIdentifier}' is already taken`);
      }
      return requestedIdentifier;
    }
    return this.generateLoginIdentifier(email, userRepo);
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
    // Écriture unique sur une seule entité : un DataSource.transaction n'est pas
    // nécessaire (la ligne insérée par save() est déjà atomique et auto-commitée).
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

  /**
   * Assigns a new role to an account. Écriture atomique (User + AuditLog) via
   * DataSource.transaction ; l'événement métier n'est publié qu'après le commit.
   */
  async updateRoles(accountId: string, dto: UpdateRolesDto, actor: Actor) {
    const { targetAccount, oldRole } = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const auditRepo = manager.getRepository(AuditLog);

      const targetAccount = await this.findOrFail(accountId, userRepo);

      const canAssignInternal = [
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        UserRole.TECHNICIEN_INFORMATIQUE,
      ].includes(actor.role);

      if (INTERNAL_ROLES.includes(dto.role) && !canAssignInternal) {
        throw new ForbiddenException('Only RP or TI can assign internal roles');
      }

      const oldRole = targetAccount.role;
      targetAccount.role = dto.role;
      await userRepo.save(targetAccount);

      await auditRepo.save(
        auditRepo.create({
          targetUserId: targetAccount.id,
          actorId: actor.id,
          action: 'ROLE_CHANGED',
          oldValue: { role: oldRole },
          newValue: { role: dto.role },
        }),
      );

      return { targetAccount, oldRole };
    });

    this.eventsService.publish('RoleChanged', {
      userId: targetAccount.id,
      oldRole,
      newRole: dto.role,
      actorId: actor.id,
    });

    return this.toPublic(targetAccount);
  }

  /**
   * Validates an account (IAM-FB-003). Écriture atomique (User + AuditLog) via
   * DataSource.transaction ; l'événement métier n'est publié qu'après le commit.
   */
  async validateAccount(accountId: string, actor: Actor) {
    const { targetAccount } = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const auditRepo = manager.getRepository(AuditLog);

      const targetAccount = await this.findOrFail(accountId, userRepo);

      const canValidate = [
        UserRole.RESPONSABLE_PEDAGOGIQUE,
        UserRole.TECHNICIEN_INFORMATIQUE,
      ].includes(actor.role);
      if (!canValidate) throw new ForbiddenException('Only RP or TI can validate accounts');

      if (!targetAccount.consentSigned) {
        throw new ForbiddenException('Account cannot be validated before mandatory consents are signed (IAM-FB-003)');
      }

      targetAccount.validationStatus = ValidationStatus.ACTIVE;
      await userRepo.save(targetAccount);

      await auditRepo.save(
        auditRepo.create({
          targetUserId: targetAccount.id,
          actorId: actor.id,
          action: 'ACCOUNT_VALIDATED',
          oldValue: { validationStatus: ValidationStatus.PENDING },
          newValue: { validationStatus: ValidationStatus.ACTIVE },
        }),
      );

      return { targetAccount };
    });

    this.eventsService.publish('AccountValidated', { userId: targetAccount.id, actorId: actor.id });

    return this.toPublic(targetAccount);
  }

  /**
   * Suspends an account (TI only). Écriture atomique (User + AuditLog) via
   * DataSource.transaction ; l'événement métier n'est publié qu'après le commit.
   */
  async suspendAccount(accountId: string, actor: Actor) {
    if (actor.role !== UserRole.TECHNICIEN_INFORMATIQUE) {
      throw new ForbiddenException('Only TI can suspend accounts');
    }

    const { targetAccount } = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const auditRepo = manager.getRepository(AuditLog);

      const targetAccount = await this.findOrFail(accountId, userRepo);
      const previousValidationStatus = targetAccount.validationStatus;

      targetAccount.validationStatus = ValidationStatus.SUSPENDED;
      targetAccount.isActive = false;
      await userRepo.save(targetAccount);

      await auditRepo.save(
        auditRepo.create({
          targetUserId: targetAccount.id,
          actorId: actor.id,
          action: 'ACCOUNT_SUSPENDED',
          oldValue: { validationStatus: previousValidationStatus },
          newValue: { validationStatus: ValidationStatus.SUSPENDED },
        }),
      );

      return { targetAccount };
    });

    this.eventsService.publish('AccountSuspended', { userId: targetAccount.id, actorId: actor.id });

    return this.toPublic(targetAccount);
  }

  /**
   * Retourne les entrées d'audit d'un compte, bornées et ordonnées (services-convention).
   */
  async getAuditLogs(accountId: string): Promise<AuditLog[]> {
    await this.findOrFail(accountId);
    return this.auditRepo.find({
      where: { targetUserId: accountId },
      order: { createdAt: 'DESC' },
      take: DEFAULT_LIST_LIMIT,
    });
  }

  /**
   * Retourne la liste de tous les comptes (usage interne uniquement).
   * Filtre optionnel par rôle. N'expose pas les données sensibles.
   * Liste bornée et ordonnée (services-convention) ; `limit`/`offset` permettent
   * une pagination explicite si un consommateur en a besoin.
   */
  async listAccounts(
    filterRole?: UserRole,
    limit: number = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<{
    userId: string;
    loginIdentifier: string;
    role: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  }[]> {
    const whereClause = filterRole ? { role: filterRole } : {};
    const userList = await this.userRepo.find({
      where: whereClause,
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset,
    });
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
   *
   * La création de l'élève et la résolution du parent sont atomiques
   * (DataSource.transaction) : si la résolution du parent échoue (404/409),
   * le compte élève n'est pas créé.
   */
  async createStudentAccount(dto: CreateStudentAccountDto, ipAddress?: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);

      const studentLoginIdentifier = await this.resolveLoginIdentifier(dto.email, dto.loginIdentifier, userRepo);
      const studentEmailAlreadyUsed = !!(await userRepo.findOne({ where: { email: dto.email } }));

      const studentPasswordHash = await bcrypt.hash(dto.password, 12);
      const student = userRepo.create({
        loginIdentifier: studentLoginIdentifier,
        email: dto.email,
        passwordHash: studentPasswordHash,
        role: UserRole.ELEVE,
        validationStatus: ValidationStatus.PENDING,
        consentSigned: false,
      });
      const savedStudent = await userRepo.save(student);

      let savedParent: User | null = null;
      let parentCreated = false;

      if (dto.parentLoginIdentifier) {
        // Explicit identifier — find the account or fail
        const existingParent = await userRepo.findOne({ where: { loginIdentifier: dto.parentLoginIdentifier } });
        if (!existingParent) {
          throw new NotFoundException(`No account found with loginIdentifier '${dto.parentLoginIdentifier}'`);
        }
        savedParent = existingParent;
      } else if (dto.parentEmail) {
        const matchingParents = await userRepo.find({ where: { email: dto.parentEmail } });

        if (matchingParents.length === 0) {
          // Create new parent account
          const parentLoginIdentifier = await this.generateLoginIdentifier(dto.parentEmail, userRepo);
          const parentPasswordHash = await bcrypt.hash(dto.parentPassword ?? dto.password, 12);
          const parent = userRepo.create({
            loginIdentifier: parentLoginIdentifier,
            email: dto.parentEmail,
            passwordHash: parentPasswordHash,
            role: UserRole.PARENT_FINANCEUR,
            validationStatus: ValidationStatus.PENDING,
            consentSigned: false,
          });
          savedParent = await userRepo.save(parent);
          parentCreated = true;
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

      return { savedStudent, studentEmailAlreadyUsed, studentLoginIdentifier, savedParent, parentCreated };
    });

    this.eventsService.publish('AccountCreated', {
      userId: result.savedStudent.id,
      loginIdentifier: result.savedStudent.loginIdentifier,
      email: result.savedStudent.email,
      role: result.savedStudent.role,
      ipAddress,
    });

    if (result.parentCreated && result.savedParent) {
      this.eventsService.publish('AccountCreated', {
        userId: result.savedParent.id,
        loginIdentifier: result.savedParent.loginIdentifier,
        email: result.savedParent.email,
        role: result.savedParent.role,
        ipAddress,
      });
    }

    return {
      student: {
        ...this.toPublic(result.savedStudent),
        ...(result.studentEmailAlreadyUsed
          ? { emailAlreadyUsed: true, suggestedLoginIdentifier: result.studentLoginIdentifier }
          : {}),
      },
      parent: result.savedParent
        ? { ...this.toPublic(result.savedParent), created: result.parentCreated }
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
    // Écriture unique : pas de transaction nécessaire.
    const savedTeacher = await this.userRepo.save(teacher);

    this.eventsService.publish('AccountCreated', {
      userId: savedTeacher.id,
      loginIdentifier: savedTeacher.loginIdentifier,
      email: savedTeacher.email,
      role: savedTeacher.role,
      ipAddress,
      cvReference: dto.cvReference,
    });

    // Notification non-bloquante au dashboard RP — effet post-commit, réalisée
    // une fois la ligne du formateur durablement enregistrée.
    this.notifyDashboardTeacherPending(
      savedTeacher.id,
      savedTeacher.firstName ?? '',
      savedTeacher.lastName ?? '',
    );

    return {
      ...this.toPublic(savedTeacher),
      ...(emailAlreadyUsed ? { emailAlreadyUsed: true, suggestedLoginIdentifier: loginIdentifier } : {}),
    };
  }

  /**
   * Creates a standalone parent financeur account.
   */
  async createParentAccount(dto: CreateParentAccountDto, ipAddress?: string) {
    const loginIdentifier = await this.resolveLoginIdentifier(dto.email, undefined);
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
    // Écriture unique : pas de transaction nécessaire.
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
   *
   * Écriture atomique (User + AuditLog) via DataSource.transaction ; l'événement
   * métier n'est publié qu'après le commit.
   */
  async updateAccountStatus(accountId: string, dto: UpdateAccountStatusDto, actor: Actor) {
    const isTI = actor.role === UserRole.TECHNICIEN_INFORMATIQUE;
    const isRP = actor.role === UserRole.RESPONSABLE_PEDAGOGIQUE;

    if (!isTI && !isRP) {
      throw new ForbiddenException('Only TI or RP can change account status');
    }

    if (dto.status === AccountStatusValue.SUSPENDED && !isTI) {
      throw new ForbiddenException('Only TI can suspend accounts');
    }

    const { targetAccount } = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const auditRepo = manager.getRepository(AuditLog);

      const targetAccount = await this.findOrFail(accountId, userRepo);
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

      await userRepo.save(targetAccount);

      await auditRepo.save(
        auditRepo.create({
          targetUserId: targetAccount.id,
          actorId: actor.id,
          action: 'STATUS_CHANGED',
          oldValue: { validationStatus: previousValidationStatus },
          newValue: { validationStatus: targetAccount.validationStatus, requestedStatus: dto.status },
        }),
      );

      return { targetAccount };
    });

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
   * Écriture atomique (User + AuditLog) via DataSource.transaction ; l'événement
   * métier n'est publié qu'après le commit.
   */
  async regenerateAccess(accountId: string, actor: Actor) {
    if (actor.role !== UserRole.TECHNICIEN_INFORMATIQUE) {
      throw new ForbiddenException('Only TI can regenerate account access');
    }

    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const auditRepo = manager.getRepository(AuditLog);

      const targetAccount = await this.findOrFail(accountId, userRepo);
      targetAccount.isActive = true;

      if (targetAccount.validationStatus === ValidationStatus.SUSPENDED) {
        targetAccount.validationStatus = ValidationStatus.ACTIVE;
      }

      await userRepo.save(targetAccount);

      await auditRepo.save(
        auditRepo.create({
          targetUserId: targetAccount.id,
          actorId: actor.id,
          action: 'ACCESS_REGENERATED',
          oldValue: { isActive: false },
          newValue: { isActive: true },
        }),
      );
    });

    this.eventsService.publish('AccessRegenerated', { userId: accountId, actorId: actor.id });

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

  // ---------------------------------------------------------------------------
  // Ports exposés aux autres features (identity-access-service possède seul
  // l'entité User et l'entité AuditLog — cf. modules-convention). AuthModule,
  // ConsentsModule et DelegationsModule consomment ces méthodes typées au lieu
  // d'injecter directement un repository qui ne leur appartient pas. Celles qui
  // écrivent acceptent un `EntityManager` optionnel afin de participer à une
  // transaction ouverte par l'appelant (services-convention : toutes les
  // écritures d'une opération atomique doivent passer par le même manager).
  // ---------------------------------------------------------------------------

  /**
   * Authentification — retourne le compte avec le hash de mot de passe inclus
   * (colonne `select: false` par défaut). Consommé uniquement par AuthService.login().
   */
  async findCredentialsByLoginIdentifier(loginIdentifier: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.loginIdentifier = :loginIdentifier', { loginIdentifier })
      .getOne();
  }

  /** Récupère un compte par id, sans le hash de mot de passe. */
  async findActiveAccountById(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  /** Récupère un compte par identifiant de connexion, sans le hash de mot de passe. */
  async findAccountByLoginIdentifier(loginIdentifier: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { loginIdentifier } });
  }

  /** Récupère un compte par email. */
  async findAccountByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  /** Récupère tous les comptes partageant un même email (récupération d'identifiant). */
  async findAccountsByEmail(email: string): Promise<User[]> {
    return this.userRepo.find({ where: { email } });
  }

  /** Marque l'email d'un compte comme vérifié. */
  async markEmailVerified(userId: string): Promise<void> {
    await this.userRepo.update(userId, { emailVerified: true });
  }

  /** Met à jour le hash de mot de passe d'un compte (réinitialisation de mot de passe). */
  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.userRepo.update(userId, { passwordHash });
  }

  /**
   * Applique l'effet de bord métier de la complétion des consentements obligatoires
   * (IAM-FB-003) : active le compte s'il est encore en attente. ConsentsService reste
   * seul responsable de déterminer si tous les consentements requis sont signés — il
   * appelle cette méthode uniquement lorsque c'est le cas, en lui passant le manager
   * de sa propre transaction pour que les deux écritures (ConsentRecord + User)
   * commitent ou échouent ensemble.
   */
  async activateAfterMandatoryConsents(userId: string, manager?: EntityManager): Promise<void> {
    const userRepo = manager ? manager.getRepository(User) : this.userRepo;
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user || user.consentSigned) return;

    user.consentSigned = true;
    if (user.validationStatus === ValidationStatus.PENDING) {
      user.validationStatus = ValidationStatus.ACTIVE;
    }
    await userRepo.save(user);
  }

  /** Vérifie l'existence d'un compte sans en exposer le détail — utilisé par DelegationsService. */
  async accountExists(userId: string): Promise<boolean> {
    const matchingAccountsCount = await this.userRepo.count({ where: { id: userId } });
    return matchingAccountsCount > 0;
  }

  /**
   * Point d'accès unique à AuditLog (entité possédée par AccountsModule) pour les
   * autres features qui doivent tracer une action sur un compte (ex: DelegationsService).
   * Accepte le manager de la transaction appelante pour que l'écriture d'audit
   * commite ou échoue avec le reste de l'opération.
   */
  async recordAudit(
    entry: {
      targetUserId: string;
      actorId: string;
      action: string;
      oldValue: Record<string, unknown> | null;
      newValue: Record<string, unknown> | null;
    },
    manager?: EntityManager,
  ): Promise<void> {
    const auditRepo = manager ? manager.getRepository(AuditLog) : this.auditRepo;
    await auditRepo.save(auditRepo.create(entry));
  }

  /**
   * Envoie une notification au dashboard-notification-service pour informer le RP
   * qu'un nouveau formateur est en attente de validation.
   * L'appel est non-bloquant : une erreur est loguée mais ne fait pas échouer la création de compte.
   */
  private notifyDashboardTeacherPending(
    teacherId: string,
    firstName: string,
    lastName: string,
  ): void {
    const dashboardServiceUrl = this.configService.get<string>(
      'DASHBOARD_NOTIFICATION_SERVICE_URL',
      'http://dashboard-notification-service:3000',
    );

    const teacherFullName = [firstName, lastName].filter(Boolean).join(' ') || 'Formateur inconnu';

    fetch(`${dashboardServiceUrl}/internal/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'TEACHER_PENDING_VALIDATION',
        targetRole: 'responsable_pedagogique',
        payload: {
          teacherId,
          teacherName: teacherFullName,
          message: 'Nouveau formateur en attente de validation',
        },
      }),
      signal: AbortSignal.timeout(5000),
    }).catch((notificationError: Error) => {
      this.logger.warn(
        `Impossible de notifier le dashboard pour le formateur ${teacherId} : ${notificationError.message}`,
      );
    });
  }

  private async findOrFail(id: string, userRepo: Repository<User> = this.userRepo): Promise<User> {
    const user = await userRepo.findOne({ where: { id } });
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
