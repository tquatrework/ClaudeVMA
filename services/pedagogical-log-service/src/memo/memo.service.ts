import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { MemoChapter } from './entities/memo-chapter.entity';
import { MemoItem } from './entities/memo-item.entity';
import { CreateMemoChapterDto } from './dto/create-memo-chapter.dto';
import { CreateMemoItemDto, IMAGE_SIZE_LIMIT_KB } from './dto/create-memo-item.dto';

/**
 * MemoService — outil mémo EXCLUSIVEMENT réservé à l'élève.
 *
 * CRITIQUE XML spec: "Seul l'élève peut écrire dans son mémo."
 * Un formateur tente d'écrire → ForbiddenException.
 * XML spec functionality 004, 005.
 */
@Injectable()
export class MemoService {
  constructor(
    @InjectRepository(MemoChapter)
    private readonly memoChapterRepository: Repository<MemoChapter>,
    @InjectRepository(MemoItem)
    private readonly memoItemRepository: Repository<MemoItem>,
  ) {}

  /**
   * Créer un chapitre de mémo — ÉLÈVE UNIQUEMENT.
   * XML spec: "chapitres libres créés par l'élève".
   */
  async createChapter(
    studentId: string,
    dto: CreateMemoChapterDto,
    callerId: string,
    callerRole: string,
  ): Promise<MemoChapter> {
    this.assertIsEleve(callerId, studentId, callerRole);
    const chapter = this.memoChapterRepository.create({
      studentId,
      title: dto.title,
      order: dto.order ?? 0,
    });
    return this.memoChapterRepository.save(chapter);
  }

  /**
   * Lister les chapitres et items du mémo — ÉLÈVE UNIQUEMENT.
   * XML spec: "GET /memos — liste des chapitres + items de l'élève courant (élève uniquement)".
   */
  async findChapters(studentId: string, callerId: string, callerRole: string): Promise<MemoChapter[]> {
    this.assertIsEleve(callerId, studentId, callerRole);
    return this.memoChapterRepository.find({
      where: { studentId },
      relations: ['items'],
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Ajouter un item dans un chapitre — ÉLÈVE UNIQUEMENT.
   * XML spec functionality 004: listes d'items courts, formules mathématiques et images limitées.
   */
  async createItem(
    chapterId: string,
    dto: CreateMemoItemDto,
    callerId: string,
    callerRole: string,
  ): Promise<MemoItem> {
    const chapter = await this.memoChapterRepository.findOne({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException(`Chapitre de mémo ${chapterId} introuvable`);

    this.assertIsEleve(callerId, chapter.studentId, callerRole);

    if (dto.type === 'image' && dto.sizeKb !== undefined && dto.sizeKb > IMAGE_SIZE_LIMIT_KB) {
      throw new BadRequestException(
        `La taille de l'image dépasse la limite autorisée (${IMAGE_SIZE_LIMIT_KB} Ko)`,
      );
    }

    const item = this.memoItemRepository.create({
      chapterId,
      type: dto.type,
      content: dto.content,
      sizeKb: dto.sizeKb,
      order: dto.order ?? 0,
    });
    return this.memoItemRepository.save(item);
  }

  /**
   * Recherche textuelle dans les items du mémo — ÉLÈVE UNIQUEMENT.
   * XML spec functionality 005: "Recherche dans le memo".
   */
  async search(
    studentId: string,
    query: string,
    callerId: string,
    callerRole: string,
  ): Promise<MemoItem[]> {
    this.assertIsEleve(callerId, studentId, callerRole);

    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Le paramètre de recherche q ne peut pas être vide');
    }

    // Récupérer les chapitres de l'élève pour filtrer par studentId
    const chapters = await this.memoChapterRepository.find({ where: { studentId } });
    if (chapters.length === 0) return [];

    const chapterIds = chapters.map((chapter) => chapter.id);

    // Recherche textuelle sur le contenu des items
    const allItems = await this.memoItemRepository.find({
      where: chapterIds.map((chapterId) => ({
        chapterId,
        content: Like(`%${query.trim()}%`),
      })),
      relations: ['chapter'],
      order: { createdAt: 'DESC' },
    });

    return allItems;
  }

  /**
   * Vérifie que l'appelant est l'élève propriétaire.
   * CRITIQUE: seul le rôle 'eleve' peut écrire dans le mémo — 403 pour tout autre rôle.
   */
  private assertIsEleve(callerId: string, studentId: string, callerRole: string): void {
    if (callerRole !== 'eleve') {
      throw new ForbiddenException(
        'Le mémo est réservé à l\'élève uniquement — aucun autre rôle ne peut y écrire (XML spec)',
      );
    }
    if (callerId !== studentId) {
      throw new ForbiddenException(
        'Vous ne pouvez accéder qu\'à votre propre mémo',
      );
    }
  }
}
