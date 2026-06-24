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

/**
 * Visibilités accessibles selon le rôle du demandeur (PLOG-RA-001 à PLOG-RA-004).
 *
 * - Formateur / RP / AP : accès large (ils écrivent et coordonnent)
 * - Eleve               : voit eleve_parent_formateur et eleve_formateur
 *                         MAIS jamais les pages hiddenFromStudent=true (filtré en service)
 * - Parent financeur    : voit eleve_parent_formateur uniquement
 *                         + les pages spéciales qui leur sont destinées (special) si hiddenFromStudent=false
 */
const VISIBILITY_BY_ROLE: Record<string, LogVisibility[]> = {
  formateur: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
  responsable_pedagogique: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
  animateur_pedagogique: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
  technicien_informatique: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
  eleve: ['eleve_parent_formateur', 'eleve_formateur'],
  parent_financeur: ['eleve_parent_formateur', 'special'],
};

@Injectable()
export class PedagogicalLogService {
  constructor(
    @InjectRepository(PedagogicalLog)
    private readonly pedagogicalLogRepository: Repository<PedagogicalLog>,
  ) {}

  /**
   * Create a new textbook entry.
   * Formateur and RP can write; isSpecialPage defaults to false.
   */
  create(dto: CreateLogDto, authorId: string, authorRole: string): Promise<PedagogicalLog> {
    const entry = this.pedagogicalLogRepository.create({
      ...dto,
      authorId,
      authorRole,
      visibility: dto.visibility ?? 'eleve_parent_formateur',
      isSpecialPage: false,
      hiddenFromStudent: dto.hiddenFromStudent ?? false,
    });
    return this.pedagogicalLogRepository.save(entry);
  }

  /**
   * Create a special page (RP only).
   * XML spec functionality 003: pages spéciales parent/financeur non visibles par l'élève si choisies.
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
   * - Parent financeur: pages special visibles + eleve_parent_formateur (sauf hiddenFromStudent si l'élève n'en est pas destinataire — le parent voit les pages special qui lui sont destinées)
   * - RP/Formateur/TI/AP: tout
   */
  async findByStudent(studentId: string, callerRole: string): Promise<PedagogicalLog[]> {
    const allowedVisibilities = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];

    const allEntries = await this.pedagogicalLogRepository.find({
      where: { studentId, visibility: In(allowedVisibilities) },
      order: { createdAt: 'DESC' },
    });

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
   * Seul l'auteur original ou un RP/TI peut modifier.
   */
  async update(
    id: string,
    dto: UpdateLogDto,
    callerId: string,
    callerRole: string,
  ): Promise<PedagogicalLog> {
    const entry = await this.pedagogicalLogRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Log ${id} not found`);

    const canEdit =
      entry.authorId === callerId ||
      callerRole === 'responsable_pedagogique' ||
      callerRole === 'technicien_informatique';

    if (!canEdit) {
      throw new ForbiddenException('Only the author or a RP/TI can update this entry');
    }

    Object.assign(entry, dto);
    return this.pedagogicalLogRepository.save(entry);
  }

  /**
   * Supprimer une entrée de cahier de texte.
   * Seul l'auteur ou un RP peut supprimer.
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
