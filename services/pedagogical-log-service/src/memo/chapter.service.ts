import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from './entities/chapter.entity';
import { Memo } from './entities/memo.entity';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

/**
 * Rôles autorisés à lire un chapitre en dehors du propriétaire.
 * Ces rôles n'ont AUCUN droit d'écriture (PLOG-BR-003).
 */
const READ_ONLY_ROLES_FOR_CHAPTER = [
  'formateur',
  'responsable_pedagogique',
  'animateur_pedagogique',
];

@Injectable()
export class ChapterService {
  constructor(
    @InjectRepository(Chapter)
    private readonly chapterRepository: Repository<Chapter>,
    @InjectRepository(Memo)
    private readonly memoRepository: Repository<Memo>,
  ) {}

  /**
   * Lister les chapitres de l'élève connecté.
   * Seul l'élève voit ses propres chapitres (filtre studentId = userId JWT).
   */
  findByStudent(studentId: string): Promise<Chapter[]> {
    return this.chapterRepository.find({
      where: { studentId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Créer un chapitre pour l'élève connecté.
   * Seul l'élève peut créer ses chapitres (PLOG-BR-003).
   */
  create(dto: CreateChapterDto, studentId: string): Promise<Chapter> {
    const newChapter = this.chapterRepository.create({ ...dto, studentId });
    return this.chapterRepository.save(newChapter);
  }

  /**
   * Lire un chapitre par ID avec ses mémos.
   * - L'élève propriétaire peut toujours accéder.
   * - Les formateurs liés, RP et AP peuvent lire en lecture seule.
   * - Le parent financeur et les autres rôles sont refusés.
   */
  async findOne(
    chapterId: string,
    callerId: string,
    callerRole: string,
  ): Promise<Chapter & { memos: Memo[] }> {
    const chapter = await this.chapterRepository.findOne({ where: { id: chapterId } });
    if (!chapter) {
      throw new NotFoundException(`Chapter ${chapterId} not found`);
    }

    const isOwner = chapter.studentId === callerId;
    const hasReadOnlyAccess = READ_ONLY_ROLES_FOR_CHAPTER.includes(callerRole);

    if (!isOwner && !hasReadOnlyAccess) {
      throw new ForbiddenException('Access to this chapter is not allowed');
    }

    const memoList = await this.memoRepository.find({
      where: { chapterId },
      order: { createdAt: 'DESC' },
    });

    return { ...chapter, memos: memoList };
  }

  /**
   * Renommer un chapitre.
   * Seul l'élève propriétaire peut renommer (PLOG-BR-003).
   */
  async update(
    chapterId: string,
    dto: UpdateChapterDto,
    callerId: string,
  ): Promise<Chapter> {
    const chapter = await this.chapterRepository.findOne({ where: { id: chapterId } });
    if (!chapter) {
      throw new NotFoundException(`Chapter ${chapterId} not found`);
    }

    if (chapter.studentId !== callerId) {
      throw new ForbiddenException('Only the student owner can rename this chapter');
    }

    chapter.title = dto.title;
    return this.chapterRepository.save(chapter);
  }

  /**
   * Supprimer un chapitre.
   * Les mémos associés passent à chapterId = null (comportement géré par onDelete: 'SET NULL' sur la FK).
   * Seul l'élève propriétaire peut supprimer (PLOG-BR-003).
   */
  async remove(chapterId: string, callerId: string): Promise<void> {
    const chapter = await this.chapterRepository.findOne({ where: { id: chapterId } });
    if (!chapter) {
      throw new NotFoundException(`Chapter ${chapterId} not found`);
    }

    if (chapter.studentId !== callerId) {
      throw new ForbiddenException('Only the student owner can delete this chapter');
    }

    await this.chapterRepository.remove(chapter);
  }
}
