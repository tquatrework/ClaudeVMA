/**
 * Unit tests — AttachmentsService
 *
 * Arbitrage du 2026-08-26, "Liens et pièces jointes sur une entrée de cahier
 * de texte". Couvre :
 *   - interrupteur attachmentsEnabled (point 7)
 *   - écriture réservée au formateur auteur titulaire (point 2, délégué à
 *     PedagogicalLogService.getEntryForWrite)
 *   - plafonds par fichier et par entrée, 413 structuré (point 6)
 *   - liste blanche de types, SVG explicitement refusé (point 5)
 *   - lecture qui revérifie le droit sur l'entrée parente (point 4)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AttachmentsService } from '../../../src/attachments/attachments.service';
import { PedagogicalLogAttachment } from '../../../src/attachments/entities/pedagogical-log-attachment.entity';
import { PedagogicalLogService } from '../../../src/pedagogical-log/pedagogical-log.service';
import { PedagogicalLogSettingsService } from '../../../src/settings/settings.service';
import { AttachmentStorageService } from '../../../src/attachments/attachment-storage.service';
import * as mimeDetector from '../../../src/attachments/attachment-mime-detector';

jest.mock('../../../src/attachments/attachment-mime-detector', () => {
  const actual = jest.requireActual('../../../src/attachments/attachment-mime-detector');
  return { ...actual, detectAttachmentMimeType: jest.fn() };
});

const LOG_ID = 'eeeeeeee-0000-4000-e000-eeeeeeeeeeee';
const ATTACHMENT_ID = 'aaaaaaaa-1111-4111-a111-111111111111';
const FORMATEUR_ID = 'bbbbbbbb-0000-4000-b000-bbbbbbbbbbbb';

function buildFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'devoir.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1000,
    buffer: Buffer.from('%PDF-1.4 fake'),
    ...overrides,
  } as Express.Multer.File;
}

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let attachmentRepository: any;
  let pedagogicalLogService: { getEntryForWrite: jest.Mock; findOne: jest.Mock };
  let settingsService: { getSettings: jest.Mock };
  let storage: { save: jest.Mock; read: jest.Mock; delete: jest.Mock };
  let queryBuilder: any;

  beforeEach(async () => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };

    attachmentRepository = {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => ({ id: ATTACHMENT_ID, ...data })),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    pedagogicalLogService = {
      getEntryForWrite: jest.fn().mockResolvedValue({ id: LOG_ID, studentId: 'student-1' }),
      findOne: jest.fn().mockResolvedValue({ id: LOG_ID }),
    };

    settingsService = {
      getSettings: jest.fn().mockResolvedValue({
        attachmentsEnabled: true,
        maxFileBytes: 100000,
        maxTotalBytesPerEntry: 5000000,
      }),
    };

    storage = {
      save: jest.fn().mockResolvedValue('stored-uuid-filename'),
      read: jest.fn().mockResolvedValue(Buffer.from('bytes')),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    (mimeDetector.detectAttachmentMimeType as jest.Mock).mockResolvedValue('application/pdf');

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: getRepositoryToken(PedagogicalLogAttachment), useValue: attachmentRepository },
        { provide: PedagogicalLogService, useValue: pedagogicalLogService },
        { provide: PedagogicalLogSettingsService, useValue: settingsService },
        { provide: AttachmentStorageService, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(AttachmentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create()', () => {
    it('[OK] crée une pièce jointe pour un PDF valide', async () => {
      const result = await service.create(LOG_ID, buildFile(), FORMATEUR_ID, 'formateur');

      expect(pedagogicalLogService.getEntryForWrite).toHaveBeenCalledWith(LOG_ID, FORMATEUR_ID, 'formateur');
      expect(storage.save).toHaveBeenCalled();
      expect(attachmentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          logEntryId: LOG_ID,
          originalFilename: 'devoir.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1000,
          uploadedBy: FORMATEUR_ID,
        }),
      );
      expect(result.id).toBe(ATTACHMENT_ID);
    });

    it('[CRITIQUE] pièces jointes désactivées par le TI → ForbiddenException, jamais un succès silencieux', async () => {
      settingsService.getSettings.mockResolvedValue({
        attachmentsEnabled: false,
        maxFileBytes: 100000,
        maxTotalBytesPerEntry: 5000000,
      });

      await expect(
        service.create(LOG_ID, buildFile(), FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(pedagogicalLogService.getEntryForWrite).not.toHaveBeenCalled();
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('délègue l\'autorisation d\'écriture à PedagogicalLogService.getEntryForWrite (même régime que sessionSummary/homework)', async () => {
      pedagogicalLogService.getEntryForWrite.mockRejectedValue(
        new ForbiddenException('Seul le formateur auteur peut modifier cette entrée du cahier de texte'),
      );

      await expect(
        service.create(LOG_ID, buildFile(), 'un-autre-formateur', 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('aucun fichier envoyé → BadRequestException', async () => {
      await expect(
        service.create(LOG_ID, undefined, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });

    it('[CRITIQUE] fichier dépassant le plafond par fichier → 413 structuré', async () => {
      const bigFile = buildFile({ size: 200000 });

      await expect(service.create(LOG_ID, bigFile, FORMATEUR_ID, 'formateur')).rejects.toMatchObject({
        status: 413,
        response: expect.objectContaining({
          code: 'UPLOAD_FILE_TOO_LARGE',
          maxUploadBytes: 100000,
          receivedBytes: 200000,
        }),
      });
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] budget total de l\'entrée dépassé → 413 structuré avec un code distinct', async () => {
      queryBuilder.getRawOne.mockResolvedValue({ total: '4999500' });
      const file = buildFile({ size: 1000 });

      await expect(service.create(LOG_ID, file, FORMATEUR_ID, 'formateur')).rejects.toMatchObject({
        status: 413,
        response: expect.objectContaining({
          code: 'UPLOAD_TOTAL_SIZE_EXCEEDED',
          maxUploadBytes: 5000000,
        }),
      });
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('[CRITIQUE] un SVG est explicitement refusé, message dédié', async () => {
      (mimeDetector.detectAttachmentMimeType as jest.Mock).mockResolvedValue(mimeDetector.SVG_MIME_TYPE);

      await expect(
        service.create(LOG_ID, buildFile({ originalname: 'evil.svg' }), FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('un format non reconnu (ni liste blanche, ni texte) → BadRequestException', async () => {
      (mimeDetector.detectAttachmentMimeType as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(LOG_ID, buildFile(), FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('un type hors liste blanche mais reconnu par la détection → BadRequestException', async () => {
      (mimeDetector.detectAttachmentMimeType as jest.Mock).mockResolvedValue('application/zip');

      await expect(
        service.create(LOG_ID, buildFile(), FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllForEntry()', () => {
    it('[CRITIQUE] revérifie le droit de lecture de l\'entrée parente avant de lister', async () => {
      attachmentRepository.find.mockResolvedValue([]);

      await service.findAllForEntry(LOG_ID, 'eleve');

      expect(pedagogicalLogService.findOne).toHaveBeenCalledWith(LOG_ID, 'eleve');
    });

    it('propage un refus de visibilité (403/404) sans lister les pièces jointes', async () => {
      pedagogicalLogService.findOne.mockRejectedValue(new ForbiddenException('non autorisé'));

      await expect(service.findAllForEntry(LOG_ID, 'eleve')).rejects.toThrow(ForbiddenException);
      expect(attachmentRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('getFileForDownload()', () => {
    it('[CRITIQUE] revérifie le droit de lecture de l\'entrée à chaque téléchargement', async () => {
      attachmentRepository.findOne.mockResolvedValue({
        id: ATTACHMENT_ID,
        storedFilename: 'stored-uuid-filename',
        mimeType: 'application/pdf',
      });

      const result = await service.getFileForDownload(LOG_ID, ATTACHMENT_ID, 'formateur');

      expect(pedagogicalLogService.findOne).toHaveBeenCalledWith(LOG_ID, 'formateur');
      expect(storage.read).toHaveBeenCalledWith('stored-uuid-filename');
      expect(result.buffer).toEqual(Buffer.from('bytes'));
    });

    it('pièce jointe introuvable pour cette entrée → NotFoundException, jamais de confiance sur le seul id', async () => {
      attachmentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getFileForDownload(LOG_ID, ATTACHMENT_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
      expect(storage.read).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('[OK] supprime le fichier et la ligne', async () => {
      attachmentRepository.findOne.mockResolvedValue({
        id: ATTACHMENT_ID,
        storedFilename: 'stored-uuid-filename',
      });

      await service.remove(LOG_ID, ATTACHMENT_ID, FORMATEUR_ID, 'formateur');

      expect(pedagogicalLogService.getEntryForWrite).toHaveBeenCalledWith(LOG_ID, FORMATEUR_ID, 'formateur');
      expect(storage.delete).toHaveBeenCalledWith('stored-uuid-filename');
      expect(attachmentRepository.remove).toHaveBeenCalled();
    });

    it('formateur non auteur → ForbiddenException (délégué à getEntryForWrite)', async () => {
      pedagogicalLogService.getEntryForWrite.mockRejectedValue(new ForbiddenException('non autorisé'));

      await expect(
        service.remove(LOG_ID, ATTACHMENT_ID, 'un-autre', 'formateur'),
      ).rejects.toThrow(ForbiddenException);
      expect(attachmentRepository.findOne).not.toHaveBeenCalled();
    });

    it('pièce jointe introuvable → NotFoundException', async () => {
      attachmentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(LOG_ID, ATTACHMENT_ID, FORMATEUR_ID, 'formateur'),
      ).rejects.toThrow(NotFoundException);
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });
});
