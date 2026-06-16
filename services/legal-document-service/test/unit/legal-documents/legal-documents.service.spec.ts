import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LegalDocumentsService } from '../../../src/legal-documents/legal-documents.service';
import { LegalDocument } from '../../../src/legal-documents/entities/legal-document.entity';
import { SignatureRecord } from '../../../src/legal-documents/entities/signature-record.entity';
import { DocumentStatus } from '../../../src/common/enums/document-status.enum';
import { DocumentType } from '../../../src/common/enums/document-type.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { SignDocumentDto } from '../../../src/legal-documents/dto/sign-document.dto';

const mockDocumentRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockSignatureRepo = {
  create: jest.fn(),
  save: jest.fn(),
};

describe('LegalDocumentsService', () => {
  let service: LegalDocumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalDocumentsService,
        { provide: getRepositoryToken(LegalDocument), useValue: mockDocumentRepo },
        { provide: getRepositoryToken(SignatureRecord), useValue: mockSignatureRepo },
      ],
    }).compile();

    service = module.get<LegalDocumentsService>(LegalDocumentsService);
    jest.clearAllMocks();
  });

  // ─── findByOwnerId ────────────────────────────────────────────────────────

  describe('findByOwnerId', () => {
    it('returns documents for their owner', async () => {
      const documents = [
        { id: 'doc-1', ownerId: 'user-1', documentType: DocumentType.MANDAT_CLIENT, status: DocumentStatus.A_SIGNER },
      ];
      mockDocumentRepo.find.mockResolvedValue(documents);

      const result = await service.findByOwnerId('user-1', 'user-1', UserRole.ELEVE);
      expect(result).toEqual(documents);
      expect(mockDocumentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'user-1' } }),
      );
    });

    it('allows RP to access another user documents (internal role)', async () => {
      mockDocumentRepo.find.mockResolvedValue([]);

      await expect(
        service.findByOwnerId('user-1', 'rp-user', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).resolves.toBeDefined();
    });

    it('allows TI to access another user documents (internal role)', async () => {
      mockDocumentRepo.find.mockResolvedValue([]);

      await expect(
        service.findByOwnerId('user-1', 'ti-user', UserRole.TECHNICIEN_INFORMATIQUE),
      ).resolves.toBeDefined();
    });

    it('allows AF to access another user documents (internal role)', async () => {
      mockDocumentRepo.find.mockResolvedValue([]);

      await expect(
        service.findByOwnerId('user-1', 'af-user', UserRole.ADMINISTRATEUR_FINANCIER),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when a formateur tries to access another user documents (LDS-FB-001)', async () => {
      await expect(
        service.findByOwnerId('user-1', 'formateur-id', UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when a student tries to access another user documents (LDS-FB-001)', async () => {
      await expect(
        service.findByOwnerId('user-1', 'other-user', UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── signDocument ─────────────────────────────────────────────────────────

  describe('signDocument', () => {
    const signDto: SignDocumentDto = { signerName: 'Marie Dupont' };
    const unsignedDocument = {
      id: 'doc-1',
      ownerId: 'user-1',
      documentType: DocumentType.MANDAT_CLIENT,
      status: DocumentStatus.A_SIGNER,
      templateId: 'template-1',
      templateVersion: 1,
      signatureRecord: null,
    };

    it('signs a document and transitions status to SIGNE', async () => {
      mockDocumentRepo.findOne.mockResolvedValue({ ...unsignedDocument });
      const savedDocument = { ...unsignedDocument, status: DocumentStatus.SIGNE };
      mockDocumentRepo.save.mockResolvedValue(savedDocument);

      const signatureRecord = {
        id: 'sig-1',
        legalDocumentId: 'doc-1',
        signerId: 'user-1',
        signerName: 'Marie Dupont',
        signerEmail: 'marie@example.com',
        templateVersion: 1,
        signedAt: new Date(),
      };
      mockSignatureRepo.create.mockReturnValue(signatureRecord);
      mockSignatureRepo.save.mockResolvedValue(signatureRecord);

      const result = await service.signDocument('doc-1', signDto, 'user-1', 'marie@example.com');

      expect(result.legalDocument.status).toBe(DocumentStatus.SIGNE);
      expect(result.signatureRecord).toBeDefined();
      expect(mockDocumentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: DocumentStatus.SIGNE }),
      );
      expect(mockSignatureRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ signerId: 'user-1', signerName: 'Marie Dupont' }),
      );
    });

    it('uses signerEmail from DTO when provided', async () => {
      const dtoWithEmail: SignDocumentDto = {
        signerName: 'Marie Dupont',
        signerEmail: 'override@example.com',
      };
      mockDocumentRepo.findOne.mockResolvedValue({ ...unsignedDocument });
      mockDocumentRepo.save.mockResolvedValue({ ...unsignedDocument, status: DocumentStatus.SIGNE });

      const signatureRecord = { id: 'sig-1', signerEmail: 'override@example.com' };
      mockSignatureRepo.create.mockReturnValue(signatureRecord);
      mockSignatureRepo.save.mockResolvedValue(signatureRecord);

      await service.signDocument('doc-1', dtoWithEmail, 'user-1', 'jwt@example.com');

      expect(mockSignatureRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ signerEmail: 'override@example.com' }),
      );
    });

    it('falls back to JWT email when signerEmail not in DTO', async () => {
      mockDocumentRepo.findOne.mockResolvedValue({ ...unsignedDocument });
      mockDocumentRepo.save.mockResolvedValue({ ...unsignedDocument, status: DocumentStatus.SIGNE });
      mockSignatureRepo.create.mockReturnValue({});
      mockSignatureRepo.save.mockResolvedValue({});

      await service.signDocument('doc-1', signDto, 'user-1', 'jwt@example.com');

      expect(mockSignatureRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ signerEmail: 'jwt@example.com' }),
      );
    });

    it('throws 409 ConflictException when document is already signed (LDS-BR-002)', async () => {
      const alreadySignedDocument = {
        ...unsignedDocument,
        status: DocumentStatus.SIGNE,
        signatureRecord: { id: 'sig-1', signedAt: new Date() },
      };
      mockDocumentRepo.findOne.mockResolvedValue(alreadySignedDocument);

      await expect(
        service.signDocument('doc-1', signDto, 'user-1', 'marie@example.com'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when document does not exist', async () => {
      mockDocumentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.signDocument('nonexistent-id', signDto, 'user-1', 'marie@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a non-owner tries to sign (LDS-FB-002)', async () => {
      mockDocumentRepo.findOne.mockResolvedValue({ ...unsignedDocument, ownerId: 'user-1' });

      await expect(
        service.signDocument('doc-1', signDto, 'different-user', 'other@example.com'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── checkSignatureStatus ─────────────────────────────────────────────────

  describe('checkSignatureStatus', () => {
    it('returns false for both when owner has no documents', async () => {
      mockDocumentRepo.find.mockResolvedValue([]);

      const result = await service.checkSignatureStatus('user-1');

      expect(result.ownerId).toBe('user-1');
      expect(result.mandatClientSigne).toBe(false);
      expect(result.contratFormateurSigne).toBe(false);
      expect(result.documents).toHaveLength(0);
    });

    it('returns mandatClientSigne=true when MANDAT_CLIENT is signed', async () => {
      const signedMandat = {
        documentType: DocumentType.MANDAT_CLIENT,
        status: DocumentStatus.SIGNE,
        signatureRecord: { signedAt: new Date('2026-06-16') },
      };
      mockDocumentRepo.find.mockResolvedValue([signedMandat]);

      const result = await service.checkSignatureStatus('user-1');

      expect(result.mandatClientSigne).toBe(true);
      expect(result.contratFormateurSigne).toBe(false);
    });

    it('returns contratFormateurSigne=true when CONTRAT_FORMATEUR is signed', async () => {
      const signedContrat = {
        documentType: DocumentType.CONTRAT_FORMATEUR,
        status: DocumentStatus.SIGNE,
        signatureRecord: { signedAt: new Date('2026-06-16') },
      };
      mockDocumentRepo.find.mockResolvedValue([signedContrat]);

      const result = await service.checkSignatureStatus('user-1');

      expect(result.mandatClientSigne).toBe(false);
      expect(result.contratFormateurSigne).toBe(true);
    });

    it('returns both true when both documents are signed', async () => {
      const documents = [
        {
          documentType: DocumentType.MANDAT_CLIENT,
          status: DocumentStatus.SIGNE,
          signatureRecord: { signedAt: new Date() },
        },
        {
          documentType: DocumentType.CONTRAT_FORMATEUR,
          status: DocumentStatus.SIGNE,
          signatureRecord: { signedAt: new Date() },
        },
      ];
      mockDocumentRepo.find.mockResolvedValue(documents);

      const result = await service.checkSignatureStatus('user-1');

      expect(result.mandatClientSigne).toBe(true);
      expect(result.contratFormateurSigne).toBe(true);
    });

    it('returns mandatClientSigne=false when MANDAT_CLIENT exists but is A_SIGNER', async () => {
      const unsignedMandat = {
        documentType: DocumentType.MANDAT_CLIENT,
        status: DocumentStatus.A_SIGNER,
        signatureRecord: null,
      };
      mockDocumentRepo.find.mockResolvedValue([unsignedMandat]);

      const result = await service.checkSignatureStatus('user-1');

      expect(result.mandatClientSigne).toBe(false);
    });

    it('includes document details in the documents array', async () => {
      const signatureDate = new Date('2026-06-16');
      const documents = [
        {
          documentType: DocumentType.MANDAT_CLIENT,
          status: DocumentStatus.SIGNE,
          signatureRecord: { signedAt: signatureDate },
        },
      ];
      mockDocumentRepo.find.mockResolvedValue(documents);

      const result = await service.checkSignatureStatus('user-1');

      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]).toEqual({
        documentType: DocumentType.MANDAT_CLIENT,
        status: DocumentStatus.SIGNE,
        signedAt: signatureDate,
      });
    });
  });
});
