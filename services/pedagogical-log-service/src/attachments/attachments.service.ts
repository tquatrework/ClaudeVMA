import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PedagogicalLogAttachment } from './entities/pedagogical-log-attachment.entity';
import { PedagogicalLogService } from '../pedagogical-log/pedagogical-log.service';
import { PedagogicalLogSettingsService } from '../settings/settings.service';
import { AttachmentStorageService } from './attachment-storage.service';
import {
  ACCEPTED_ATTACHMENT_MIME_TYPES,
  SVG_MIME_TYPE,
  detectAttachmentMimeType,
} from './attachment-mime-detector';

export interface AttachmentDownload {
  attachment: PedagogicalLogAttachment;
  buffer: Buffer;
}

/**
 * Pièces jointes d'une entrée de cahier de texte — arbitrage du 2026-08-26,
 * docs/architecture.md "Liens et pièces jointes sur une entrée de cahier de
 * texte".
 *
 * Écriture (création/suppression) : formateur auteur, toujours titulaire de
 * la relation avec l'élève — délégué à
 * `PedagogicalLogService.getEntryForWrite`, même régime que
 * sessionSummary/homework/date (point 2).
 *
 * Lecture (liste/téléchargement) : mêmes droits que l'entrée parente,
 * délégué à `PedagogicalLogService.findOne` — pas de filtrage supplémentaire
 * au niveau du fichier (point 4). Ne fait jamais confiance à la seule
 * présence d'un `attachmentId` dans l'URL : le droit de lecture de l'entrée
 * est revérifié à chaque téléchargement.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(PedagogicalLogAttachment)
    private readonly attachmentRepository: Repository<PedagogicalLogAttachment>,
    private readonly pedagogicalLogService: PedagogicalLogService,
    private readonly settingsService: PedagogicalLogSettingsService,
    private readonly storage: AttachmentStorageService,
  ) {}

  async create(
    logEntryId: string,
    file: Express.Multer.File | undefined,
    callerId: string,
    callerRole: string,
  ): Promise<PedagogicalLogAttachment> {
    const settings = await this.settingsService.getSettings();
    if (!settings.attachmentsEnabled) {
      throw new ForbiddenException(
        "Les pièces jointes sont désactivées par le technicien informatique",
      );
    }

    // Vérifie que l'entrée existe et que l'appelant a le droit d'y écrire
    // AVANT tout traitement du fichier envoyé — l'autorisation prime sur la
    // validation du contenu, même ordre que le reste du service.
    await this.pedagogicalLogService.getEntryForWrite(logEntryId, callerId, callerRole);

    if (!file) {
      throw new BadRequestException('Aucun fichier envoyé');
    }

    // Plafond par fichier — vérifié après lecture complète du fichier en
    // mémoire par multer : pas de refus en streaming ici (contrairement à
    // l'avatar de profile-service), car le plafond est réglable par le TI en
    // base et ne peut pas être connu au moment où l'intercepteur multer est
    // configuré (arbitrage du 2026-08-26, point 6 — même rappel que pour
    // l'avatar : si le plafond est un jour relevé au-delà de celui de
    // nginx-global, relever le proxy d'abord). Aux valeurs par défaut
    // (100 Ko/5 Mo), un envoi n'approche jamais les plafonds réseau.
    if (file.size > settings.maxFileBytes) {
      throw new PayloadTooLargeException({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: 'Uploaded file exceeds the maximum allowed size',
        maxUploadBytes: settings.maxFileBytes,
        receivedBytes: file.size,
        requestBodyBytes: null,
      });
    }

    const { total: currentTotal } = await this.attachmentRepository
      .createQueryBuilder('attachment')
      .select('COALESCE(SUM(attachment.sizeBytes), 0)', 'total')
      .where('attachment.logEntryId = :logEntryId', { logEntryId })
      .getRawOne<{ total: string }>();

    if (Number(currentTotal) + file.size > settings.maxTotalBytesPerEntry) {
      throw new PayloadTooLargeException({
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'UPLOAD_TOTAL_SIZE_EXCEEDED',
        message: 'Adding this file would exceed the maximum total size allowed for this entry',
        maxUploadBytes: settings.maxTotalBytesPerEntry,
        receivedBytes: file.size,
        requestBodyBytes: null,
      });
    }

    const mimeType = await detectAttachmentMimeType(file.buffer);
    if (mimeType === SVG_MIME_TYPE) {
      throw new BadRequestException(
        "Les fichiers SVG ne sont pas acceptés (document XML exécutable)",
      );
    }
    if (!mimeType || !(ACCEPTED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new BadRequestException('Format de fichier non reconnu ou non autorisé');
    }

    const storedFilename = await this.storage.save(file.buffer);

    const attachment = this.attachmentRepository.create({
      logEntryId,
      originalFilename: file.originalname,
      storedFilename,
      mimeType,
      sizeBytes: file.size,
      uploadedBy: callerId,
    });
    return this.attachmentRepository.save(attachment);
  }

  async findAllForEntry(
    logEntryId: string,
    callerRole: string,
  ): Promise<PedagogicalLogAttachment[]> {
    // Applique le même filtrage de visibilité que l'entrée elle-même —
    // lève 403/404 selon le cas (PedagogicalLogService.findOne).
    await this.pedagogicalLogService.findOne(logEntryId, callerRole);
    return this.attachmentRepository.find({
      where: { logEntryId },
      order: { createdAt: 'ASC' },
    });
  }

  async getFileForDownload(
    logEntryId: string,
    attachmentId: string,
    callerRole: string,
  ): Promise<AttachmentDownload> {
    // Revérifie le droit de lecture de l'entrée parente à chaque
    // téléchargement — ne fait jamais confiance à la seule présence de
    // l'attachmentId dans l'URL (arbitrage du 2026-08-26, point 4).
    await this.pedagogicalLogService.findOne(logEntryId, callerRole);

    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, logEntryId },
    });
    if (!attachment) throw new NotFoundException('Pièce jointe introuvable');

    const buffer = await this.storage.read(attachment.storedFilename);
    return { attachment, buffer };
  }

  async remove(
    logEntryId: string,
    attachmentId: string,
    callerId: string,
    callerRole: string,
  ): Promise<void> {
    const entry = await this.pedagogicalLogService.getEntryForWrite(
      logEntryId,
      callerId,
      callerRole,
    );

    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, logEntryId: entry.id },
    });
    if (!attachment) throw new NotFoundException('Pièce jointe introuvable');

    await this.storage.delete(attachment.storedFilename);
    await this.attachmentRepository.remove(attachment);
  }
}
