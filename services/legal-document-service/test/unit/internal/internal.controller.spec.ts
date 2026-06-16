import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { InternalController } from '../../../src/internal/internal.controller';
import { LegalDocumentsService } from '../../../src/legal-documents/legal-documents.service';
import { InternalSecretGuard } from '../../../src/common/guards/internal-secret.guard';
import { DocumentStatus } from '../../../src/common/enums/document-status.enum';
import { DocumentType } from '../../../src/common/enums/document-type.enum';

const mockInternalSecretGuard = { canActivate: (_context: ExecutionContext) => true };

const mockLegalDocumentsService = {
  checkSignatureStatus: jest.fn(),
};

describe('InternalController', () => {
  let controller: InternalController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [
        { provide: LegalDocumentsService, useValue: mockLegalDocumentsService },
      ],
    })
      .overrideGuard(InternalSecretGuard)
      .useValue(mockInternalSecretGuard)
      .compile();

    controller = module.get<InternalController>(InternalController);
    jest.clearAllMocks();
  });

  describe('checkSignatureStatus', () => {
    it('returns the correct signature status for an owner', async () => {
      const signatureStatus = {
        ownerId: 'user-1',
        mandatClientSigne: true,
        contratFormateurSigne: false,
        documents: [
          {
            documentType: DocumentType.MANDAT_CLIENT,
            status: DocumentStatus.SIGNE,
            signedAt: new Date('2026-06-16'),
          },
        ],
      };
      mockLegalDocumentsService.checkSignatureStatus.mockResolvedValue(signatureStatus);

      const result = await controller.checkSignatureStatus('user-1');

      expect(result).toEqual(signatureStatus);
      expect(mockLegalDocumentsService.checkSignatureStatus).toHaveBeenCalledWith('user-1');
    });

    it('returns both false when owner has no documents', async () => {
      const emptyStatus = {
        ownerId: 'user-2',
        mandatClientSigne: false,
        contratFormateurSigne: false,
        documents: [],
      };
      mockLegalDocumentsService.checkSignatureStatus.mockResolvedValue(emptyStatus);

      const result = await controller.checkSignatureStatus('user-2');

      expect(result.mandatClientSigne).toBe(false);
      expect(result.contratFormateurSigne).toBe(false);
    });
  });
});
