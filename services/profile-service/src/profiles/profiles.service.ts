import {
  Injectable,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AdministrativeProfile } from './entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from './entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from './entities/teacher-pedagogical-profile.entity';
import { InternalProfileNote } from './entities/internal-profile-note.entity';
import { TeacherValidation } from './entities/teacher-validation.entity';
import { ProfileVisibilityPreference } from './entities/profile-visibility-preference.entity';
import { RelationsService } from '../relations/relations.service';
import {
  IdentityAccessClient,
  IdentityAccessNotFoundError,
  IdentityAccessUnavailableError,
} from '../common/clients/identity-access.client';
import { UpdateAdministrativeProfileDto } from './dto/update-administrative-profile.dto';
import {
  UpdateStudentPedagogicalProfileDto,
  UpdateTeacherPedagogicalProfileDto,
} from './dto/update-pedagogical-profile.dto';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { UpdateInternalNoteDto } from './dto/update-internal-note.dto';
import { UpdateTeacherValidationDto } from './dto/update-teacher-validation.dto';
import { UpdateVisibilityPreferenceDto } from './dto/update-visibility-preference.dto';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';
import { Actor } from '../common/types/actor.type';

export { Actor };

/**
 * Roles allowed to READ internal notes (PROF-FB-002):
 * RP, AP, TI, AF — eleve, parent_financeur and formateur are always forbidden.
 */
