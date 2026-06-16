import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LegalTemplatesService } from '../../../src/legal-templates/legal-templates.service';
import { LegalTemplate } from '../../../src/legal-templates/entities/legal-template.entity';
import { DocumentType } from '../../../src/common/enums/document-type.enum';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { CreateLegalTemplateDto } from '../../../src/legal-templates/dto/create-legal-template.dto';
import { UpdateLegalTemplateDto } from '../../../src/legal-templates/dto/update-legal-template.dto';

const mockTemplateRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

describe('LegalTemplatesService', () => {
  let service: LegalTemplatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegalTemplatesService,
        { provide: getRepositoryToken(LegalTemplate), useValue: mockTemplateRepo },
      ],
    }).compile();

    service = module.get<LegalTemplatesService>(LegalTemplatesService);
    jest.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateLegalTemplateDto = {
      title: 'Mandat client V1',
      documentType: DocumentType.MANDAT_CLIENT,
      content: '<p>Contenu du mandat</p>',
    };

    it('creates a template when caller is administrateur_financier (LDS-BR-001)', async () => {
      const savedTemplate = {
        id: 'tpl-1',
        ...createDto,
        version: 1,
        isActive: true,
        createdBy: 'af-user',
        lastModifiedBy: 'af-user',
      };
      mockTemplateRepo.create.mockReturnValue(savedTemplate);
      mockTemplateRepo.save.mockResolvedValue(savedTemplate);

      const result = await service.create(createDto, 'af-user', UserRole.ADMINISTRATEUR_FINANCIER);

      expect(result).toEqual(savedTemplate);
      expect(mockTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createDto.title,
          documentType: createDto.documentType,
          content: createDto.content,
          version: 1,
          isActive: true,
          createdBy: 'af-user',
        }),
      );
    });

    it('throws ForbiddenException when a RP tries to create a template (LDS-BR-001)', async () => {
      await expect(
        service.create(createDto, 'rp-user', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when a TI tries to create a template (LDS-BR-001)', async () => {
      await expect(
        service.create(createDto, 'ti-user', UserRole.TECHNICIEN_INFORMATIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when a formateur tries to create a template (LDS-BR-001)', async () => {
      await expect(
        service.create(createDto, 'formateur-id', UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when an eleve tries to create a template (LDS-BR-001)', async () => {
      await expect(
        service.create(createDto, 'eleve-id', UserRole.ELEVE),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    const existingTemplate: LegalTemplate = {
      id: 'tpl-1',
      title: 'Mandat V1',
      documentType: DocumentType.MANDAT_CLIENT,
      version: 1,
      content: '<p>Ancien contenu</p>',
      isActive: true,
      createdBy: 'af-user',
      lastModifiedBy: 'af-user',
      createdAt: new Date('2026-06-01'),
      updatedAt: new Date('2026-06-01'),
    };

    const updateDto: UpdateLegalTemplateDto = {
      title: 'Mandat V2',
      content: '<p>Nouveau contenu</p>',
    };

    it('updates the template and increments the version when caller is AF (LDS-BR-001)', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({ ...existingTemplate });
      const updatedTemplate = {
        ...existingTemplate,
        ...updateDto,
        version: 2,
        lastModifiedBy: 'af-user-2',
      };
      mockTemplateRepo.save.mockResolvedValue(updatedTemplate);

      const result = await service.update('tpl-1', updateDto, 'af-user-2', UserRole.ADMINISTRATEUR_FINANCIER);

      expect(result.version).toBe(2);
      expect(result.title).toBe('Mandat V2');
      expect(result.content).toBe('<p>Nouveau contenu</p>');
      expect(result.lastModifiedBy).toBe('af-user-2');
    });

    it('throws NotFoundException when template does not exist', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', updateDto, 'af-user', UserRole.ADMINISTRATEUR_FINANCIER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a RP tries to update a template (LDS-BR-001)', async () => {
      await expect(
        service.update('tpl-1', updateDto, 'rp-user', UserRole.RESPONSABLE_PEDAGOGIQUE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('only updates provided fields (partial update)', async () => {
      const partialDto: UpdateLegalTemplateDto = { title: 'Nouveau titre seulement' };
      const templateToUpdate = { ...existingTemplate };
      mockTemplateRepo.findOne.mockResolvedValue(templateToUpdate);
      mockTemplateRepo.save.mockImplementation((t) => Promise.resolve(t));

      const result = await service.update('tpl-1', partialDto, 'af-user', UserRole.ADMINISTRATEUR_FINANCIER);

      expect(result.title).toBe('Nouveau titre seulement');
      expect(result.content).toBe(existingTemplate.content); // unchanged
      expect(result.version).toBe(2); // incremented
    });
  });
});
