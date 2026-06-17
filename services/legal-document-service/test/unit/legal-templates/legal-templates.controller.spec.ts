import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { LegalTemplatesController } from '../../../src/legal-templates/legal-templates.controller';
import { LegalTemplatesService } from '../../../src/legal-templates/legal-templates.service';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { DocumentType } from '../../../src/common/enums/document-type.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { CreateLegalTemplateDto } from '../../../src/legal-templates/dto/create-legal-template.dto';
import { UpdateLegalTemplateDto } from '../../../src/legal-templates/dto/update-legal-template.dto';

const mockJwtAuthGuard = { canActivate: (_context: ExecutionContext) => true };

const mockLegalTemplatesService = {
  create: jest.fn(),
  update: jest.fn(),
};

const mockAfRequest = {
  user: {
    id: 'af-user',
    email: 'af@example.com',
    role: UserRole.ADMINISTRATEUR_FINANCIER,
  },
};

describe('LegalTemplatesController', () => {
  let controller: LegalTemplatesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LegalTemplatesController],
      providers: [
        { provide: LegalTemplatesService, useValue: mockLegalTemplatesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<LegalTemplatesController>(LegalTemplatesController);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('calls service.create with correct arguments', async () => {
      const createDto: CreateLegalTemplateDto = {
        title: 'Mandat V1',
        documentType: DocumentType.MANDAT_CLIENT,
        content: '<p>Contenu</p>',
      };
      const createdTemplate = { id: 'tpl-1', ...createDto, version: 1 };
      mockLegalTemplatesService.create.mockResolvedValue(createdTemplate);

      const result = await controller.create(createDto, mockAfRequest as any);

      expect(result).toEqual(createdTemplate);
      expect(mockLegalTemplatesService.create).toHaveBeenCalledWith(
        createDto,
        'af-user',
        UserRole.ADMINISTRATEUR_FINANCIER,
      );
    });
  });

  describe('update', () => {
    it('calls service.update with correct arguments', async () => {
      const updateDto: UpdateLegalTemplateDto = { title: 'Mandat V2' };
      const updatedTemplate = { id: 'tpl-1', title: 'Mandat V2', version: 2 };
      mockLegalTemplatesService.update.mockResolvedValue(updatedTemplate);

      const result = await controller.update('tpl-1', updateDto, mockAfRequest as any);

      expect(result).toEqual(updatedTemplate);
      expect(mockLegalTemplatesService.update).toHaveBeenCalledWith(
        'tpl-1',
        updateDto,
        'af-user',
        UserRole.ADMINISTRATEUR_FINANCIER,
      );
    });
  });
});
