import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { LegalTemplatesService } from './legal-templates.service';
import { CreateLegalTemplateDto } from './dto/create-legal-template.dto';
import { UpdateLegalTemplateDto } from './dto/update-legal-template.dto';

@ApiTags('legal-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('legal-templates')
export class LegalTemplatesController {
  constructor(private readonly legalTemplatesService: LegalTemplatesService) {}

  @Post()
  @Roles(UserRole.ADMINISTRATEUR_FINANCIER)
  @ApiOperation({
    summary: 'Create a legal template',
    description:
      'Creates a new legal document template. ' +
      'LDS-BR-001: Only administrateur_financier can create templates. ' +
      'The template version starts at 1.',
  })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Correlation ID for tracing' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — LDS-BR-001: only administrateur_financier' })
  create(
    @Body() dto: CreateLegalTemplateDto,
    @Req() req: any,
    @Headers('x-correlation-id') _correlationId?: string,
  ) {
    return this.legalTemplatesService.create(dto, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRATEUR_FINANCIER)
  @ApiOperation({
    summary: 'Update a legal template',
    description:
      'Updates an existing legal document template. ' +
      'LDS-BR-001: Only administrateur_financier can modify templates. ' +
      'The template version is automatically incremented.',
  })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiHeader({ name: 'x-correlation-id', required: false, description: 'Correlation ID for tracing' })
  @ApiResponse({ status: 200, description: 'Template updated successfully — version incremented' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — LDS-BR-001: only administrateur_financier' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  update(
    @Param('id') templateId: string,
    @Body() dto: UpdateLegalTemplateDto,
    @Req() req: any,
    @Headers('x-correlation-id') _correlationId?: string,
  ) {
    return this.legalTemplatesService.update(templateId, dto, req.user.id, req.user.role);
  }
}
