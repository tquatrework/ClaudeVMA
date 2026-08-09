import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
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
import {
  LinkedAccountMode,
  LinkedAccountFieldPrefix,
  LinkedAccountIntent,
  checkLinkedAccountIntent,
} from './dto/linked-account-mode';
import { UpdateAccountStatusDto, AccountStatusValue } from './dto/update-account-status.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { checkRegistrationConsents } from './dto/registration-consents';
import { EventsService } from '../events/events.service';
import { ConfigService } from '@nestjs/config';
import { Actor } from '../common/types/actor';
import { ProfileServiceClient } from '../common/clients/profile-service.client';
import { ConsentRecordingService } from '../consents/consent-recording.service';
import { ConsentRecord } from '../consents/entities/consent-record.entity';
import { CreateConsentDto } from '../consents/dto/create-consent.dto';

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
    private readonly profileServiceClient: ProfileServiceClient,
    private readonly consentRecordingService: ConsentRecordingService,
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

  /**
   * Vérifie que l'intention de liaison (rattacher un compte existant vs créer un
   * compte lié) est explicite et cohérente avec les champs fournis.
   * Lève un 400 listant toutes les violations plutôt que d'ignorer un champ
   * sans effet — un champ saisi par l'utilisateur n'est jamais jeté en silence
   * (arbitrage d'architecture du 2026-08-09).
   */
  private assertLinkedAccountIntent(fieldPrefix: LinkedAccountFieldPrefix, intent: LinkedAccountIntent): void {
    const violations = checkLinkedAccountIntent(fieldPrefix, intent);
    if (violations.length > 0) {
      throw new BadRequestException(violations);
    }
  }

  /**
   * Vérifie la liste de consentements transmise à l'inscription (400 explicite si
   * un type est envoyé deux fois). Symétrique de assertLinkedAccountIntent : la
   * règle vit dans une fonction pure testable, le service ne fait que la lever.
   */
  private assertRegistrationConsents(requestedConsents?: CreateConsentDto[]): void {
    const violations = checkRegistrationConsents(requestedConsents);
    if (violations.length > 0) {
      throw new BadRequestException(violations);
    }
  }

  /**
   * Enregistre les consentements recueillis par le formulaire d'inscription, par
   * le MÊME chemin que `POST /consents` (ConsentRecordingService : même table,
   * même version par défaut, même capture d'`ipAddress` et de `signedAt`), puis
   * applique l'effet de bord métier prévu quand RGPD + CGU sont réunis
   * (activateAfterMandatoryConsents — compte `consent_signed` et `ACTIVE`).
   *
   * Appelée à l'intérieur de la transaction de création du compte : les traces de
   * consentement et la ligne `users` commitent ou échouent ensemble. Aucun
   * consentement n'est donc conservé pour un compte annulé, et aucun compte n'est
   * créé en jetant un consentement que l'utilisateur vient de donner (arbitrage
   * d'architecture du 2026-08-09).
   *
   * Ne concerne QUE le compte de la personne qui remplit le formulaire. Un compte
   * lié créé dans le même appel reste `PENDING`, sans consentement : voir
   * `RegistrationConsents` et les DTO de création.
   */
  private async recordRegistrationConsents(
    userId: string,
    requestedConsents: CreateConsentDto[] | undefined,
    ipAddress: string | undefined,
    manager: EntityManager,
  ): Promise<{ recordedConsents: ConsentRecord[]; activatedAccount: User | null }> {
    if (!requestedConsents || requestedConsents.length === 0) {
      return { recordedConsents: [], activatedAccount: null };
    }

    const recordedConsents: ConsentRecord[] = [];
    for (const requestedConsent of requestedConsents) {
      recordedConsents.push(
        await this.consentRecordingService.recordConsent(
          {
            userId,
            consentType: requestedConsent.consentType,
            version: requestedConsent.version,
            ipAddress,
          },
          manager,
        ),
      );
    }

    const allMandatoryConsentsSigned = await this.consentRecordingService.areMandatoryConsentsSigned(
      userId,
      manager,
    );
    const activatedAccount = allMandatoryConsentsSigned
      ? await this.activateAfterMandatoryConsents(userId, manager)
      : null;

    return { recordedConsents, activatedAccount };
  }

  /**
   * Publie un `ConsentSigned` par consentement enregistré — même événement, même
   * charge utile que `POST /consents`, et comme lui publié après le commit de la
   * transaction (jamais avant : une erreur métier ne doit pas devenir un succès
   * technique).
   */
  private publishConsentSignedEvents(userId: string, recordedConsents: ConsentRecord[]): void {
    for (const recordedConsent of recordedConsents) {
      this.eventsService.publish('ConsentSigned', {
        userId,
        consentType: recordedConsent.consentType,
        version: recordedConsent.version,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Route générique (`POST /accounts`, et `POST /internal/create-account`
   * consommée par orchestration-service) : ne collecte pas
   * firstName/lastName/phone et n'appelle donc pas profile-service.
   * Transactionnelle depuis le 2026-08-09 car elle écrit désormais deux entités
   * quand des consentements sont transmis (`users` + `consent_records`).
   */
  async createAccount(dto: CreateAccountDto, ipAddress?: string) {
    const role = dto.role ?? UserRole.ELEVE;

    if (INTERNAL_ROLES.includes(role)) {
      throw new ForbiddenException('Cannot self-register with an internal role (IAM-FB-002)');
    }
    this.assertRegistrationConsents(dto.consents);

    const result = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);

      const loginIdentifier = await this.resolveLoginIdentifier(dto.email, dto.loginIdentifier, userRepo);
      const emailAlreadyUsed = !!(await userRepo.findOne({ where: { email: dto.email } }));

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const newUser = userRepo.create({
        loginIdentifier,
        email: dto.email,
        passwordHash,
        role,
        validationStatus: ValidationStatus.PENDING,
        consentSigned: false,
      });
      let savedUser = await userRepo.save(newUser);

      const { recordedConsents, activatedAccount } = await this.recordRegistrationConsents(
        savedUser.id,
        dto.consents,
        ipAddress,
        manager,
      );
      if (activatedAccount) savedUser = activatedAccount;

      return { savedUser, emailAlreadyUsed, loginIdentifier, recordedConsents };
    });

    this.eventsService.publish('AccountCreated', {
      userId: result.savedUser.id,
      loginIdentifier: result.savedUser.loginIdentifier,
      email: result.savedUser.email,
      role: result.savedUser.role,
      ipAddress,
    });
    this.publishConsentSignedEvents(result.savedUser.id, result.recordedConsents);

    return {
      ...this.toPublic(result.savedUser),
      ...(result.emailAlreadyUsed
        ? { emailAlreadyUsed: true, suggestedLoginIdentifier: result.loginIdentifier }
        : {}),
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
   * Ne contient plus firstName/lastName/phone (propriété exclusive de
   * profile-service depuis le 2026-08-05).
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
    }));
  }

  /**
   * Creates a student account (eleve role).
   * Optionally attaches an existing parent financeur account, or creates one in
   * the same call — deux intentions distinctes portées par `parentAccountMode`
   * (arbitrage d'architecture du 2026-08-09).
   *
   * Parent resolution rules:
   *   - parentAccountMode='existing' → find by parentLoginIdentifier (404 if not found)
   *   - parentAccountMode='new'      → create the parent account with the chosen
   *                                    parentLoginIdentifier (409 if already taken).
   *                                    L'identifiant n'est jamais dérivé de l'email.
   *   - parentAccountMode absent ou 'none' → aucun compte lié.
   *
   * La création de l'élève, la résolution du parent, le stockage des profils
   * administratifs (firstName/lastName/phone → profile-service) et la liaison
   * financeur/élève automatique sont toutes réalisées dans la même
   * DataSource.transaction : un échec à n'importe quelle étape (parent
   * introuvable, identifiant pris, profile-service indisponible) annule
   * intégralement la création (élève ET parent éventuel).
   *
   * Règle produit du 2026-08-05 : quand élève et parent sont associés dans le
   * même appel, la liaison financeur/élève est immédiate et implicite, sans flow
   * de demande — voir ProfileServiceClient.linkParentToStudent.
   */
  async createStudentAccount(dto: CreateStudentAccountDto, ipAddress?: string) {
    this.assertLinkedAccountIntent('parent', {
      mode: dto.parentAccountMode,
      loginIdentifier: dto.parentLoginIdentifier,
      email: dto.parentEmail,
      password: dto.parentPassword,
      firstName: dto.parentFirstName,
      lastName: dto.parentLastName,
    });
    this.assertRegistrationConsents(dto.consents);

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
      let savedStudent = await userRepo.save(student);

      // Consentements recueillis par le formulaire d'inscription de l'élève —
      // enregistrés par le même chemin que POST /consents, dans cette même
      // transaction. Ne couvrent jamais le compte parent créé ci-dessous.
      const { recordedConsents, activatedAccount } = await this.recordRegistrationConsents(
        savedStudent.id,
        dto.consents,
        ipAddress,
        manager,
      );
      if (activatedAccount) savedStudent = activatedAccount;

      let savedParent: User | null = null;
      let parentCreated = false;
      let parentEmailAlreadyUsed = false;

      if (dto.parentAccountMode === LinkedAccountMode.EXISTING) {
        // Rattachement d'un compte existant — identifié par son loginIdentifier uniquement
        const existingParent = await userRepo.findOne({ where: { loginIdentifier: dto.parentLoginIdentifier } });
        if (!existingParent) {
          throw new NotFoundException(`No account found with loginIdentifier '${dto.parentLoginIdentifier}'`);
        }
        savedParent = existingParent;
      } else if (dto.parentAccountMode === LinkedAccountMode.NEW) {
        // Création du compte parent avec l'identifiant de connexion CHOISI (409 si pris)
        const parentEmail = dto.parentEmail as string;
        const parentLoginIdentifier = await this.resolveLoginIdentifier(
          parentEmail,
          dto.parentLoginIdentifier,
          userRepo,
        );
        parentEmailAlreadyUsed = !!(await userRepo.findOne({ where: { email: parentEmail } }));

        const parentPasswordHash = await bcrypt.hash(dto.parentPassword ?? dto.password, 12);
        const parent = userRepo.create({
          loginIdentifier: parentLoginIdentifier,
          email: parentEmail,
          passwordHash: parentPasswordHash,
          role: UserRole.PARENT_FINANCEUR,
          validationStatus: ValidationStatus.PENDING,
          consentSigned: false,
        });
        savedParent = await userRepo.save(parent);
        parentCreated = true;
      }

      // Stockage des profils administratifs (profile-service = unique source de
      // vérité). Seul le compte tout juste créé (élève ; parent uniquement si
      // parentCreated) fournit des firstName/lastName fiables issus de ce même
      // appel — un parent lié à un compte préexistant conserve son profil déjà
      // enregistré, jamais écrasé par les champs saisis par l'élève ici.
      await this.persistAdministrativeProfile(savedStudent.id, dto.firstName, dto.lastName, dto.phoneNumber);
      if (parentCreated && savedParent) {
        await this.persistAdministrativeProfile(savedParent.id, dto.parentFirstName as string, dto.parentLastName as string);
      }
      if (savedParent) {
        await this.linkParentAsFinanceOwner(savedStudent.id, savedParent.id);
      }

      return {
        savedStudent,
        studentEmailAlreadyUsed,
        studentLoginIdentifier,
        savedParent,
        parentCreated,
        parentEmailAlreadyUsed,
        recordedConsents,
      };
    });

    this.eventsService.publish('AccountCreated', {
      userId: result.savedStudent.id,
      loginIdentifier: result.savedStudent.loginIdentifier,
      email: result.savedStudent.email,
      role: result.savedStudent.role,
      ipAddress,
    });
    this.publishConsentSignedEvents(result.savedStudent.id, result.recordedConsents);

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
        ? {
            ...this.toPublic(result.savedParent),
            created: result.parentCreated,
            ...(result.parentEmailAlreadyUsed ? { emailAlreadyUsed: true } : {}),
          }
        : null,
    };
  }

  /**
   * Creates a teacher account (formateur role) in PENDING status.
   * The teacher remains pending until RP validates after interview/test, contract and financial info.
   */
  async createTeacherAccount(dto: CreateTeacherAccountDto, ipAddress?: string) {
    this.assertRegistrationConsents(dto.consents);

    const { savedTeacher, emailAlreadyUsed, loginIdentifier, recordedConsents } = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);

      const loginIdentifier = await this.resolveLoginIdentifier(dto.email, dto.loginIdentifier, userRepo);
      const emailAlreadyUsed = !!(await userRepo.findOne({ where: { email: dto.email } }));

      const passwordHash = await bcrypt.hash(dto.password, 12);
      const teacher = userRepo.create({
        loginIdentifier,
        email: dto.email,
        passwordHash,
        role: UserRole.FORMATEUR,
        validationStatus: ValidationStatus.PENDING,
        consentSigned: false,
      });
      let savedTeacher = await userRepo.save(teacher);

      const { recordedConsents, activatedAccount } = await this.recordRegistrationConsents(
        savedTeacher.id,
        dto.consents,
        ipAddress,
        manager,
      );
      if (activatedAccount) savedTeacher = activatedAccount;

      await this.persistAdministrativeProfile(savedTeacher.id, dto.firstName, dto.lastName, dto.phoneNumber);

      return { savedTeacher, emailAlreadyUsed, loginIdentifier, recordedConsents };
    });

    this.eventsService.publish('AccountCreated', {
      userId: savedTeacher.id,
      loginIdentifier: savedTeacher.loginIdentifier,
      email: savedTeacher.email,
      role: savedTeacher.role,
      ipAddress,
      cvReference: dto.cvReference,
    });
    this.publishConsentSignedEvents(savedTeacher.id, recordedConsents);

    // Notification non-bloquante au dashboard RP — effet post-commit, réalisée
    // une fois la ligne du formateur durablement enregistrée. firstName/lastName
    // du dto (saisie de la requête, jamais persistés localement) restent
    // disponibles en mémoire à ce stade pour un message plus lisible.
    this.notifyDashboardTeacherPending(savedTeacher.id, dto.firstName, dto.lastName);

    return {
      ...this.toPublic(savedTeacher),
      ...(emailAlreadyUsed ? { emailAlreadyUsed: true, suggestedLoginIdentifier: loginIdentifier } : {}),
    };
  }

  /**
   * Creates a parent financeur account.
   * Optionally links or creates a student (eleve) account in the same call — symétrique de
   * createStudentAccount (parentLoginIdentifier/parentEmail côté élève), décision produit du
   * 2026-08-05 : un parent qui s'inscrit en connaissant déjà les identifiants de son enfant
   * doit pouvoir créer/lier les deux comptes en un seul appel, avec liaison financeur/élève
   * immédiate et implicite (pas de flow de demande dans ce cas précis).
   *
   * Student resolution rules (identique à la résolution du parent côté createStudentAccount) :
   *   - studentAccountMode='existing' → find by studentLoginIdentifier (404 if not found)
   *   - studentAccountMode='new'      → create the student account with the chosen
   *                                     studentLoginIdentifier (409 if already taken)
   *   - studentAccountMode absent ou 'none' → aucun compte lié.
   *
   * Mêmes garanties d'atomicité que createStudentAccount (une seule
   * DataSource.transaction couvrant la création du parent, la résolution de
   * l'élève, le stockage des profils administratifs et la liaison automatique).
   */
  async createParentAccount(dto: CreateParentAccountDto, ipAddress?: string) {
    this.assertLinkedAccountIntent('student', {
      mode: dto.studentAccountMode,
      loginIdentifier: dto.studentLoginIdentifier,
      email: dto.studentEmail,
      password: dto.studentPassword,
      firstName: dto.studentFirstName,
      lastName: dto.studentLastName,
    });
    this.assertRegistrationConsents(dto.consents);

    const result = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);

      const parentLoginIdentifier = await this.resolveLoginIdentifier(dto.email, dto.loginIdentifier, userRepo);
      const parentEmailAlreadyUsed = !!(await userRepo.findOne({ where: { email: dto.email } }));

      const parentPasswordHash = await bcrypt.hash(dto.password, 12);
      const parent = userRepo.create({
        loginIdentifier: parentLoginIdentifier,
        email: dto.email,
        passwordHash: parentPasswordHash,
        role: UserRole.PARENT_FINANCEUR,
        validationStatus: ValidationStatus.PENDING,
        consentSigned: false,
      });
      let savedParent = await userRepo.save(parent);

      // Consentements recueillis par le formulaire d'inscription du parent —
      // enregistrés par le même chemin que POST /consents, dans cette même
      // transaction. Ne couvrent jamais le compte élève créé ci-dessous : un
      // parent ne consent pas à la place de son enfant sur cette route (l'âge de
      // l'élève est inconnu de ce service et le compte peut être celui d'un
      // majeur).
      const { recordedConsents, activatedAccount } = await this.recordRegistrationConsents(
        savedParent.id,
        dto.consents,
        ipAddress,
        manager,
      );
      if (activatedAccount) savedParent = activatedAccount;

      let savedStudent: User | null = null;
      let studentCreated = false;
      let studentEmailAlreadyUsed = false;

      if (dto.studentAccountMode === LinkedAccountMode.EXISTING) {
        // Rattachement d'un compte existant — identifié par son loginIdentifier uniquement
        const existingStudent = await userRepo.findOne({ where: { loginIdentifier: dto.studentLoginIdentifier } });
        if (!existingStudent) {
          throw new NotFoundException(`No account found with loginIdentifier '${dto.studentLoginIdentifier}'`);
        }
        savedStudent = existingStudent;
      } else if (dto.studentAccountMode === LinkedAccountMode.NEW) {
        // Création du compte élève avec l'identifiant de connexion CHOISI (409 si pris)
        const studentEmail = dto.studentEmail as string;
        const studentLoginIdentifier = await this.resolveLoginIdentifier(
          studentEmail,
          dto.studentLoginIdentifier,
          userRepo,
        );
        studentEmailAlreadyUsed = !!(await userRepo.findOne({ where: { email: studentEmail } }));

        const studentPasswordHash = await bcrypt.hash(dto.studentPassword ?? dto.password, 12);
        const student = userRepo.create({
          loginIdentifier: studentLoginIdentifier,
          email: studentEmail,
          passwordHash: studentPasswordHash,
          role: UserRole.ELEVE,
          validationStatus: ValidationStatus.PENDING,
          consentSigned: false,
        });
        savedStudent = await userRepo.save(student);
        studentCreated = true;
      }

      await this.persistAdministrativeProfile(savedParent.id, dto.firstName, dto.lastName, dto.phoneNumber);
      if (studentCreated && savedStudent) {
        await this.persistAdministrativeProfile(savedStudent.id, dto.studentFirstName as string, dto.studentLastName as string);
      }
      if (savedStudent) {
        await this.linkParentAsFinanceOwner(savedStudent.id, savedParent.id);
      }

      return {
        savedParent,
        parentEmailAlreadyUsed,
        parentLoginIdentifier,
        savedStudent,
        studentCreated,
        studentEmailAlreadyUsed,
        recordedConsents,
      };
    });

    this.eventsService.publish('AccountCreated', {
      userId: result.savedParent.id,
      loginIdentifier: result.savedParent.loginIdentifier,
      email: result.savedParent.email,
      role: result.savedParent.role,
      ipAddress,
    });
    this.publishConsentSignedEvents(result.savedParent.id, result.recordedConsents);

    if (result.studentCreated && result.savedStudent) {
      this.eventsService.publish('AccountCreated', {
        userId: result.savedStudent.id,
        loginIdentifier: result.savedStudent.loginIdentifier,
        email: result.savedStudent.email,
        role: result.savedStudent.role,
        ipAddress,
      });
    }

    return {
      parent: {
        ...this.toPublic(result.savedParent),
        ...(result.parentEmailAlreadyUsed
          ? { emailAlreadyUsed: true, suggestedLoginIdentifier: result.parentLoginIdentifier }
          : {}),
      },
      student: result.savedStudent
        ? {
            ...this.toPublic(result.savedStudent),
            created: result.studentCreated,
            ...(result.studentEmailAlreadyUsed ? { emailAlreadyUsed: true } : {}),
          }
        : null,
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

  async findByUserId(userId: string): Promise<{
    userId: string;
    loginIdentifier: string;
    role: string;
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable');
    return {
      userId: user.id,
      loginIdentifier: user.loginIdentifier,
      role: user.role,
    };
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
   *
   * Retourne le compte mis à jour, ou `null` si rien n'a changé (compte
   * introuvable, ou consentements déjà marqués comme signés). Les routes de
   * création de compte s'en servent pour renvoyer immédiatement l'état réel du
   * compte (`consentSigned: true`, `validationStatus: 'active'`) au lieu de
   * l'instance en mémoire d'avant activation.
   */
  async activateAfterMandatoryConsents(userId: string, manager?: EntityManager): Promise<User | null> {
    const userRepo = manager ? manager.getRepository(User) : this.userRepo;
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user || user.consentSigned) return null;

    user.consentSigned = true;
    if (user.validationStatus === ValidationStatus.PENDING) {
      user.validationStatus = ValidationStatus.ACTIVE;
    }
    return userRepo.save(user);
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

  /**
   * Enregistre le profil administratif (firstName/lastName/phone) d'un compte
   * nouvellement créé auprès de profile-service — unique lieu de stockage de ces
   * données depuis la décision d'architecture du 2026-08-05
   * (identity-access-service ne les persiste plus du tout localement, voir
   * user.entity.ts). Doit être appelée à l'intérieur de la même
   * DataSource.transaction que la création du compte : si l'appel échoue
   * (réseau, timeout, HTTP non-2xx), l'exception ServiceUnavailableException
   * levée ici fait échouer toute la transaction (rollback automatique de la
   * ligne `users` tout juste insérée) plutôt que de créer un compte "orphelin"
   * sans aucune trace de son identité dans le système.
   *
   * Compromis assumé : la connexion DB de la transaction reste ouverte pendant
   * l'appel réseau (borné à 3s par ProfileServiceClient) — acceptable au volume
   * de la phase 1, à revisiter (ex: saga/outbox) si le volume augmente
   * significativement. Voir openItem correspondant dans
   * docs/services/identity-access-service.md.
   */
  private async persistAdministrativeProfile(
    userId: string,
    firstName: string,
    lastName: string,
    phoneNumber?: string,
  ): Promise<void> {
    try {
      await this.profileServiceClient.createAdministrativeProfile({
        userId,
        firstName,
        lastName,
        // Mapping de nom de champ : phoneNumber côté DTO d'entrée
        // d'identity-access-service → phone côté contrat profile-service
        // (convention déjà établie sur ses autres routes internes).
        ...(phoneNumber ? { phone: phoneNumber } : {}),
      });
    } catch (profileError) {
      throw new ServiceUnavailableException(
        "Impossible de finaliser la création du compte : le profil utilisateur (nom, prénom, téléphone) n'a " +
          'pas pu être enregistré car profile-service est indisponible ou en erreur. Aucune donnée n\'a été ' +
          `conservée, veuillez réessayer. Détail : ${(profileError as Error).message}`,
      );
    }
  }

  /**
   * Crée le lien financeur/élève (finance-owner-student) lorsqu'un élève et un
   * parent financeur sont créés ou associés dans le même appel de création de
   * compte (createStudentAccount avec parentLoginIdentifier/parentEmail, ou
   * createParentAccount avec studentLoginIdentifier/studentEmail — décision
   * produit du 2026-08-05). Mêmes garanties d'atomicité que
   * persistAdministrativeProfile ci-dessus.
   */
  private async linkParentAsFinanceOwner(studentId: string, financeOwnerId: string): Promise<void> {
    try {
      await this.profileServiceClient.linkParentToStudent({ studentId, financeOwnerId });
    } catch (linkError) {
      throw new ServiceUnavailableException(
        'Impossible de finaliser la création des comptes : la liaison financeur/élève a échoué car ' +
          `profile-service est indisponible ou en erreur. Veuillez réessayer. Détail : ${(linkError as Error).message}`,
      );
    }
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
