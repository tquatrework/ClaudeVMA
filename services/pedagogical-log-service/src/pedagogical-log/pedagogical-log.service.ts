import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PedagogicalLog, LogVisibility } from './entities/pedagogical-log.entity';
import { CreateLogDto } from './dto/create-log.dto';
import { CreateSpecialPageDto } from './dto/create-special-page.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { ProfileRelationsClient } from '../common/clients/profile-relations.client';

/**
 * Visibilités accessibles selon le rôle du demandeur (PLOG-RA-001 à PLOG-RA-004).
 *
 * - Formateur / RP / AP / TI : accès large (lecture complète, coordination)
 * - Eleve               : voit uniquement eleve_parent_formateur
 *                         MAIS jamais les pages hiddenFromStudent=true (filtré en service)
 * - Parent financeur    : voit eleve_parent_formateur et parent_formateur
 *                         + les pages spéciales qui leur sont destinées (special) si hiddenFromStudent=false
 *
 * Refonte du 2026-08-20 : `parent_formateur` remplace `eleve_formateur`. La 2e
 * catégorie exclut désormais l'élève (retiré de la liste `eleve`) et inclut le
 * parent (ajouté à la liste `parent_financeur`) — c'était l'inverse jusqu'ici,
 * corrigé sur demande explicite de l'utilisateur.
 */
const VISIBILITY_BY_ROLE: Record<string, LogVisibility[]> = {
  formateur: ['eleve_parent_formateur', 'parent_formateur', 'formateur_rp', 'special'],
  responsable_pedagogique: ['eleve_parent_formateur', 'parent_formateur', 'formateur_rp', 'special'],
  animateur_pedagogique: ['eleve_parent_formateur', 'parent_formateur', 'formateur_rp', 'special'],
  technicien_informatique: ['eleve_parent_formateur', 'parent_formateur', 'formateur_rp', 'special'],
  eleve: ['eleve_parent_formateur'],
  parent_financeur: ['eleve_parent_formateur', 'parent_formateur', 'special'],
};

export interface FindByStudentRange {
  from?: string;
  to?: string;
}

@Injectable()
export class PedagogicalLogService {
  constructor(
    @InjectRepository(PedagogicalLog)
    private readonly pedagogicalLogRepository: Repository<PedagogicalLog>,
    private readonly profileRelationsClient: ProfileRelationsClient,
  ) {}

  /**
   * Create a new textbook entry.
   *
   * Refonte du 2026-08-20 (point 3 — écriture réservée au formateur) :
   * - Seul un FORMATEUR peut créer une entrée normale. Le RP ne le peut plus
   *   (retiré des rôles autorisés côté contrôleur) ; le mécanisme des pages
   *   spéciales RP (createSpecialPage) est distinct et non affecté.
   * - Le formateur doit être titulaire de la relation TEACHER_OF_STUDENT avec
   *   l'élève ciblé, vérifiée à chaque appel auprès de profile-service (jamais
   *   en cache — même politique que teacher-request-service/calendar-service).
   *
   * Refonte du 2026-08-20 (point 4 — correctif du bug studentId) :
   * `studentId` est désormais un paramètre explicite, dérivé du paramètre de
   * chemin par le contrôleur. Il n'est plus jamais redemandé dans le corps.
   */
  async create(
    studentId: string,
    dto: CreateLogDto,
    authorId: string,
    authorRole: string,
  ): Promise<PedagogicalLog> {
    if (authorRole !== UserRole.FORMATEUR) {
      throw new ForbiddenException(
        'Seul le formateur titulaire peut écrire dans le cahier de texte de cet élève',
      );
    }

    await this.profileRelationsClient.assertTeacherOfStudent(authorId, studentId);

    const entry = this.pedagogicalLogRepository.create({
      studentId,
      date: dto.date,
      sessionSummary: dto.sessionSummary,
      homework: dto.homework,
      visibility: dto.visibility ?? 'eleve_parent_formateur',
      isSpecialPage: false,
      hiddenFromStudent: dto.hiddenFromStudent ?? false,
      linkedResources: dto.linkedResources,
      activityId: dto.activityId,
      sessionId: dto.sessionId,
      skillsWorked: dto.skillsWorked,
      difficulty: dto.difficulty,
      rating: dto.rating,
      authorId,
      authorRole,
    });
    return this.pedagogicalLogRepository.save(entry);
  }

  /**
   * Create a special page (RP only).
   * XML spec functionality 003: pages spéciales parent/financeur non visibles par l'élève si choisies.
   * Mécanisme hors périmètre de la refonte du 2026-08-20 — inchangé.
   */
  createSpecialPage(
    studentId: string,
    dto: CreateSpecialPageDto,
    authorId: string,
    authorRole: string,
  ): Promise<PedagogicalLog> {
    const entry = this.pedagogicalLogRepository.create({
      studentId,
      content: dto.content,
      hiddenFromStudent: dto.hiddenFromStudent ?? false,
      linkedResources: dto.linkedResources,
      sessionId: dto.sessionId,
      authorId,
      authorRole,
      visibility: 'special',
      isSpecialPage: true,
    });
    return this.pedagogicalLogRepository.save(entry);
  }

