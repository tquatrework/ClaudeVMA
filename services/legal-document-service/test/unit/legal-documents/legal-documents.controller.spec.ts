import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { LegalDocumentsController } from '../../../src/legal-documents/legal-documents.controller';
import { LegalDocumentsService } from '../../../src/legal-documents/legal-documents.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { DocumentStatus } from '../../../src/common/enums/document-status.enum';
import { DocumentType } from '../../../src/common/enums/document-type.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';

const mockJwtAuthGuard = { canActivate: (_context: ExecutionContext) => true };

const mockLegalDocumentsService = {
  findByOwnerId: jest.fn(),
  signDocument: jest.fn(),
};

const mockRequest = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    role: UserRole.ELEVE,
  },
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
};

describe('LegalDocumentsController', () => {
  let controller: LegalDocumentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LegalDocumentsController],
      providers: [
        { provide: LegalDocumentsService, useValue: mockLegalDocumentsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<LegalDocumentsController>(LegalDocumentsController);
    jest.clearAllMocks();
  });

  describe('findByOwnerId', () => {
    it('calls service.findByOwnerId with correct arguments', async () => {
      const documents = [
        { id: 'doc-1', ownerId: 'user-1', documentType: DocumentType.MANDAT_CLIENT, status: DocumentStatus.A_SIGNER },
      ];
      mockLegalDocumentsService.findByOwnerId.mockResolvedValue(documents);

      const result = await controller.findByOwnerId('user-1', mockRequest as any);

      expect(result).toEqual(documents);
      expect(mockLegalDocumentsService.findByOwnerId).toHaveBeenCalledWith('user-1', 'user-1', UserRole.ELEVE);
    });
  });

  describe('signDocument', () => {
    it('calls service.signDocument with correct arguments', async () => {
      const signDto = { signerName: 'Marie Dupont' };
      const signedResult = {
        legalDocument: { id: 'doc-1', status: DocumentStatus.SIGNE },
        signatureRecord: { id: 'sig-1', signedAt: new Date() },
      };
      mockLegalDocumentsService.signDocument.mockResolvedValue(signedResult);

      const result = await controller.signDocument('doc-1', signDto, mockRequest as any);

      expect(result).toEqual(signedResult);
      expect(mockLegalDocumentsService.signDocument).toHaveBeenCalledWith(
        'doc-1',
        signDto,
        'user-1',
        'user@example.com',
        '127.0.0.1',
      );
    });
  });
});
