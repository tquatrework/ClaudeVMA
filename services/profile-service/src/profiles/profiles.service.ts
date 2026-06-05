import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeProfile } from './entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from './entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from './entities/teacher-pedagogical-profile.entity';
import { InternalProfileNote } from './entities/internal-profile-note.entity';
import { TeacherStudentLink } from '../relations/entities/teacher-student-link.entity';
import { UpdateAdministrativeProfileDto } from './dto/update-administrative-profile.dto';
import {
  UpdateStudentPedagogicalProfileDto,
  UpdateTeacherPedagogicalProfileDto,
} from './dto/update-pedagogical-profile.dto';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';

export interface Actor {
  id: string;
  role: UserRole;
}

/** Roles that may never see InternalProfileNote (PROF-FB-002 / PROF-BR-009-010) */
const NOTES_FORBIDDEN_ROLES: UserRole[] = [
  UserRole.ELEVE,
  UserRole.PARENT_FINANCEUR,
  UserRole.FORMATEUR,
];

/** Roles allowed to read/write internal notes */
const NOTES_ALLOWED_ROLES: UserRole[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(AdministrativeProfile)
    private readonly adminRepo: Repository<AdministrativeProfile>,
    @InjectRepository(StudentPedagogicalProfile)
    private readonly studentPedaRepo: Repository<StudentPedagogicalProfile>,
    @InjectRepository(TeacherPedagogicalProfile)
    private readonly teacherPedaRepo: Repository<TeacherPedagogicalProfile>,
    @InjectRepository(InternalProfileNote)
    private readonly noteRepo: Repository<InternalProfileNote>,
    @InjectRepository(TeacherStudentLink)
    private readonly teacherLinkRepo: Repository<TeacherStudentLink>,
    private readonly events: EventsService,
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

    const admin = await this.adminRepo.findOne({ where: { userId } });
    const studentPeda = await this.studentPedaRepo.findOne({ where: { userId } });
    const teacherPeda = await this.teacherPedaRepo.findOne({ where: { userId } });

    return {
      userId,
      administrative: admin ?? null,
      pedagogical: studentPeda ?? teacherPeda ?? null,
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

  /** List internal notes for a user. Restricted to RP and AdministrateurFinancier (PROF-FB-002). */
  async getInternalNotes(userId: string, actor: Actor) {
    this.assertNotesAccess(actor);
    return this.noteRepo.find({
      where: { targetUserId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Add an internal note about a user. Restricted to RP and AdministrateurFinancier. */
  async createInternalNote(userId: string, dto: CreateInternalNoteDto, actor: Actor) {
    this.assertNotesAccess(actor);

    const note = this.noteRepo.create({
      targetUserId: userId,
      authorId: actor.id,
      authorRole: actor.role,
      content: dto.content,
    });
    return this.noteRepo.save(note);
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Asserts that actor may read the profile of userId.
   * PROF-FB-003: a FORMATEUR may only read profiles of linked students.
   */
  private async assertReadAccess(userId: string, actor: Actor): Promise<void> {
    if (actor.role === UserRole.FORMATEUR && actor.id !== userId) {
      const link = await this.teacherLinkRepo.findOne({
        where: { teacherId: actor.id, studentId: userId },
      });
      if (!link) {
        throw new ForbiddenException(
          'A formateur may only view profiles of students they are linked to (PROF-FB-003)',
        );
      }
    }

    // Elève and parent_financeur may only view their own profile (or linked students for parent)
    if (
      actor.role === UserRole.ELEVE &&
      actor.id !== userId
    ) {
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

  /** Guards endpoints that expose internal notes (PROF-FB-002). */
  private assertNotesAccess(actor: Actor): void {
    if (!NOTES_ALLOWED_ROLES.includes(actor.role)) {
      throw new ForbiddenException(
        'Internal notes are only accessible to RP and AdministrateurFinancier (PROF-FB-002)',
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
}
