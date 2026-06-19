import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
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
import { PedagogicalLogService } from './pedagogical-log.service';
import { CreateSpecialPageDto } from './dto/create-special-page.dto';

/**
 * Routes pages spéciales du cahier de texte (RP uniquement).
 *
 * POST /students/:studentId/pedagogical-log/special-pages
 *
 * XML spec functionality 003: pages spéciales parent/financeur pouvant être invisibles à l'élève.
 * Seul le RP peut créer des pages spéciales (docs/routes.md).
 */
@ApiTags('pedagogical-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students/:studentId/pedagogical-log')
export class SpecialPageController {
  constructor(private readonly service: PedagogicalLogService) {}

  @Post('special-pages')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiParam({ name: 'studentId', description: 'UUID de l\'élève' })
  @ApiOperation({
    summary: 'Créer une page spéciale avec visibilité ciblée',
    description:
      'Réservé au RP. Crée une page spéciale pouvant être masquée à l\'élève. ' +
      'XML spec func 003: pages spéciales parent/financeur invisibles à l\'élève si hiddenFromStudent=true.',
  })
  @ApiResponse({
    status: 201,
    description: 'Page spéciale créée',
    schema: {
      example: {
        id: 'uuid',
        studentId: 'uuid',
        authorId: 'uuid',
        authorRole: 'responsable_pedagogique',
        content: 'Communication confidentielle',
        visibility: 'special',
        isSpecialPage: true,
        hiddenFromStudent: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Erreur de validation' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Interdit — réservé au RP' })
  createSpecialPage(
    @Param('studentId') studentId: string,
    @Body() dto: CreateSpecialPageDto,
    @Req() req: any,
  ) {
    return this.service.createSpecialPage(studentId, dto, req.user.id, req.user.role);
  }
}
