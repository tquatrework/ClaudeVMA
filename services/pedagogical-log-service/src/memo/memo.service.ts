import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { MemoChapter } from './entities/memo-chapter.entity';
import { MemoItem } from './entities/memo-item.entity';
import { CreateMemoChapterDto } from './dto/create-memo-chapter.dto';
import { UpdateMemoChapterDto } from './dto/update-memo-chapter.dto';
import { CreateMemoItemDto } from './dto/create-memo-item.dto';
import { UpdateMemoItemDto } from './dto/update-memo-item.dto';
import { CreateMemoImageItemDto } from './dto/create-memo-image-item.dto';
import { MemoImageStorageService } from './memo-image-storage.service';
import { ProfileRelationsClient } from '../common/clients/profile-relations.client';
import {
  MEMO_MAX_CHAPTERS_PER_STUDENT,
  MEMO_MAX_ITEMS_PER_CHAPTER,
  MEMO_IMAGE_MAX_BYTES,
  MEMO_ACCEPTED_IMAGE_MIME_TYPES,
} from './memo.constants';
import {
  detectAttachmentMimeType,
  SVG_MIME_TYPE,
} from '../attachments/attachment-mime-detector';

/**
 * Nature des relations `profile-service` ouvrant un droit de LECTURE sur le
 * mémo d'un élève (voir `assertCanRead`) — jamais un droit d'écriture, qui
 * reste réservé au titulaire élève (`assertIsEleve`). Valeurs de `kind`
 * documentées dans docs/routes.md > profile-service (2026-08-11/12).
 */
const READ_ONLY_RELATION_KINDS = [
  'teacher_of_student',
  'coordinator_of_student',
  'finance_owner_of_student',
];

export interface MemoImageDownload {
  item: MemoItem;
  buffer: Buffer;
}

/**
 * MemoService — outil de mémo de l'élève (formules, trucs essentiels).
 *
 * Écriture (chapitres et items) : réservée au titulaire élève
 * (`assertIsEleve`), CRITIQUE XML spec: "Seul l'élève peut écrire dans son
 * mémo." Un formateur/RP/AP/parent qui tente d'écrire → 403.
 *
 * Lecture : titulaire élève, ou tiers relié (formateur, RP/AP coordinateur,
 * parent financeur) via `assertCanRead` — vérifié à chaque appel auprès de
 * `profile-service`, jamais en cache (même politique que
 * `pedagogical-log.service.ts`). Chantier feat/memo-formules, B5/B6.
 */
