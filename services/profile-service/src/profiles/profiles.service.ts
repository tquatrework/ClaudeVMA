import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdministrativeProfile } from './entities/administrative-profile.entity';
import {
  AdministrativeProfileView,
  DEFAULT_AVATAR_PUBLIC_PATH_PREFIX,
  toAdministrativeProfileView,
} from './administrative-profile.view';
import { StudentPedagogicalProfile } from './entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from './entities/teacher-pedagogical-profile.entity';
import { InternalProfileNote } from './entities/internal-profile-note.entity';
import { TeacherValidation } from './entities/teacher-validation.entity';
import { RelationsService } from '../relations/relations.service';
import {
  IdentityAccount,
  IdentityAccessClient,
  IdentityAccessNotFoundError,
  IdentityAccessUnavailableError,
} from '../common/clients/identity-access.client';
import { UpdateAdministrativeProfileDto } from './dto/update-administrative-profile.dto';
import { UpdatePedagogicalProfileDto } from './dto/update-pedagogical-profile.dto';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { UpdateInternalNoteDto } from './dto/update-internal-note.dto';
import { UpdateTeacherValidationDto } from './dto/update-teacher-validation.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { EventsService } from '../events/events.service';
import { FieldVisibilityService } from './field-visibility.service';
import { FieldAudience } from './field-visibility.catalog';
import {
  ViewerRelation,
  filterProfileBlock,
  pedagogicalBlockOf,
} from './profile-visibility-filter';
import { UserRole } from '../common/enums/user-role.enum';
import { Actor } from '../common/types/actor.type';

export { Actor };

/**
 * Rôles EXEMPTÉS des réglages de visibilité champ par champ (arbitrage du
 * 2026-08-09, `docs/architecture.md` > « Arbitrages rendus » : « s'applique aux
 * autres contacts liés, pas au parent financeur ni aux administrateurs »).
 *
 * Le parent financeur n'y figure pas parce que son exemption est
 * CONDITIONNELLE : elle vaut sur les élèves auxquels il est rattaché, et
 * seulement eux. Ce rattachement est déjà exigé par `assertReadAccess`, qui
 * refuse en 403 toute autre cible — la condition est donc portée par le contrôle
 * d'accès, pas par cette liste (voir `resolveViewerRelation`).
 *
 * L'ANIMATEUR PÉDAGOGIQUE y figure : il lit les profils des formateurs qu'il
 * anime, dont l'expérience, les diplômes, les spécialités et les
 * particularités sont TOUS `self` par défaut. Le soumettre au filtrage le
 * rendrait aveugle à l'essentiel du dossier qu'il doit animer.
 * Le RESPONSABLE PÉDAGOGIQUE aussi, et de façon dirimante : il ÉCRIT la section
 * prescription (`PUT /profiles/:userId/prescription`), dont l'intégralité des
 * champs est `self` par défaut. Filtré, il ne relirait pas ce qu'il vient
 * d'écrire.
 */
