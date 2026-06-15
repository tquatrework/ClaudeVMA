import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { MemoService } from './memo.service';
import { CreateMemoDto } from './dto/create-memo.dto';

/**
 * Routes mémos (POST /memos, GET /memos, GET /memos/:id, DELETE /memos/:id)
 *
 * Création/suppression : FORMATEUR, RP, AP, TI.
 * Lecture (liste + détail) : FORMATEUR, RP, AP, TI, ADMINISTRATEUR_FINANCIER.
 * ELEVE et PARENT_FINANCEUR n'ont pas accès aux mémos (notes internes du personnel).
 */
@ApiTags('memos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('memos')
export class MemoController {
  constructor(private readonly service: MemoService) {}

  @Post()
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: 'Create a memo',
    description: 'Create a quick note optionally linked to an activity or a student.',
  })
  @ApiResponse({ status: 201, description: 'Memo created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — role not allowed' })
  create(@Body() dto: CreateMemoDto, @Req() req: any) {
    return this.service.create(dto, req.user.id, req.user.role);
  }

  @Get()
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  )
  @ApiOperation({
    summary: 'List my memos',
    description: 'Returns all memos authored by the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Memo list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — role not allowed' })
  findAll(@Req() req: any) {
    return this.service.findByAuthor(req.user.id);
  }

  @Get(':id')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
    UserRole.ADMINISTRATEUR_FINANCIER,
  )
  @ApiParam({ name: 'id', description: 'Memo UUID' })
  @ApiOperation({ summary: 'Get a memo by ID' })
  @ApiResponse({ status: 200, description: 'Memo found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles(
    UserRole.FORMATEUR,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.ANIMATEUR_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Memo UUID' })
  @ApiOperation({ summary: 'Delete a memo' })
  @ApiResponse({ status: 204, description: 'Memo deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.id, req.user.role);
  }
}