@Injectable()
export class MemoService {
  constructor(
    @InjectRepository(MemoChapter)
    private readonly memoChapterRepository: Repository<MemoChapter>,
    @InjectRepository(MemoItem)
    private readonly memoItemRepository: Repository<MemoItem>,
    private readonly profileRelationsClient: ProfileRelationsClient,
    private readonly imageStorage: MemoImageStorageService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────
  // Autorisations
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Vérifie que l'appelant est l'élève propriétaire — seul habilité à écrire
   * dans le mémo (création, modification, suppression de chapitres et
   * d'items). CRITIQUE: seul le rôle 'eleve' peut écrire — 403 pour tout
   * autre rôle, y compris un autre élève que le propriétaire.
   */
  private assertIsEleve(callerId: string, studentId: string, callerRole: string): void {
    if (callerRole !== 'eleve') {
      throw new ForbiddenException(
        "Le mémo est réservé à l'élève uniquement — aucun autre rôle ne peut y écrire (XML spec)",
      );
    }
    if (callerId !== studentId) {
      throw new ForbiddenException('Vous ne pouvez accéder qu\'à votre propre mémo');
    }
  }

  /**
   * Vérifie le droit de LECTURE sur le mémo d'un élève : le titulaire est
   * toujours autorisé ; sinon, un tiers relié (formateur, RP/AP
   * coordinateur, parent financeur) ou un administrateur (RP/AF/TI) l'est
   * aussi — vérifié à chaque appel auprès de `profile-service`
   * (`GET /internal/relations/:viewerId/:targetId?viewerRole=`), jamais en
   * cache. `profile-service` injoignable → 503 (échec fermé, levé par
   * `ProfileRelationsClient.getRelation`) ; relation absente → 403.
   */
  async assertCanRead(callerId: string, callerRole: string, studentId: string): Promise<void> {
    if (callerId === studentId) return;

    const result = await this.profileRelationsClient.getRelation(callerId, studentId, callerRole);
    if (result.isAdministrator) return;

    const hasReadAccess = result.relations.some((relation) =>
      READ_ONLY_RELATION_KINDS.includes(relation.kind),
    );
    if (!hasReadAccess) {
      throw new ForbiddenException("Vous n'avez pas accès au mémo de cet élève");
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Chapitres
  // ───────────────────────────────────────────────────────────────────────

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

    const chapterCount = await this.memoChapterRepository.count({ where: { studentId } });
    if (chapterCount >= MEMO_MAX_CHAPTERS_PER_STUDENT) {
      throw new BadRequestException(
        `Nombre maximal de chapitres atteint (${MEMO_MAX_CHAPTERS_PER_STUDENT})`,
      );
    }

    const chapter = this.memoChapterRepository.create({
      studentId,
      title: dto.title,
      order: dto.order ?? 0,
    });
    return this.memoChapterRepository.save(chapter);
  }

  /**
   * Lister les chapitres et items du mémo — titulaire élève, via `GET /memos`.
   * Route hardcodée sur `studentId = callerId` côté contrôleur, réservée au
   * rôle élève (`@Roles(UserRole.ELEVE)`) : `assertCanRead` y est
   * équivalente à l'ancien `assertIsEleve` (la branche "tiers relié" n'est
   * jamais atteinte ici), mais uniformise le mécanisme d'autorisation de
   * lecture avec `findOneChapter`/`findStudentMemo` (B5).
   */
  async findChapters(studentId: string, callerId: string, callerRole: string): Promise<MemoChapter[]> {
    await this.assertCanRead(callerId, callerRole, studentId);
    return this.memoChapterRepository.find({
      where: { studentId },
      relations: ['items'],
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Détail d'un chapitre et ses items — titulaire élève, ou tiers relié en
   * lecture (formateur, RP/AP coordinateur, parent financeur).
   */
  async findOneChapter(
    chapterId: string,
    callerId: string,
    callerRole: string,
  ): Promise<MemoChapter> {
    const chapter = await this.memoChapterRepository.findOne({
      where: { id: chapterId },
      relations: ['items'],
    });
    if (!chapter) throw new NotFoundException(`Chapitre de mémo ${chapterId} introuvable`);

    await this.assertCanRead(callerId, callerRole, chapter.studentId);

    chapter.items = (chapter.items ?? []).sort((a, b) => a.order - b.order);
    return chapter;
  }

  /**
   * Renommer un chapitre — ÉLÈVE PROPRIÉTAIRE UNIQUEMENT.
   */
  async updateChapter(
    chapterId: string,
    dto: UpdateMemoChapterDto,
    callerId: string,
    callerRole: string,
  ): Promise<MemoChapter> {
    const chapter = await this.memoChapterRepository.findOne({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException(`Chapitre de mémo ${chapterId} introuvable`);

    this.assertIsEleve(callerId, chapter.studentId, callerRole);

    if (dto.title !== undefined) chapter.title = dto.title;
    if (dto.order !== undefined) chapter.order = dto.order;
    return this.memoChapterRepository.save(chapter);
  }

  /**
   * Supprimer un chapitre — ÉLÈVE PROPRIÉTAIRE UNIQUEMENT. Les items sont
   * supprimés en cascade (FK `onDelete: CASCADE`) ; les fichiers image
   * associés sont supprimés explicitement avant la suppression du chapitre
   * — la cascade ne nettoie que les lignes en base, jamais les octets sur le
   * volume (même limite déjà documentée pour `PedagogicalLogAttachment`).
   */
  async removeChapter(chapterId: string, callerId: string, callerRole: string): Promise<void> {
    const chapter = await this.memoChapterRepository.findOne({
      where: { id: chapterId },
      relations: ['items'],
    });
    if (!chapter) throw new NotFoundException(`Chapitre de mémo ${chapterId} introuvable`);

    this.assertIsEleve(callerId, chapter.studentId, callerRole);

    for (const item of chapter.items ?? []) {
      if (item.type === 'image' && item.imageStoredFilename) {
        await this.imageStorage.delete(item.imageStoredFilename);
      }
    }

    await this.memoChapterRepository.remove(chapter);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Items — texte / formule
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Ajouter un item texte ou formule dans un chapitre — ÉLÈVE UNIQUEMENT.
   * Pour une image, voir `createImageItem`.
   */
  async createItem(
    chapterId: string,
    dto: CreateMemoItemDto,
    callerId: string,
    callerRole: string,
  ): Promise<MemoItem> {
    const chapter = await this.getChapterForWrite(chapterId, callerId, callerRole);
    await this.assertItemBudget(chapterId);

    const item = this.memoItemRepository.create({
      chapterId: chapter.id,
      type: dto.type,
      content: dto.content,
      order: dto.order ?? 0,
    });
    return this.memoItemRepository.save(item);
  }

  /**
   * Ajouter un item image dans un chapitre — ÉLÈVE UNIQUEMENT. Multipart,
   * champ `file`, un seul fichier. Type détecté sur les octets réels (jamais
   * l'extension ni le `Content-Type` client), liste blanche
   * JPEG/PNG/WebP/GIF, SVG explicitement refusé. Plafond de taille
   * `MEMO_IMAGE_MAX_BYTES` (voir memo.constants.ts) — vérifié après lecture
   * complète du fichier par multer, même limite documentée que pour les
   * pièces jointes du cahier de texte.
   */
  async createImageItem(
    chapterId: string,
    file: Express.Multer.File | undefined,
    dto: CreateMemoImageItemDto,
    callerId: string,
    callerRole: string,
  ): Promise<MemoItem> {
    const chapter = await this.getChapterForWrite(chapterId, callerId, callerRole);

    if (!file) {
      throw new BadRequestException('Aucun fichier envoyé');
    }

    if (file.size > MEMO_IMAGE_MAX_BYTES) {
      throw new PayloadTooLargeException({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: 'Uploaded image exceeds the maximum allowed size',
        maxUploadBytes: MEMO_IMAGE_MAX_BYTES,
        receivedBytes: file.size,
      });
    }

    await this.assertItemBudget(chapterId);

    const mimeType = await detectAttachmentMimeType(file.buffer);
    if (mimeType === SVG_MIME_TYPE) {
      throw new BadRequestException(
        'Les fichiers SVG ne sont pas acceptés (document XML exécutable)',
      );
    }
    if (!mimeType || !(MEMO_ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new BadRequestException(
        'Format d\'image non reconnu ou non autorisé (JPEG, PNG, WebP, GIF uniquement)',
      );
    }

    const storedFilename = await this.imageStorage.save(file.buffer);

    const item = this.memoItemRepository.create({
      chapterId: chapter.id,
      type: 'image',
      content: dto.caption ?? null,
      imageOriginalFilename: file.originalname,
      imageStoredFilename: storedFilename,
      imageMimeType: mimeType,
      imageSizeBytes: file.size,
      order: dto.order !== undefined ? Number(dto.order) : 0,
    });
    return this.memoItemRepository.save(item);
  }

  /**
   * Modifier un item (contenu/légende, ordre) — ÉLÈVE PROPRIÉTAIRE
   * UNIQUEMENT. Le type n'est jamais modifiable ; pour un item `image`, les
   * octets ne se remplacent pas ici (supprimer puis recréer).
   */
  async updateItem(
    chapterId: string,
    itemId: string,
    dto: UpdateMemoItemDto,
    callerId: string,
    callerRole: string,
  ): Promise<MemoItem> {
    const { item } = await this.getItemForWrite(chapterId, itemId, callerId, callerRole);

    if (dto.content !== undefined) item.content = dto.content;
    if (dto.order !== undefined) item.order = dto.order;
    return this.memoItemRepository.save(item);
  }

  /**
   * Supprimer un item — ÉLÈVE PROPRIÉTAIRE UNIQUEMENT. Supprime aussi le
   * fichier image associé, le cas échéant.
   */
  async removeItem(
    chapterId: string,
    itemId: string,
    callerId: string,
    callerRole: string,
  ): Promise<void> {
    const { item } = await this.getItemForWrite(chapterId, itemId, callerId, callerRole);

    if (item.type === 'image' && item.imageStoredFilename) {
      await this.imageStorage.delete(item.imageStoredFilename);
    }
    await this.memoItemRepository.remove(item);
  }

  /**
   * Octets d'un item image — titulaire élève, ou tiers relié en lecture.
   * Revérifie le droit de lecture à chaque téléchargement (ne fait jamais
   * confiance à la seule présence de `itemId` dans l'URL — même discipline
   * que `AttachmentsService.getFileForDownload`).
   */
  async getImageForDownload(
    chapterId: string,
    itemId: string,
    callerId: string,
    callerRole: string,
  ): Promise<MemoImageDownload> {
    const chapter = await this.memoChapterRepository.findOne({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException(`Chapitre de mémo ${chapterId} introuvable`);

    await this.assertCanRead(callerId, callerRole, chapter.studentId);

    const item = await this.memoItemRepository.findOne({ where: { id: itemId, chapterId } });
    if (!item || item.type !== 'image' || !item.imageStoredFilename) {
      throw new NotFoundException('Image introuvable');
    }

    const buffer = await this.imageStorage.read(item.imageStoredFilename);
    return { item, buffer };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Recherche et lecture consolidée pour un tiers (B6)
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Recherche dans le mémo — titulaire élève, via `GET /memos/search`. Même
   * remarque que `findChapters` : route hardcodée sur `studentId = callerId`
   * et réservée au rôle élève côté contrôleur.
   */
  async search(
    studentId: string,
    query: string,
    callerId: string,
    callerRole: string,
  ): Promise<MemoItem[]> {
    await this.assertCanRead(callerId, callerRole, studentId);

    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Le paramètre de recherche q ne peut pas être vide');
    }

    const chapters = await this.memoChapterRepository.find({ where: { studentId } });
    if (chapters.length === 0) return [];

    const chapterIds = chapters.map((chapter) => chapter.id);

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
   * Lecture consolidée du mémo d'un élève pour un tiers relié — même forme
   * que `GET /memos` pour le titulaire (B6, route
   * `GET /memos/students/:studentId`).
   */
  async findByStudentForReader(
    studentId: string,
    callerId: string,
    callerRole: string,
  ): Promise<MemoChapter[]> {
    await this.assertCanRead(callerId, callerRole, studentId);
    return this.memoChapterRepository.find({
      where: { studentId },
      relations: ['items'],
      order: { order: 'ASC', createdAt: 'ASC' },
    });
  }

  // ───────────────────────────────────────────────────────────────────────
  // Aides internes
  // ───────────────────────────────────────────────────────────────────────

  private async getChapterForWrite(
    chapterId: string,
    callerId: string,
    callerRole: string,
  ): Promise<MemoChapter> {
    const chapter = await this.memoChapterRepository.findOne({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException(`Chapitre de mémo ${chapterId} introuvable`);
    this.assertIsEleve(callerId, chapter.studentId, callerRole);
    return chapter;
  }

  private async getItemForWrite(
    chapterId: string,
    itemId: string,
    callerId: string,
    callerRole: string,
  ): Promise<{ chapter: MemoChapter; item: MemoItem }> {
    const chapter = await this.getChapterForWrite(chapterId, callerId, callerRole);
    const item = await this.memoItemRepository.findOne({ where: { id: itemId, chapterId } });
    if (!item) throw new NotFoundException(`Item de mémo ${itemId} introuvable`);
    return { chapter, item };
  }

  private async assertItemBudget(chapterId: string): Promise<void> {
    const itemCount = await this.memoItemRepository.count({ where: { chapterId } });
    if (itemCount >= MEMO_MAX_ITEMS_PER_CHAPTER) {
      throw new BadRequestException(
        `Nombre maximal d'items atteint pour ce chapitre (${MEMO_MAX_ITEMS_PER_CHAPTER})`,
      );
    }
  }
}