const FIELD_VISIBILITY_EXEMPT_ROLES: UserRole[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

/** Rôle de profil pédagogique visé par une écriture. */
export type PedagogicalTarget = 'student' | 'teacher';

/**
 * Champs EXCLUSIFS au profil pédagogique élève / formateur, section
 * déclarative. `subjects` est absent des deux listes à dessein : il existe sur
 * les deux profils et ne peut donc rien trancher.
 */
const STUDENT_DECLARATIVE_FIELDS = [
  'level',
  'goals',
  'specificNeeds',
  'difficulties',
  'context',
] as const;

const TEACHER_DECLARATIVE_FIELDS = [
  'levels',
  'experience',
  'diplomas',
  'specialties',
  'particularities',
  'cvDocumentId',
] as const;

/** Champs de la section prescription, par rôle. Aucun champ commun. */
const STUDENT_PRESCRIPTION_FIELDS = [
  'generalAssessment',
  'recommendedPace',
  'recommendedTeacherProfile',
  'recommendedPath',
  'recommendedActivities',
] as const;

const TEACHER_PRESCRIPTION_FIELDS = [
  'maxValidatedLevel',
  'audienceType',
  'testResults',
  'testComments',
] as const;

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

  /**
   * Préfixe public de la route de lecture de la photo, tel que le front
   * l'atteint à travers l'api-gateway. Résolu une fois, à la construction :
   * `avatarUrl` doit être identique d'une réponse à l'autre, sinon le cache du
   * navigateur repart de zéro à chaque appel.
   */
  private readonly avatarPublicPathPrefix: string;

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
    private readonly relationsService: RelationsService,
    private readonly events: EventsService,
    private readonly identityAccessClient: IdentityAccessClient,
    private readonly fieldVisibilityService: FieldVisibilityService,
    config: ConfigService,
  ) {
    this.avatarPublicPathPrefix =
      config.get<string>('AVATAR_PUBLIC_PATH_PREFIX') ?? DEFAULT_AVATAR_PUBLIC_PATH_PREFIX;
  }

  /**
   * Projette une entité de profil administratif vers sa forme exposée.
   *
   * Point de passage OBLIGÉ de toute réponse portant un bloc `administrative`,
   * publiques comme `/internal/*` : c'est lui qui écarte les champs de
   * stockage de la photo et qui construit `avatarUrl`.
   */
  presentAdministrativeProfile(profile: AdministrativeProfile): AdministrativeProfileView {
    return toAdministrativeProfileView(profile, this.avatarPublicPathPrefix);
  }

  /**
   * Read the full profile (administrative + pedagogical) for a user.
   *
   * Strictly read-only: a consultation NEVER writes anything in database
   * (docs/architecture.md, arbitrages du 2026-08-07). Outcomes:
   *  - userId unknown to identity-access-service        → 404
   *  - account exists but no administrative profile     → 500 (data inconsistency,
   *    logged as an anomaly; the administrative profile is mandatory and created
   *    at signup by the onboarding workflow)
   *  - no pedagogical profile                           → 200 with pedagogical: null
   *    (perfectly normal state: the pedagogical profile is optional and only
   *    created when the user first saves it via PUT /profiles/:userId/pedagogical)
   *
   * Access rules:
   *  - A FORMATEUR may only view profiles of students they are linked to (PROF-FB-003).
   *  - InternalProfileNotes are never included in this response (PROF-BR-009).
   *  - PROF-BR-012: returned fields are filtered by the actor's role.
   *
   * Per-field visibility (arbitrage du 2026-08-09): the owner, the linked
   * FINANCE OWNER and the administrative roles see everything; any other linked
   * contact (today: the formateur) is subject to the per-field settings. A
   * hidden field is ABSENT from the payload and its name is listed in
   * `visibility.hiddenFields` — never replaced by a misleading value.
   */
  async getProfile(userId: string, actor: Actor) {
    await this.assertReadAccess(userId, actor);

    // Single call to identity-access-service: its outcome is used both as the
    // account-existence signal (404 vs 500 below) and as the loginIdentifier
    // source — no extra HTTP round-trip.
    const account = await this.resolveAccount(userId);

    const admin = await this.adminRepo.findOne({ where: { userId } });
    if (!admin) {
      throw this.missingAdministrativeProfileError(userId, account);
    }

    const studentPeda = await this.studentPedaRepo.findOne({ where: { userId } });
    const teacherPeda = await this.teacherPedaRepo.findOne({ where: { userId } });
    const pedagogical = studentPeda ?? teacherPeda ?? null;
    const pedagogicalType = (studentPeda ? 'student' : teacherPeda ? 'teacher' : null) as
      | PedagogicalTarget
      | null;

    const relation = await this.resolveViewerRelation(userId, actor);

    // Une seule requête de réglages, et seulement quand quelque chose peut être
    // masqué : le titulaire et les exemptés n'en déclenchent aucune.
    const audienceByFieldName =
      relation === 'owner' || relation === 'exempt'
        ? new Map<string, FieldAudience>()
        : await this.fieldVisibilityService.resolveAudiences(userId);

    // Le filtrage porte sur la FORME EXPOSÉE, jamais sur l'entité : c'est elle
    // qui contient `avatarUrl` — nom sous lequel le catalogue de visibilité
    // connaît la photo — et non `avatarObjectKey`, qui ne sort pas du service.
    const filteredAdministrative = filterProfileBlock(
      this.presentAdministrativeProfile(admin),
      'administrative',
      audienceByFieldName,
      relation,
    );

    const filteredPedagogical =
      pedagogical && pedagogicalType
        ? filterProfileBlock(
            pedagogical,
            pedagogicalBlockOf(pedagogicalType),
            audienceByFieldName,
            relation,
          )
        : null;

    return {
      userId,
      loginIdentifier: account?.loginIdentifier ?? null,
      administrative: filteredAdministrative.block,
      /**
       * Profil pédagogique COMPLET, sections confondues : la section
       * déclarative et la section prescription sont renvoyées à plat dans le
       * même objet. C'est un seul profil ; seule l'écriture est scindée en
       * deux routes. Le titulaire LIT donc sa prescription ici (arbitrage du
       * 2026-08-09) sans pouvoir la modifier.
       */
      pedagogical: filteredPedagogical ? filteredPedagogical.block : null,
      /**
       * Rôle du profil pédagogique présent, pour que le front sache quel jeu
       * de champs afficher sans avoir à deviner d'après les clés non nulles.
       * null quand aucun profil pédagogique n'existe — état normal, le profil
       * pédagogique étant facultatif.
       *
       * Donnée de STRUCTURE, jamais masquée : sans elle le front ne sait pas
       * quel formulaire afficher.
       */
      pedagogicalType,
      /**
       * Verdict du filtrage, explicite plutôt que déductible.
       *
       * `isFiltered: false` dit « vous voyez cette fiche en entier » — ce qui
       * n'est PAS la même information qu'une liste vide de champs masqués chez
       * un lecteur filtré dont tous les champs se trouvent visibles. Le front
       * peut afficher « certaines informations sont masquées par le titulaire »
       * sans jamais avoir à comparer sa propre idée du catalogue à la réponse.
       */
      visibility: {
        isFiltered: relation !== 'owner' && relation !== 'exempt',
        hiddenFields: [
          ...filteredAdministrative.hiddenFieldNames,
          ...(filteredPedagogical ? filteredPedagogical.hiddenFieldNames : []),
        ],
      },
    };
  }

  /**
   * Position du lecteur vis-à-vis de la fiche, qui décide du filtrage.
   *
   * PUBLIQUE avec `assertReadAccess` : ce sont les deux ports de contrôle
   * d'accès en lecture d'un profil. `AvatarService` les consomme pour que
   * `GET /profiles/:userId/avatar` obéisse EXACTEMENT aux mêmes règles que le
   * champ `avatarUrl` de `GET /profiles/:userId`. Les réécrire à côté aurait
   * garanti qu'elles divergent au premier arbitrage suivant.
   *
   * L'ordre compte : le titulaire d'abord — un utilisateur ne se masque jamais
   * ses propres données, quel que soit son rôle par ailleurs.
   *
   * Le PARENT FINANCEUR est exempté sans nouvelle vérification de lien parce
   * qu'`assertReadAccess`, appelée juste avant, a déjà refusé en 403 tout
   * parent non rattaché à `userId`. Y être parvenu VAUT rattachement ; refaire
   * la requête ici doublerait le coût sans rien décider de plus.
   */
  async resolveViewerRelation(userId: string, actor: Actor): Promise<ViewerRelation> {
    if (actor.id === userId) return 'owner';
    if (actor.role === UserRole.PARENT_FINANCEUR) return 'exempt';
    if (FIELD_VISIBILITY_EXEMPT_ROLES.includes(actor.role)) return 'exempt';

    /**
     * Le formateur parvenu jusqu'ici est nécessairement rattaché à l'élève
     * (PROF-FB-003, vérifié par assertReadAccess) : c'est un contact lié, et il
     * subit les réglages. Le drapeau PROFESSEUR PRINCIPAL n'est PAS consulté —
     * son cas n'a pas été tranché, et l'exempter de son propre chef reviendrait
     * à rendre un arbitrage qui ne revient pas à ce service.
     */
    if (actor.role === UserRole.FORMATEUR) return 'linked';

    return 'authenticated';
  }

  /**
   * Update (upsert) the administrative profile for a user.
   *
   * Les noms de champs du DTO sont désormais strictement identiques à ceux de
   * l'entité (tous en anglais) : aucun remappage n'est nécessaire ici, la
   * correspondance vers les noms de colonnes français de la base est portée
   * une seule fois par les `@Column({ name })` de l'entité.
   *
   * `avatarUrl` n'est PAS écrit ici : il est refusé en 400 par le DTO
   * (`IsServerManagedField`) et n'existe plus comme colonne. La photo de
   * profil passe par POST/DELETE `/profiles/:userId/avatar`.
   */
  async updateAdministrativeProfile(
    userId: string,
    dto: UpdateAdministrativeProfileDto,
    actor: Actor,
  ): Promise<AdministrativeProfileView> {
    this.assertWriteAccess(userId, actor);

    // `avatarUrl` est déclaré dans le DTO uniquement pour être refusé ; il ne
    // franchit jamais la validation, mais l'écarter du patch évite de faire
    // dépendre l'écriture d'un contrôle situé ailleurs.
    const patch = dto as Omit<UpdateAdministrativeProfileDto, 'avatarUrl'>;

    let profile = await this.adminRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.adminRepo.create({ userId, ...patch });
    } else {
      Object.assign(profile, patch);
    }

    const saved = await this.adminRepo.save(profile);
    this.events.publish('ProfileUpdated', { userId, actorId: actor.id, section: 'administrative' });
    return this.presentAdministrativeProfile(saved);
  }

  /**
   * Upsert de la SECTION DÉCLARATIVE du profil pédagogique — celle que le
   * titulaire renseigne lui-même. RP et TI peuvent écrire sur autrui.
   *
   * Cette route N'ACCEPTE PLUS AUCUN CHAMP DE PRESCRIPTION. Les champs de
   * prescription ne figurant pas dans UpdatePedagogicalProfileDto,
   * `forbidNonWhitelisted` les rejette en 400 avant même d'atteindre ce
   * service : un élève ne peut pas rédiger ses propres préconisations, un
   * formateur pas ses propres résultats de test.
   *
   * Le DTO unique porte les champs des deux rôles ; le rôle cible est résolu
   * puis les champs de l'AUTRE rôle sont REFUSÉS EN 400. Ils étaient
   * auparavant filtrés en silence, ce qui renvoyait un 200 mensonger sur une
   * écriture qui n'avait rien écrit.
   */
  async updatePedagogicalProfile(
    userId: string,
    dto: UpdatePedagogicalProfileDto,
    actor: Actor,
  ) {
    this.assertWriteAccess(userId, actor);

    const target = await this.resolvePedagogicalTarget(
      userId,
      this.hasAnyField(dto, STUDENT_DECLARATIVE_FIELDS),
      this.hasAnyField(dto, TEACHER_DECLARATIVE_FIELDS),
      STUDENT_DECLARATIVE_FIELDS,
      TEACHER_DECLARATIVE_FIELDS,
      'declarative',
    );

    if (target === 'student') {
      this.assertNoForeignFields(dto, TEACHER_DECLARATIVE_FIELDS, 'student', 'declarative');

      const patch = this.pickDefined<StudentPedagogicalProfile>({
        level: dto.level,
        subjects: dto.subjects,
        goals: dto.goals,
        specificNeeds: dto.specificNeeds,
        difficulties: dto.difficulties,
        context: dto.context,
      });

      let profile = await this.studentPedaRepo.findOne({ where: { userId } });
      if (!profile) {
        profile = this.studentPedaRepo.create({ userId, ...patch });
      } else {
        Object.assign(profile, patch);
      }
      const saved = await this.studentPedaRepo.save(profile);
      this.events.publish('ProfileUpdated', { userId, actorId: actor.id, section: 'pedagogical-student' });
      return saved;
    }

    // Teacher profile
    this.assertNoForeignFields(dto, STUDENT_DECLARATIVE_FIELDS, 'teacher', 'declarative');

    const patch = this.pickDefined<TeacherPedagogicalProfile>({
      levels: dto.levels,
      subjects: dto.subjects,
      experience: dto.experience,
      diplomas: dto.diplomas,
      specialties: dto.specialties,
      particularities: dto.particularities,
      cvDocumentId: dto.cvDocumentId,
    });

    let profile = await this.teacherPedaRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.teacherPedaRepo.create({ userId, ...patch });
    } else {
      Object.assign(profile, patch);
    }
    const saved = await this.teacherPedaRepo.save(profile);
    this.events.publish('ProfileUpdated', { userId, actorId: actor.id, section: 'pedagogical-teacher' });
    return saved;
  }

  /**
   * Upsert de la SECTION PRESCRIPTION du profil pédagogique — RP UNIQUEMENT.
   *
   * C'est le premier endroit de l'application où lecture et écriture divergent
   * aussi nettement sur un même bloc : le titulaire lit sa prescription via
   * GET /profiles/:userId, mais toute tentative d'écriture par lui-même est
   * refusée en 403, y compris sur son propre profil. Le contrôle ne peut donc
   * pas se contenter d'`assertWriteAccess`, qui autorise justement le
   * titulaire.
   *
   * `filledBy` et `filledAt` sont posés ICI, à partir de l'acteur authentifié
   * et de l'heure serveur. Ils ne sont jamais lus depuis le corps de la
   * requête : c'est ce qui rend la prescription opposable.
   */
  async updatePrescription(userId: string, dto: UpdatePrescriptionDto, actor: Actor) {
    if (actor.role !== UserRole.RESPONSABLE_PEDAGOGIQUE) {
      throw new ForbiddenException(
        'Only a responsable pédagogique may write the prescription section of a ' +
          'pedagogical profile. The profile owner may read it but never write it.',
      );
    }

    const target = await this.resolvePedagogicalTarget(
      userId,
      this.hasAnyField(dto, STUDENT_PRESCRIPTION_FIELDS),
      this.hasAnyField(dto, TEACHER_PRESCRIPTION_FIELDS),
      STUDENT_PRESCRIPTION_FIELDS,
      TEACHER_PRESCRIPTION_FIELDS,
      'prescription',
    );

    const filledAt = new Date();

    if (target === 'student') {
      this.assertNoForeignFields(dto, TEACHER_PRESCRIPTION_FIELDS, 'student', 'prescription');

      const patch = this.pickDefined<StudentPedagogicalProfile>({
        generalAssessment: dto.generalAssessment,
        recommendedPace: dto.recommendedPace,
        recommendedTeacherProfile: dto.recommendedTeacherProfile,
        recommendedPath: dto.recommendedPath,
        recommendedActivities: dto.recommendedActivities,
      });

      let profile = await this.studentPedaRepo.findOne({ where: { userId } });
      if (!profile) {
        profile = this.studentPedaRepo.create({ userId, ...patch });
      } else {
        Object.assign(profile, patch);
      }
      profile.filledBy = actor.id;
      profile.filledAt = filledAt;

      const saved = await this.studentPedaRepo.save(profile);
      this.events.publish('ProfileUpdated', {
        userId,
        actorId: actor.id,
        section: 'prescription-student',
      });
      return saved;
    }

    this.assertNoForeignFields(dto, STUDENT_PRESCRIPTION_FIELDS, 'teacher', 'prescription');

    const patch = this.pickDefined<TeacherPedagogicalProfile>({
      maxValidatedLevel: dto.maxValidatedLevel,
      audienceType: dto.audienceType,
      testResults: dto.testResults,
      testComments: dto.testComments,
    });

    let profile = await this.teacherPedaRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.teacherPedaRepo.create({ userId, ...patch });
    } else {
      Object.assign(profile, patch);
    }
    profile.filledBy = actor.id;
    profile.filledAt = filledAt;

    const saved = await this.teacherPedaRepo.save(profile);
    this.events.publish('ProfileUpdated', {
      userId,
      actorId: actor.id,
      section: 'prescription-teacher',
    });
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

    /**
     * Cette route sert les MÊMES champs (`level`, `subjects`, `levels`) que le
     * bloc `pedagogical` de GET /profiles/:userId : elle applique donc le même
     * filtrage, faute de quoi elle en serait le contournement exact — un
     * formateur y lirait un `level` que l'élève a réglé `self`.
     * `isAnimateurPedagogique` est une donnée de structure, jamais masquée.
     */
    const profileType: PedagogicalTarget = studentProfile ? 'student' : 'teacher';
    const relation = await this.resolveViewerRelation(userId, actor);
    const audienceByFieldName =
      relation === 'owner' || relation === 'exempt'
        ? new Map<string, FieldAudience>()
        : await this.fieldVisibilityService.resolveAudiences(userId);

    // Phase 1: return the data embedded in the pedagogical profile.
    // In later phases, this will aggregate from learning-activity-service.
    const rawStatistics = studentProfile
      ? {
          level: studentProfile.level,
          subjects: studentProfile.subjects,
        }
      : {
          levels: teacherProfile.levels,
          subjects: teacherProfile.subjects,
          isAnimateurPedagogique: teacherProfile.isAnimateurPedagogique,
        };

    const filtered = filterProfileBlock(
      rawStatistics,
      pedagogicalBlockOf(profileType),
      audienceByFieldName,
      relation,
    );

    return {
      userId,
      profileType,
      statistics: filtered.block,
      visibility: {
        isFiltered: relation !== 'owner' && relation !== 'exempt',
        hiddenFields: filtered.hiddenFieldNames,
      },
    };
  }

  // Visibilité champ par champ : voir FieldVisibilityService.
  // Les anciennes méthodes get/updateVisibilityPreferences ont été supprimées
  // avec la table `profile_visibility_preferences` qu'elles servaient — deux
  // booléens nommés en dur ne pouvaient pas porter la visibilité de 35 champs.

  // ---------------------------------------------------------------------------
  // System bootstrap ports — consumed by InternalController/InternalService
  // (account onboarding, no human actor — authorization is enforced upstream
  // by InternalGuard/X-Internal-Secret) and by ParentLinkRequestsService.
  // ---------------------------------------------------------------------------

  /**
   * Idempotent upsert of the administrative profile for onboarding flows.
   *
   * If no profile exists for userId, it is created. This is the ONLY path that
   * creates an administrative profile: reads never create one (getProfile is
   * strictly read-only, see docs/architecture.md, arbitrage 2026-08-07).
   * If a profile already exists (this bootstrap call being replayed by the
   * caller, or a legacy row left over from the lazy-init that used to live in
   * getProfile), the fields provided in input overwrite the existing ones
   * instead of failing on the userId unique constraint or silently keeping a
   * stale/empty name.
   * This is safe because bootstrap calls only happen very early in the
   * account lifecycle (identity-access-service calling right after account
   * creation) — overwriting with the incoming value is the intended
   * source-of-truth behavior at that point, even if the row was already
   * populated by a previous bootstrap call or a lazy-init.
   *
   * As of the identity-access-service migration that removes firstName/
   * lastName/phone from its own `user` table, this method (via
   * POST /internal/create-administrative-profile) is the only place these
   * three fields are persisted for a user — identity-access-service's call
   * is now mandatory, not best-effort. firstName/lastName are required at
   * the DTO level; phone stays optional (not every onboarding flow collects
   * it) but is upserted with the same reliability when provided.
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
        phone: input.phone ?? undefined,
        birthDate: input.birthDate,
      });
      return this.adminRepo.save(profile);
    }

    let hasChanges = false;
    if (input.firstName !== undefined && profile.firstName !== input.firstName) {
      profile.firstName = input.firstName;
      hasChanges = true;
    }
    if (input.lastName !== undefined && profile.lastName !== input.lastName) {
      profile.lastName = input.lastName;
      hasChanges = true;
    }
    if (input.phone !== undefined && profile.phone !== input.phone) {
      profile.phone = input.phone;
      hasChanges = true;
    }
    if (input.birthDate !== undefined && profile.birthDate !== input.birthDate) {
      profile.birthDate = input.birthDate;
      hasChanges = true;
    }
    return hasChanges ? this.adminRepo.save(profile) : profile;
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
      profile = this.studentPedaRepo.create({ userId: input.userId, level: input.level });
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
        subjects: input.subjects,
        levels: input.levels,
        experience: input.bio,
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
   *
   * Publique : partagée avec AvatarService, voir `resolveViewerRelation`.
   */
  async assertReadAccess(userId: string, actor: Actor): Promise<void> {
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

  /** true dès qu'au moins un des `fieldNames` est présent (non `undefined`). */
  private hasAnyField(payload: object, fieldNames: readonly string[]): boolean {
    return fieldNames.some(
      (fieldName) => (payload as Record<string, unknown>)[fieldName] !== undefined,
    );
  }

  /**
   * Résout le rôle du profil pédagogique visé par une écriture.
   *
   * Ordre de résolution, du plus fiable au plus faible :
   *  1. présence simultanée de champs des deux rôles → 400, c'est une erreur
   *     d'appel, jamais un cas à trancher silencieusement ;
   *  2. rôle du compte auprès de identity-access-service — seule source
   *     autoritative. Elle referme au passage l'ambiguïté historique d'un body
   *     ne contenant que `subjects`, champ commun aux deux profils ;
   *  3. si identity-access-service est injoignable : les champs présents ;
   *  4. à défaut, le profil déjà existant en base ;
   *  5. en dernier recours, le profil formateur — comportement hérité, conservé
   *     pour ne pas transformer une écriture jusqu'ici acceptée en erreur.
   */
  private async resolvePedagogicalTarget(
    userId: string,
    hasStudentFields: boolean,
    hasTeacherFields: boolean,
    studentFieldNames: readonly string[],
    teacherFieldNames: readonly string[],
    section: 'declarative' | 'prescription',
  ): Promise<PedagogicalTarget> {
    if (hasStudentFields && hasTeacherFields) {
      throw new BadRequestException(
        `The ${section} payload mixes student-only fields (${studentFieldNames.join(', ')}) ` +
          `and teacher-only fields (${teacherFieldNames.join(', ')}). ` +
          'A pedagogical profile belongs to exactly one role: send one set or the other.',
      );
    }

    const roleTarget = await this.resolveTargetFromAccountRole(userId);
    if (roleTarget) return roleTarget;

    if (hasStudentFields) return 'student';
    if (hasTeacherFields) return 'teacher';

    const studentProfile = await this.studentPedaRepo.findOne({ where: { userId } });
    if (studentProfile) return 'student';

    return 'teacher';
  }

  /**
   * Rôle du profil pédagogique déduit du rôle du compte.
   * Renvoie null si identity-access-service ne répond pas ou si le rôle ne
   * correspond à aucun profil pédagogique (parent, RP, TI, AF) : l'appel
   * retombe alors sur les heuristiques suivantes plutôt que d'échouer. Une
   * indisponibilité de identity-access-service ne doit pas bloquer une
   * écriture de profil.
   */
  private async resolveTargetFromAccountRole(
    userId: string,
  ): Promise<PedagogicalTarget | null> {
    let account: IdentityAccount | null = null;
    try {
      account = await this.identityAccessClient.findAccountByUserId(userId);
    } catch {
      return null;
    }

    if (account?.role === UserRole.ELEVE) return 'student';
    if (
      account?.role === UserRole.FORMATEUR ||
      account?.role === UserRole.ANIMATEUR_PEDAGOGIQUE
    ) {
      return 'teacher';
    }
    return null;
  }

  /**
   * Refuse en 400 tout champ appartenant à l'AUTRE rôle que le rôle résolu.
   *
   * Ces champs étaient auparavant écartés en silence par le filtrage du patch :
   * l'appelant recevait un 200 sur une écriture partiellement — voire
   * totalement — ignorée. Un champ envoyé et non pris en compte doit produire
   * une erreur explicite, jamais un succès trompeur.
   */
  private assertNoForeignFields(
    payload: object,
    foreignFieldNames: readonly string[],
    resolvedTarget: PedagogicalTarget,
    section: 'declarative' | 'prescription',
  ): void {
    const offending = foreignFieldNames.filter(
      (fieldName) => (payload as Record<string, unknown>)[fieldName] !== undefined,
    );
    if (offending.length === 0) return;

    const otherRole = resolvedTarget === 'student' ? 'teacher' : 'student';
    throw new BadRequestException(
      `Field(s) ${offending.join(', ')} belong to the ${otherRole} ${section} section, ` +
        `but this profile resolves to a ${resolvedTarget} profile. ` +
        'They would have been silently ignored, so the request is rejected instead.',
    );
  }

  /**
   * Retire les clés `undefined` d'un patch partiel : sans ce filtrage, un champ
   * absent du body écraserait la valeur existante en base avec `undefined`.
   */
  private pickDefined<T>(patch: Record<string, unknown>): Partial<T> {
    return Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
  }

  private isPrivilegedRole(role: UserRole): boolean {
    return [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ].includes(role);
  }

  /**
   * Resolves the identity-access-service account backing a userId, via the
   * typed IdentityAccessClient adapter (services-convention: appels
   * interservices via un client typé avec timeout).
   *
   * This single call carries two distinct signals, deliberately kept apart:
   *  - IdentityAccessNotFoundError (HTTP 404): the userId is genuinely unknown
   *    to identity-access-service → the caller must answer 404. This is the
   *    only case that turns into a 404.
   *  - IdentityAccessUnavailableError (unreachable host, timeout, or non-2xx/404
   *    status such as a 401/403 from a misconfigured INTERNAL_SECRET): a real
   *    infrastructure/config failure. It MUST NOT be turned into a 404 —
   *    otherwise a single outage of identity-access-service would make every
   *    profile of the platform look deleted. The existing graceful degradation
   *    is kept (returns null → loginIdentifier: null, profile still served),
   *    logged at error level (in addition to the client's own logging) so it
   *    stays visible in observability.
   */
  private async resolveAccount(userId: string): Promise<IdentityAccount | null> {
    try {
      return await this.identityAccessClient.findAccountByUserId(userId);
    } catch (error) {
      if (error instanceof IdentityAccessNotFoundError) {
        throw new NotFoundException(
          `Aucun compte connu de identity-access-service pour userId=${userId}`,
        );
      }
      if (error instanceof IdentityAccessUnavailableError) {
        this.logger.error(
          `loginIdentifier introuvable pour userId=${userId} : identity-access-service indisponible ou ` +
            `mal configuré (${error.message}). Le profil est tout de même renvoyé, avec loginIdentifier=null.`,
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * Builds the 500 raised when a user has no administrative profile.
   *
   * The administrative profile is mandatory and created at signup by the
   * onboarding workflow (docs/architecture.md, arbitrage 2026-08-07). Its
   * absence is therefore a data inconsistency that must stay visible: it is
   * never repaired on the fly by a lazy creation, and never masked behind an
   * empty payload. An explicit server-side anomaly log is emitted so the
   * affected userId can be traced and fixed at the source.
   *
   * `account === null` means identity-access-service could not be reached, so
   * we cannot tell an inconsistency from an unknown account — it stays a 500
   * (a server-side problem either way), with a distinct log wording.
   */
  private missingAdministrativeProfileError(
    userId: string,
    account: IdentityAccount | null,
  ): InternalServerErrorException {
    if (account) {
      this.logger.error(
        `ANOMALIE DE DONNEES : le compte userId=${userId} existe dans identity-access-service ` +
          `(loginIdentifier=${account.loginIdentifier}) mais n'a aucun profil administratif dans ` +
          'profile-service. Le profil administratif est obligatoire et doit être créé à ' +
          "l'inscription via POST /internal/create-administrative-profile. Aucune création à la " +
          'volée n\'est faite en lecture : corriger la donnée à la source.',
      );
    } else {
      this.logger.error(
        `Lecture du profil userId=${userId} impossible : aucun profil administratif en base et ` +
          "identity-access-service injoignable, donc impossible de distinguer un compte inexistant " +
          "d'une incohérence de données. Réponse 500.",
      );
    }
    return new InternalServerErrorException(
      `Profil administratif introuvable pour userId=${userId}`,
    );
  }
}