const NOTES_READ_ROLES: UserRole[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

/**
 * Roles allowed to CREATE internal notes (PROF-FB-002):
 * Only RP and AP may write notes.
 */
const NOTES_WRITE_ROLES: UserRole[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
];

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    @InjectRepository(AdministrativeProfile)
    private readonly adminRepo: Repository<AdministrativeProfile>,
    @InjectRepository(StudentPedagogicalProfile)
    private readonly studentPedaRepo: Repository<StudentPedagogicalProfile>,
    @InjectRepository(TeacherPedagogicalProfile)
    private readonly teacherPedaRepo: Repository<TeacherPedagogicalProfile>,
    @InjectRepository(InternalProfileNote)
    private readonly noteRepo: Repository<InternalProfileNote>,
    @InjectRepository(TeacherValidation)
    private readonly teacherValidationRepo: Repository<TeacherValidation>,
    @InjectRepository(ProfileVisibilityPreference)
    private readonly visibilityPrefRepo: Repository<ProfileVisibilityPreference>,
    private readonly relationsService: RelationsService,
    private readonly events: EventsService,
    private readonly identityAccessClient: IdentityAccessClient,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Read the full profile (administrative + pedagogical) for a user.
   *
   * Access rules:
   *  - A FORMATEUR may only view profiles of students they are linked to (PROF-FB-003).
   *  - InternalProfileNotes are never included in this response (PROF-BR-009).
   *  - PROF-BR-012: returned fields are filtered by the actor's role.
   */
  async getProfile(userId: string, actor: Actor) {
    await this.assertReadAccess(userId, actor);

    let admin = await this.adminRepo.findOne({ where: { userId } });
    const studentPeda = await this.studentPedaRepo.findOne({ where: { userId } });
    const teacherPeda = await this.teacherPedaRepo.findOne({ where: { userId } });
    let pedagogical = studentPeda ?? teacherPeda ?? null;

    // Lazy-create minimal profiles when none exist for a valid user.
    // A user that has passed JWT authentication is guaranteed to exist in
    // identity-access-service, so returning 404 here would be misleading.
    const needsAdminBootstrap = !admin;
    // For an ELEVE consulting their own profile, also create a minimal
    // student pedagogical profile if none exists yet (PROF-BR: lazy init).
    // For a FORMATEUR consulting their own profile, also create a minimal
    // teacher pedagogical profile if none exists yet (same lazy-init pattern).
    const needsStudentPedaBootstrap =
      !pedagogical && actor.role === UserRole.ELEVE && actor.id === userId;
    const needsTeacherPedaBootstrap =
      !pedagogical && actor.role === UserRole.FORMATEUR && actor.id === userId;

    // This lazy-init path can perform up to two independent writes
    // (administrative + pedagogical profile creation). Both writes go through
    // the same EntityManager inside a single transaction so that a user never
    // ends up with a half-created profile (services-convention: "toute
    // opération multi-écritures atomique utilise DataSource.transaction").
    if (needsAdminBootstrap || needsStudentPedaBootstrap || needsTeacherPedaBootstrap) {
      await this.dataSource.transaction(async (manager) => {
        if (needsAdminBootstrap) {
          const adminRepo = manager.getRepository(AdministrativeProfile);
          const minimalAdminProfile = adminRepo.create({ userId });
          admin = await adminRepo.save(minimalAdminProfile);
        }

        if (needsStudentPedaBootstrap) {
          const studentPedaRepo = manager.getRepository(StudentPedagogicalProfile);
          const minimalStudentPeda = studentPedaRepo.create({ userId });
          pedagogical = await studentPedaRepo.save(minimalStudentPeda);
        } else if (needsTeacherPedaBootstrap) {
          const teacherPedaRepo = manager.getRepository(TeacherPedagogicalProfile);
          const minimalTeacherPeda = teacherPedaRepo.create({ userId });
          pedagogical = await teacherPedaRepo.save(minimalTeacherPeda);
        }
      });
    }

    const loginIdentifier = await this.fetchLoginIdentifier(userId);

    return {
      userId,
      loginIdentifier,
      administrative: admin,
      pedagogical,
    };
  }

  /** Update (upsert) the administrative profile for a user. */
  async updateAdministrativeProfile(
    userId: string,
    dto: UpdateAdministrativeProfileDto,
    actor: Actor,
  ) {
    this.assertWriteAccess(userId, actor);

    let profile = await this.adminRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.adminRepo.create({ userId, ...dto });
    } else {
      Object.assign(profile, dto);
    }

    const saved = await this.adminRepo.save(profile);
    this.events.publish('ProfileUpdated', { userId, actorId: actor.id, section: 'administrative' });
    return saved;
  }

  /**
   * Update (upsert) the pedagogical profile for a user.
   * Accepts student or teacher-specific fields depending on the target's context.
   * RP and TI may update any user; a user may update their own profile.
   */
  async updatePedagogicalProfile(
    userId: string,
    dto: UpdateStudentPedagogicalProfileDto | UpdateTeacherPedagogicalProfileDto,
    actor: Actor,
  ) {
    this.assertWriteAccess(userId, actor);

    if (this.isStudentDto(dto)) {
      let profile = await this.studentPedaRepo.findOne({ where: { userId } });
      if (!profile) {
        profile = this.studentPedaRepo.create({ userId, ...dto });
      } else {
        Object.assign(profile, dto);
      }
      const saved = await this.studentPedaRepo.save(profile);
      this.events.publish('ProfileUpdated', { userId, actorId: actor.id, section: 'pedagogical-student' });
      return saved;
    }

    // Teacher profile
    let profile = await this.teacherPedaRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.teacherPedaRepo.create({ userId, ...dto });
    } else {
      Object.assign(profile, dto);
    }
    const saved = await this.teacherPedaRepo.save(profile);
    this.events.publish('ProfileUpdated', { userId, actorId: actor.id, section: 'pedagogical-teacher' });
    return saved;
  }

  /**
   * List internal notes for a user.
   * Restricted to RP, AP, TI and AF (PROF-FB-002).
   */
  async getInternalNotes(userId: string, actor: Actor) {
    this.assertNotesReadAccess(actor);
    return this.noteRepo.find({
      where: { targetUserId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single internal note by noteId.
   * Restricted to RP, AP, TI and AF (PROF-FB-002).
   */
  async getInternalNote(userId: string, noteId: string, actor: Actor) {
    this.assertNotesReadAccess(actor);

    const note = await this.noteRepo.findOne({
      where: { id: noteId, targetUserId: userId },
    });
    if (!note) {
      throw new NotFoundException(`Internal note ${noteId} not found for user ${userId}`);
    }
    return note;
  }

  /**
   * Add an internal note about a user.
   * Restricted to RP and AP only (PROF-FB-002).
   */
  async createInternalNote(userId: string, dto: CreateInternalNoteDto, actor: Actor) {
    this.assertNotesWriteAccess(actor);

    const note = this.noteRepo.create({
      targetUserId: userId,
      authorId: actor.id,
      authorRole: actor.role,
      content: dto.content,
    });
    return this.noteRepo.save(note);
  }

  /**
   * Update an internal note.
   * Restricted to the note's author (RP or AP) or any RP (PROF-FB-002).
   */
  async updateInternalNote(
    userId: string,
    noteId: string,
    dto: UpdateInternalNoteDto,
    actor: Actor,
  ) {
    this.assertNotesWriteAccess(actor);

    const note = await this.noteRepo.findOne({
      where: { id: noteId, targetUserId: userId },
    });
    if (!note) {
      throw new NotFoundException(`Internal note ${noteId} not found for user ${userId}`);
    }

    // Only the original author OR any RP may update the note
    const isAuthor = note.authorId === actor.id;
    const isResponsablePedagogique = actor.role === UserRole.RESPONSABLE_PEDAGOGIQUE;
    if (!isAuthor && !isResponsablePedagogique) {
      throw new ForbiddenException(
        'Only the note author or a RP may update this internal note (PROF-FB-002)',
      );
    }

    note.content = dto.content;
    return this.noteRepo.save(note);
  }

  /**
   * Delete an internal note.
   * Restricted to RP only (PROF-FB-002).
   */
  async deleteInternalNote(userId: string, noteId: string, actor: Actor) {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException(
        'Only a RP may delete an internal note (PROF-FB-002)',
      );
    }

    const note = await this.noteRepo.findOne({
      where: { id: noteId, targetUserId: userId },
    });
    if (!note) {
      throw new NotFoundException(`Internal note ${noteId} not found for user ${userId}`);
    }

    await this.noteRepo.remove(note);
  }

  /**
   * Promote a formateur to Animateur Pédagogique (PROF-BR-008).
   * Creates the teacher pedagogical profile if it does not yet exist.
   * Restricted to RP only.
   */
  async promoteToAnimateurPedagogique(teacherId: string, actor: Actor) {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException('Only RP can promote a teacher to Animateur Pédagogique');
    }

    let profile = await this.teacherPedaRepo.findOne({ where: { userId: teacherId } });
    if (!profile) {
      profile = this.teacherPedaRepo.create({ userId: teacherId, isAnimateurPedagogique: true });
    } else {
      profile.isAnimateurPedagogique = true;
    }

    const saved = await this.teacherPedaRepo.save(profile);
    this.events.publish('TeacherPromotedToPedagogicalAnimator', {
      teacherId,
      actorId: actor.id,
    });
    return saved;
  }

  /**
   * Update (upsert) the validation status of a formateur.
   *
   * Transition rules (PROF-BR):
   *   pending     → in_review  : RP only
   *   in_review   → validated  : RP or TI
   *   in_review   → rejected   : RP or TI
   *   pending     → validated  : TI only (bypass administratif autorisé)
   *   pending     → rejected   : TI only (bypass administratif autorisé)
   *
   * Publishes TeacherValidated when status transitions to 'validated'.
   */
  async updateTeacherValidation(
    teacherId: string,
    dto: UpdateTeacherValidationDto,
    actor: Actor,
  ) {
    const isResponsablePedagogique = actor.role === UserRole.RESPONSABLE_PEDAGOGIQUE;
    const isTechnicienInformatique = actor.role === UserRole.TECHNICIEN_INFORMATIQUE;

    if (!isResponsablePedagogique && !isTechnicienInformatique) {
      throw new ForbiddenException(
        'Only RP or TI may update a teacher validation status',
      );
    }

    // Fetch or initialise the validation record
    let validation = await this.teacherValidationRepo.findOne({ where: { teacherId } });
    const currentStatus = validation?.status ?? 'pending';
    const targetStatus = dto.status;

    this.assertValidationTransition(currentStatus, targetStatus, actor);

    if (!validation) {
      validation = this.teacherValidationRepo.create({
        teacherId,
        status: targetStatus,
        validatedBy: actor.id,
        validatorRole: actor.role,
        comment: dto.comment,
      });
    } else {
      validation.status = targetStatus;
      validation.validatedBy = actor.id;
      validation.validatorRole = actor.role;
      if (dto.comment !== undefined) {
        validation.comment = dto.comment;
      }
    }

    const saved = await this.teacherValidationRepo.save(validation);

    if (targetStatus === 'validated') {
      this.events.publish('TeacherValidated', { teacherId, actorId: actor.id });
    }

    return saved;
  }

  /**
   * Validates that the requested status transition is allowed for the given actor.
   *
   * Allowed transitions:
   *   pending   → in_review  : RP only
   *   in_review → validated  : RP or TI
   *   in_review → rejected   : RP or TI
   *   pending   → validated  : TI only (bypass)
   *   pending   → rejected   : TI only (bypass)
   *
   * Any other transition is rejected with a ForbiddenException.
   */
  private assertValidationTransition(
    currentStatus: string,
    targetStatus: string,
    actor: Actor,
  ): void {
    const isResponsablePedagogique = actor.role === UserRole.RESPONSABLE_PEDAGOGIQUE;
    const isTechnicienInformatique = actor.role === UserRole.TECHNICIEN_INFORMATIQUE;

    if (currentStatus === targetStatus) {
      throw new ForbiddenException(
        `Teacher validation status is already '${currentStatus}' — no transition needed`,
      );
    }

    // pending → in_review : RP only
    if (currentStatus === 'pending' && targetStatus === 'in_review') {
      if (!isResponsablePedagogique) {
        throw new ForbiddenException(
          'Only RP may move a formateur from pending to in_review',
        );
      }
      return;
    }

    // in_review → validated or in_review → rejected : RP or TI
    if (
      currentStatus === 'in_review' &&
      (targetStatus === 'validated' || targetStatus === 'rejected')
    ) {
      return; // both RP and TI are already guarded at the method entry point
    }

    // pending → validated or pending → rejected : TI bypass only
    if (
      currentStatus === 'pending' &&
      (targetStatus === 'validated' || targetStatus === 'rejected')
    ) {
      if (!isTechnicienInformatique) {
        throw new ForbiddenException(
          'Only TI may bypass the in_review step and move directly from pending to validated or rejected',
        );
      }
      return;
    }

    // All other transitions are forbidden
    throw new ForbiddenException(
      `Transition from '${currentStatus}' to '${targetStatus}' is not allowed`,
    );
  }

  /**
   * List all formateurs whose validation status is 'pending'.
   * Restricted to RP only.
   * Joins with administrative_profiles to return name fields when available.
   */
  async listTeachersPendingValidation(actor: Actor): Promise<{
    id: string;
    teacherId: string;
    firstName: string | null;
    lastName: string | null;
    createdAt: Date;
  }[]> {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException(
        'Only RP may list teachers pending validation',
      );
    }

    const pendingValidations = await this.teacherValidationRepo.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
    });

    // Batch-fetch all administrative profiles in a single query instead of
    // one findOne() per pending validation (services-convention: avoid N+1).
    const teacherIds = pendingValidations.map((validation) => validation.teacherId);
    const adminProfiles = teacherIds.length
      ? await this.adminRepo.find({ where: { userId: In(teacherIds) } })
      : [];
    const adminProfileByTeacherId = new Map(
      adminProfiles.map((adminProfile) => [adminProfile.userId, adminProfile]),
    );

    return pendingValidations.map((validation) => {
      const adminProfile = adminProfileByTeacherId.get(validation.teacherId);
      return {
        id: validation.id,
        teacherId: validation.teacherId,
        firstName: adminProfile?.firstName ?? null,
        lastName: adminProfile?.lastName ?? null,
        createdAt: validation.createdAt,
      };
    });
  }

  /**
   * Get the current validation status of a formateur.
   * Accessible to RP, TI, and the teacher themselves.
   */
  async getTeacherValidation(teacherId: string, actor: Actor) {
    const allowedRoles = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];
    if (!allowedRoles.includes(actor.role) && actor.id !== teacherId) {
      throw new ForbiddenException(
        'You may only view your own validation status',
      );
    }

    const validation = await this.teacherValidationRepo.findOne({ where: { teacherId } });
    return validation ?? { teacherId, status: 'pending' };
  }

  /**
   * Get consolidated pedagogical statistics for a user.
   * Statistics are computed from external services (learning-activity-service, calendar-service)
   * and are stored/cached here when received via events.
   * For phase 1, returns the stored snapshot.
   */
  async getPedagogicalStatistics(userId: string, actor: Actor) {
    await this.assertReadAccess(userId, actor);

    const studentProfile = await this.studentPedaRepo.findOne({ where: { userId } });
    const teacherProfile = await this.teacherPedaRepo.findOne({ where: { userId } });

    if (!studentProfile && !teacherProfile) {
      throw new NotFoundException(`No pedagogical profile found for user ${userId}`);
    }

    // Phase 1: return the data embedded in the pedagogical profile.
    // In later phases, this will aggregate from learning-activity-service.
    return {
      userId,
      profileType: studentProfile ? 'student' : 'teacher',
      statistics: studentProfile
        ? {
            niveauScolaire: studentProfile.niveauScolaire,
            matieres: studentProfile.matieres,
          }
        : {
            niveauxEnseignes: teacherProfile.niveauxEnseignes,
            matieresEnseignees: teacherProfile.matieresEnseignees,
            isAnimateurPedagogique: teacherProfile.isAnimateurPedagogique,
          },
    };
  }

  /**
   * Get or create the visibility preference record for an élève.
   */
  async getVisibilityPreferences(userId: string, actor: Actor) {
    if (actor.id !== userId && !this.isPrivilegedRole(actor.role)) {
      throw new ForbiddenException('You may only view your own visibility preferences');
    }

    const existing = await this.visibilityPrefRepo.findOne({ where: { userId } });
    if (existing) return existing;

    // Return defaults without persisting
    return { userId, hideDifficultiesFromContacts: false, restrictCommentsToPrincipalTeacher: false };
  }

  /**
   * Update the visibility preference for an élève (PROF-FN-004).
   * Only the élève themselves or an admin role may update.
   */
  async updateVisibilityPreferences(
    userId: string,
    dto: UpdateVisibilityPreferenceDto,
    actor: Actor,
  ) {
    if (actor.id !== userId && !this.isPrivilegedRole(actor.role)) {
      throw new ForbiddenException('You may only update your own visibility preferences');
    }

    let preference = await this.visibilityPrefRepo.findOne({ where: { userId } });
    if (!preference) {
      preference = this.visibilityPrefRepo.create({ userId, ...dto });
    } else {
      Object.assign(preference, dto);
    }

    return this.visibilityPrefRepo.save(preference);
  }

  // ---------------------------------------------------------------------------
  // System bootstrap ports — consumed by InternalController/InternalService
  // (account onboarding, no human actor — authorization is enforced upstream
  // by InternalGuard/X-Internal-Secret) and by ParentLinkRequestsService.
  // ---------------------------------------------------------------------------

  /**
   * Idempotent creation of the administrative profile for onboarding flows.
   * Does nothing (returns the existing profile) if one already exists.
   */
  async bootstrapAdministrativeProfile(input: {
    userId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthDate?: string;
  }): Promise<AdministrativeProfile> {
    let profile = await this.adminRepo.findOne({ where: { userId: input.userId } });
    if (!profile) {
      profile = this.adminRepo.create({
        userId: input.userId,
        firstName: input.firstName,
        lastName: input.lastName,
        telephone: input.phone ?? undefined,
        dateNaissance: input.birthDate,
      });
      profile = await this.adminRepo.save(profile);
    }
    return profile;
  }

  /**
   * Idempotent creation of the student pedagogical profile for onboarding flows.
   */
  async bootstrapStudentPedagogicalProfile(input: {
    userId: string;
    level?: string;
  }): Promise<StudentPedagogicalProfile> {
    let profile = await this.studentPedaRepo.findOne({ where: { userId: input.userId } });
    if (!profile) {
      profile = this.studentPedaRepo.create({ userId: input.userId, niveauScolaire: input.level });
      profile = await this.studentPedaRepo.save(profile);
    }
    return profile;
  }

  /**
   * Idempotent creation of the teacher pedagogical profile for onboarding flows.
   */
  async bootstrapTeacherPedagogicalProfile(input: {
    userId: string;
    subjects?: string[];
    levels?: string[];
    bio?: string;
  }): Promise<TeacherPedagogicalProfile> {
    let profile = await this.teacherPedaRepo.findOne({ where: { userId: input.userId } });
    if (!profile) {
      profile = this.teacherPedaRepo.create({
        userId: input.userId,
        matieresEnseignees: input.subjects,
        niveauxEnseignes: input.levels,
        experiencePedagogique: input.bio,
      });
      profile = await this.teacherPedaRepo.save(profile);
    }
    return profile;
  }

  /**
   * Read-only port used by ParentLinkRequestsService.createRequest to check
   * that a resolved userId has a student pedagogical profile, without
   * injecting StudentPedagogicalProfile's repository outside this feature.
   */
  async studentPedagogicalProfileExists(userId: string): Promise<boolean> {
    const profile = await this.studentPedaRepo.findOne({ where: { userId } });
    return !!profile;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Asserts that actor may read the profile of userId.
   * PROF-FB-003: a FORMATEUR may only read profiles of linked students.
   * PROF-RA-002 / PROF-BR-011: a PARENT_FINANCEUR may only read profiles of linked students.
   */
  private async assertReadAccess(userId: string, actor: Actor): Promise<void> {
    if (actor.id === userId) return;

    if (actor.role === UserRole.FORMATEUR) {
      const isLinked = await this.relationsService.isTeacherLinkedToStudent(actor.id, userId);
      if (!isLinked) {
        throw new ForbiddenException(
          'A formateur may only view profiles of students they are linked to (PROF-FB-003)',
        );
      }
      return;
    }

    if (actor.role === UserRole.PARENT_FINANCEUR) {
      const isLinked = await this.relationsService.isFinanceOwnerLinkedToStudent(actor.id, userId);
      if (!isLinked) {
        throw new ForbiddenException(
          'A parent may only view profiles of students they are linked to (PROF-RA-002)',
        );
      }
      return;
    }

    if (actor.role === UserRole.ELEVE) {
      throw new ForbiddenException('An élève may only view their own profile');
    }
  }

  /**
   * Asserts that actor may write the profile of userId.
   * Owner, RP, and TI may always write; others only their own profile.
   */
  private assertWriteAccess(userId: string, actor: Actor): void {
    const privileged = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];
    if (!privileged.includes(actor.role) && actor.id !== userId) {
      throw new ForbiddenException('You may only update your own profile');
    }
  }

  /** Guards READ endpoints for internal notes (RP, AP, TI, AF — PROF-FB-002). */
  private assertNotesReadAccess(actor: Actor): void {
    if (!NOTES_READ_ROLES.includes(actor.role)) {
      throw new ForbiddenException(
        'Internal notes are only readable by RP, AP, TI and AdministrateurFinancier (PROF-FB-002)',
      );
    }
  }

  /** Guards WRITE endpoints for internal notes (RP and AP only — PROF-FB-002). */
  private assertNotesWriteAccess(actor: Actor): void {
    if (!NOTES_WRITE_ROLES.includes(actor.role)) {
      throw new ForbiddenException(
        'Internal notes can only be created or modified by RP and AnimateurPedagogique (PROF-FB-002)',
      );
    }
  }

  private isStudentDto(
    dto: UpdateStudentPedagogicalProfileDto | UpdateTeacherPedagogicalProfileDto,
  ): dto is UpdateStudentPedagogicalProfileDto {
    return (
      'niveauScolaire' in dto ||
      'objectifsPedagogiques' in dto ||
      'besoinsSpecifiques' in dto
    );
  }

  private isPrivilegedRole(role: UserRole): boolean {
    return [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ].includes(role);
  }

  /**
   * Fetches loginIdentifier from identity-access-service for a given userId,
   * via the typed IdentityAccessClient adapter (services-convention: appels
   * interservices via un client typé avec timeout).
   * Returns null on 404 or network/timeout error (graceful degradation —
   * never throws): a missing loginIdentifier must not break profile reads.
   */
  private async fetchLoginIdentifier(userId: string): Promise<string | null> {
    try {
      const account = await this.identityAccessClient.findAccountByUserId(userId);
      return account.loginIdentifier ?? null;
    } catch (error) {
      if (!(error instanceof IdentityAccessNotFoundError || error instanceof IdentityAccessUnavailableError)) {
        throw error;
      }
      return null;
    }
  }
}
