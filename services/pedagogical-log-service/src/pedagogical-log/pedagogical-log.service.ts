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
 * Visibilités accessibles selon le rôle (PLOG-RA-001 à PLOG-RA-004).
 *
 * - Formateur / RP / AP / TI : peut tout voir (ils écrivent et coordonnent)
 * - Eleve                    : voit eleve_parent_formateur et eleve_formateur
 *                              (pas les pages formateur_rp ni les pages spéciales)
 * - Parent                   : voit uniquement eleve_parent_formateur (PLOG-BR-005 / PLOG-FB-001)
 */
const VISIBILITY_BY_ROLE: Record<string, LogVisibility[]> = {
  formateur: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
  responsable_pedagogique: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
  animateur_pedagogique: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
  technicien_informatique: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
  eleve: ['eleve_parent_formateur', 'eleve_formateur'],
  parent_financeur: ['eleve_parent_formateur'],
};

@Injectable()
export class PedagogicalLogService {
  constructor(
    @InjectRepository(PedagogicalLog)
    private readonly pedagogicalLogRepository: Repository<PedagogicalLog>,
  ) {}

  /**
   * Créer une nouvelle entrée de cahier de texte.
   * PLOG-FB-003: seuls formateur et RP peuvent écrire.
   */
  create(dto: CreateLogDto, authorId: string, authorRole: string): Promise<PedagogicalLog> {
    const entry = this.pedagogicalLogRepository.create({
      ...dto,
      authorId,
      authorRole,
      visibility: dto.visibility ?? 'eleve_parent_formateur',
      isSpecialPage: false,
      hiddenFromStudent: false,
    });
    return this.pedagogicalLogRepository.save(entry);
  }

  /**
   * Créer une page spéciale (RP uniquement).
   * XML spec functionality 003: pages spéciales pouvant être invisibles à l'élève.
   */
  createSpecialPage(
    studentId: string,
    dto: CreateSpecialPageDto,
    authorId: string,
    authorRole: string,
  ): Promise<PedagogicalLog> {
    const entry = this.pedagogicalLogRepository.create({
      ...dto,
      studentId,
      authorId,
      authorRole,
      visibility: 'special',
      isSpecialPage: true,
      hiddenFromStudent: dto.hiddenFromStudent ?? false,
    });
    return this.pedagogicalLogRepository.save(entry);
  }

  /**
   * Lister toutes les entrées de cahier de texte, filtrées par rôle appelant.
   * PLOG-RA-001, PLOG-RA-002, PLOG-BR-006.
   * XML spec func 003: pages hiddenFromStudent=true invisibles à l'élève.
   */
  async findAll(callerRole: string): Promise<PedagogicalLog[]> {
    const allowedVisibilities = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];
    const entries = await this.pedagogicalLogRepository.find({
      where: { visibility: In(allowedVisibilities) },
      order: { createdAt: 'DESC' },
    });

    if (callerRole === 'eleve') {
      return entries.filter((entry) => !entry.hiddenFromStudent);
    }
    return entries;
  }

  /**
   * Obtenir toutes les entrées de cahier de texte pour un élève, filtrées par rôle appelant.
   * PLOG-BR-001, PLOG-BR-002, PLOG-RA-001, PLOG-RA-002.
   * XML spec func 003: pages hiddenFromStudent=true invisibles à l'élève.
   */
  async findByStudent(studentId: string, callerRole: string): Promise<PedagogicalLog[]> {
    const allowedVisibilities = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];
    const entries = await this.pedagogicalLogRepository.find({
      where: { studentId, visibility: In(allowedVisibilities) },
      order: { createdAt: 'DESC' },
    });

    if (callerRole === 'eleve') {
      return entries.filter((entry) => !entry.hiddenFromStudent);
    }
    return entries;
  }

  /**
   * Obtenir toutes les entrées de cahier de texte pour une séance.
   * La visibilité est filtrée par rôle appelant.
   */
  findBySession(sessionId: string, callerRole: string): Promise<PedagogicalLog[]> {
    const allowedVisibilities = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];
    return this.pedagogicalLogRepository.find({
      where: { sessionId, visibility: In(allowedVisibilities) },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Obtenir une seule entrée par ID, filtrée par rôle appelant.
   * XML spec func 003: pages hiddenFromStudent=true lancent ForbiddenException pour l'élève.
   */
  async findOne(id: string, callerRole: string): Promise<PedagogicalLog> {
    const entry = await this.pedagogicalLogRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Log ${id} not found`);

    const allowedVisibilities = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];
    if (!allowedVisibilities.includes(entry.visibility)) {
      throw new ForbiddenException('Access to this log entry is not allowed for your role');
    }

    if (callerRole === 'eleve' && entry.hiddenFromStudent) {
      throw new ForbiddenException('This log entry is hidden from the student');
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
