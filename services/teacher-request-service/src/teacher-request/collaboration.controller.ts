import { Controller, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { TerminationResponseDto } from './dto/response/termination-response.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Context, RequestContext } from '../common/request-context.decorator';
import { UserRole } from '../common/user-role.enum';

/**
 * HERITAGE, et alias strict de `POST /assignments/:id/termination` : meme
 * traitement, meme regles. Les deux routes existaient avec deux
 * implementations quasi identiques ; elles partagent desormais la meme, en
 * attendant qu'une seule survive. `/collaborations` n'est aujourd'hui pas
 * proxifie par la gateway.
 */
@ApiTags('collaborations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('collaborations')
export class CollaborationController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':assignmentId/stop-request')
  @Roles(UserRole.FORMATEUR)
  @ApiOperation({
    summary: "Demander l'arret d'une collaboration (formateur) — alias",
    description: 'Identique a `POST /assignments/:assignmentId/termination`.',
  })
  @ApiParam({ name: 'assignmentId', description: "Identifiant de l'affectation" })
  @ApiResponse({ status: 201, description: "Demande d'arret enregistree", type: TerminationResponseDto })
  @ApiResponse({ status: 400, description: 'Affectation inactive' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Reserve aux formateurs' })
  @ApiResponse({ status: 404, description: 'Affectation inexistante ou confiee a un autre formateur' })
  async createCollaborationStopRequest(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: CreateTerminationDto,
    @Context() context: RequestContext,
  ): Promise<TerminationResponseDto> {
    return TerminationResponseDto.fromEntity(
      await this.service.createCollaborationStopRequest(assignmentId, dto, context),
    );
  }
}