  /**
   * Get all textbook entries for a student, filtered by caller role.
   * - Elève: visibilité autorisée + hiddenFromStudent=false uniquement
   * - Parent financeur: eleve_parent_formateur + parent_formateur + special (non cachées)
   * - RP/Formateur/TI/AP: tout
   *
   * Tri du plus récent au plus ancien par `date` (date de séance), les entrées
   * sans date passant en dernier, puis par `createdAt` à égalité — refonte du
   * 2026-08-20, point complémentaire sur le tri de la liste.
   *
   * `range.from` / `range.to` filtrent optionnellement sur `date` (ISO 8601),
   * pour permettre au front de se repositionner dans la liste.
   */
  async findByStudent(
    studentId: string,
    callerRole: string,
    range?: FindByStudentRange,
  ): Promise<PedagogicalLog[]> {
    const allowedVisibilities = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];

    const qb = this.pedagogicalLogRepository
      .createQueryBuilder('entry')
      .where('entry.studentId = :studentId', { studentId })
      .andWhere('entry.visibility IN (:...visibilities)', { visibilities: allowedVisibilities });

    if (range?.from) {
      qb.andWhere('entry.date >= :from', { from: range.from });
    }
    if (range?.to) {
      qb.andWhere('entry.date <= :to', { to: range.to });
    }

    qb.orderBy('entry.date', 'DESC', 'NULLS LAST').addOrderBy('entry.createdAt', 'DESC');

    const allEntries = await qb.getMany();

    if (callerRole === 'eleve') {
      // L'élève ne voit jamais les pages marquées hiddenFromStudent=true
      return allEntries.filter((entry) => !entry.hiddenFromStudent);
    }

    return allEntries;
  }

  /**
   * Get all textbook entries for a session, filtered by caller role.
   */
  async findBySession(sessionId: string, callerRole: string): Promise<PedagogicalLog[]> {
    const allowedVisibilities = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];

    const allEntries = await this.pedagogicalLogRepository.find({
      where: { sessionId, visibility: In(allowedVisibilities) },
      order: { createdAt: 'DESC' },
    });

    if (callerRole === 'eleve') {
      return allEntries.filter((entry) => !entry.hiddenFromStudent);
    }

    return allEntries;
  }

  /**
   * Get a single textbook entry by ID, filtered by caller role.
   * XML spec func 003: pages hiddenFromStudent=true lancent ForbiddenException pour l'élève.
   */
  async findOne(id: string, callerRole: string): Promise<PedagogicalLog> {
    const entry = await this.pedagogicalLogRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Log ${id} not found`);

    const allowedVisibilities = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];
    if (!allowedVisibilities.includes(entry.visibility)) {
      throw new ForbiddenException('Access to this log entry is not allowed for your role');
    }

    // L'élève ne voit jamais les pages hiddenFromStudent=true
    if (callerRole === 'eleve' && entry.hiddenFromStudent) {
      throw new ForbiddenException('Cette page est masquée à l\'élève');
    }

    return entry;
  }

  /**
   * Modifier une entrée de cahier de texte.
   *
   * Refonte du 2026-08-20 (point 3) : deux régimes distincts, discriminés par
   * `isSpecialPage` —
   * - page spéciale RP (isSpecialPage=true) : mécanisme hors périmètre, comportement
   *   INCHANGÉ (auteur ou RP/TI peut modifier).
   * - entrée normale (isSpecialPage=false) : seul le formateur auteur peut modifier,
   *   et seulement s'il est toujours titulaire de la relation avec l'élève (vérifiée
   *   à chaque action, jamais en cache). Le RP/TI ne peuvent plus modifier une entrée
   *   normale — ils restent en lecture seule, comme l'élève et le parent.
   */
  async update(
    id: string,
    dto: UpdateLogDto,
    callerId: string,
    callerRole: string,
  ): Promise<PedagogicalLog> {
    const entry = await this.pedagogicalLogRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Log ${id} not found`);

    if (entry.isSpecialPage) {
      const canEdit =
        entry.authorId === callerId ||
        callerRole === UserRole.RESPONSABLE_PEDAGOGIQUE ||
        callerRole === UserRole.TECHNICIEN_INFORMATIQUE;

      if (!canEdit) {
        throw new ForbiddenException('Only the author or a RP/TI can update this page');
      }
    } else {
      if (callerRole !== UserRole.FORMATEUR || entry.authorId !== callerId) {
        throw new ForbiddenException(
          'Seul le formateur auteur peut modifier cette entrée du cahier de texte',
        );
      }
      await this.profileRelationsClient.assertTeacherOfStudent(entry.authorId, entry.studentId);
    }

    Object.assign(entry, dto);
    return this.pedagogicalLogRepository.save(entry);
  }

  /**
   * Supprimer une entrée de cahier de texte.
   * Seul l'auteur ou un RP peut supprimer.
   * Inchangé par la refonte du 2026-08-20 (hors périmètre explicite : seuls
   * POST/PATCH sont mentionnés par la demande).
   */
  async remove(id: string, callerId: string, callerRole: string): Promise<void> {
    const entry = await this.pedagogicalLogRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Log ${id} not found`);

    const canDelete =
      entry.authorId === callerId ||
      callerRole === 'responsable_pedagogique';

    if (!canDelete) {
      throw new ForbiddenException('Only the author or a RP can delete this entry');
    }

    await this.pedagogicalLogRepository.remove(entry);
  }
}
