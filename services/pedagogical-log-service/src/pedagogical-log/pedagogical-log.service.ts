import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PedagogicalLog, LogVisibility } from './entities/pedagogical-log.entity';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';

/**
 * Visibilities accessible to each role (PLOG-RA-001 to PLOG-RA-004).
 *
 * - Formateur / RP : can see everything (they write and coordinate)
 * - Eleve          : can see eleve_parent_formateur and eleve_formateur (not formateur_rp special pages)
 * - Parent         : can see eleve_parent_formateur only (PLOG-BR-005 / PLOG-FB-001)
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
   * Create a new textbook entry.
   * PLOG-FB-003: only formateur or RP can write. The caller must be the authorId.
   */
  create(dto: CreateLogDto, authorId: string, authorRole: string): Promise<PedagogicalLog> {
    const entry = this.pedagogicalLogRepository.create({
      ...dto,
      authorId,
      authorRole,
      visibility: dto.visibility ?? 'eleve_parent_formateur',
    });
    return this.pedagogicalLogRepository.save(entry);
  }

  /**
   * Get all textbook entries for a student, filtered by caller role.
   * PLOG-BR-001, PLOG-BR-002, PLOG-RA-001, PLOG-RA-002.
   */
  findByStudent(studentId: string, callerRole: string): Promise<PedagogicalLog[]> {
    const allowed = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];
    return this.pedagogicalLogRepository.find({
      where: { studentId, visibility: In(allowed) },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all textbook entries for a session.
   * Visibility is filtered by caller role.
   */
  findBySession(sessionId: string, callerRole: string): Promise<PedagogicalLog[]> {
    const allowed = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];
    return this.pedagogicalLogRepository.find({
      where: { sessionId, visibility: In(allowed) },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single textbook entry by ID, filtered by caller role.
   */
  async findOne(id: string, callerRole: string): Promise<PedagogicalLog> {
    const entry = await this.pedagogicalLogRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Log ${id} not found`);

    const allowed = VISIBILITY_BY_ROLE[callerRole] ?? ['eleve_parent_formateur'];
    if (!allowed.includes(entry.visibility)) {
      throw new ForbiddenException('Access to this log entry is not allowed for your role');
    }
    return entry;
  }

  /**
   * Update a textbook entry.
   * Only the original author or a RP/TI can update.
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
}
