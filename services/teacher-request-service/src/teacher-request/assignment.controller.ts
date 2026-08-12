import { Controller, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { AssignmentResponseDto } from './dto/response/assignment-response.dto';
import { TerminationResponseDto } from './dto/response/termination-response.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Context, RequestContext } from '../common/request-context.decorator';
import { UserRole } from '../common/user-role.enum';

/**
 * HERITAGE. Ces routes travaillent sur la table `assignments`, que le flow
 * n'alimente plus depuis l'arbitrage du 2026-08-12 : le lien eleve↔formateur
 * appartient a profile-service. Elles restent en service pour les affectations
 * creees par l'ancien modele.
 */
@ApiTags('assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':assignmentId/main-teacher')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ELEVE)
  @ApiOperation({
    summary: 'Designer le professeur principal (affectation heritee)',
    description:
      'Sur le flow courant, le professeur principal se declare a la validation du RP ' +
      '(`isPrincipalTeacher` de `POST /requests/:id/validate`), qui le transmet a profile-service.',
  })
  @ApiParam({ name: 'assignmentId', description: "Identifiant de l'affectation" })
  @ApiResponse({ status: 201, description: 'Professeur principal designe', type: AssignmentResponseDto })
  @ApiResponse({ status: 400, description: 'Affectation inactive' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Role sans droit' })
  @ApiResponse({ status: 404, description: 'Affectation inexistante' })
  async setMainTeacher(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Context() context: RequestContext,
  ): Promise<AssignmentResponseDto> {
    return AssignmentResponseDto.fromEntity(await this.service.setMainTeacher(assignmentId, context));
  }

  @Post(':assignmentId/termination')
  @Roles(UserRole.FORMATEUR)
  @ApiOperation({
    summary: "Demander l'arret d'une collaboration avec preavis (formateur)",
    description: 'Route de reference pour l\'arret ; `POST /collaborations/:id/stop-request` en est un alias.',
  })
  @ApiParam({ name: 'assignmentId', description: "Identifiant de l'affectation" })
  @ApiResponse({ status: 201, description: 'Demande d\'arret enregistree', type: TerminationResponseDto })
  @ApiResponse({ status: 400, description: 'Affectation inactive' })
  @ApiResponse({ status: 401, description: 'Jeton absent ou invalide' })
  @ApiResponse({ status: 403, description: 'Reserve aux formateurs' })
  @ApiResponse({ status: 404, description: 'Affectation inexistante ou confiee a un autre formateur' })
  async createTermination(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: CreateTerminationDto,
    @Context() context: RequestContext,
  ): Promise<TerminationResponseDto> {
    return TerminationResponseDto.fromEntity(await this.service.createTermination(assignmentId, dto, context));
  }
}
