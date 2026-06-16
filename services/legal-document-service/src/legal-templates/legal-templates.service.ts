import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalTemplate } from './entities/legal-template.entity';
import { CreateLegalTemplateDto } from './dto/create-legal-template.dto';
import { UpdateLegalTemplateDto } from './dto/update-legal-template.dto';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class LegalTemplatesService {
  constructor(
    @InjectRepository(LegalTemplate)
    private readonly templateRepo: Repository<LegalTemplate>,
  ) {}

  /**
   * Creates a new legal template.
   * LDS-BR-001: Only administrateur_financier can create templates.
   */
  async create(dto: CreateLegalTemplateDto, creatorId: string, creatorRole: string): Promise<LegalTemplate> {
    this.assertIsAdministrateurFinancier(creatorRole);

    const newTemplate = this.templateRepo.create({
      title: dto.title,
      documentType: dto.documentType,
      content: dto.content,
      version: 1,
      isActive: true,
      createdBy: creatorId,
      lastModifiedBy: creatorId,
    });

    return this.templateRepo.save(newTemplate);
  }

  /**
   * Updates an existing legal template, incrementing the version.
   * LDS-BR-001: Only administrateur_financier can update templates.
   */
  async update(
    templateId: string,
    dto: UpdateLegalTemplateDto,
    modifierId: string,
    modifierRole: string,
  ): Promise<LegalTemplate> {
    this.assertIsAdministrateurFinancier(modifierRole);

    const existingTemplate = await this.templateRepo.findOne({ where: { id: templateId } });
    if (!existingTemplate) {
      throw new NotFoundException(`Template with id ${templateId} not found`);
    }

    if (dto.title !== undefined) {
      existingTemplate.title = dto.title;
    }
    if (dto.content !== undefined) {
      existingTemplate.content = dto.content;
    }

    existingTemplate.version += 1;
    existingTemplate.lastModifiedBy = modifierId;

    return this.templateRepo.save(existingTemplate);
  }

  /**
   * Finds the active template for a given document type.
   */
  async findActiveByDocumentType(documentType: string): Promise<LegalTemplate | null> {
    return this.templateRepo.findOne({
      where: { documentType: documentType as any, isActive: true },
      order: { version: 'DESC' },
    });
  }

  /**
   * Finds a template by id.
   */
  async findById(templateId: string): Promise<LegalTemplate | null> {
    return this.templateRepo.findOne({ where: { id: templateId } });
  }

  // --- Access control ---

  private assertIsAdministrateurFinancier(role: string): void {
    if (role !== UserRole.ADMINISTRATEUR_FINANCIER) {
      throw new ForbiddenException(
        'LDS-BR-001: Only administrateur_financier can create or modify legal templates',
      );
    }
  }
}
