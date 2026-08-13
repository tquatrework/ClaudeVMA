import { Controller, Post, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { AssignmentResponseDto } from './dto/response/assignment-response.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Context, RequestContext } from '../common/request-context.decorator';
import { UserRole } from '../common/user-role.enum';

/**
 * HERITAGE. Cette route travaille sur la table `assignments`, que le flow
 * n'alimente plus depuis l'arbitrage du 2026-08-12 : le lien eleve↔formateur
 * appartient a profile-service. Elle reste en service pour les affectations
 * creees par l'ancien modele.
 *
 * Les routes d'arret pilotees par le formateur (`POST :id/termination` et son
 * alias `POST /collaborations/:id/stop-request`) ont ete retirees le
 * 2026-08-13 (arbitrage du 2026-08-12, « Fin d'une relation eleve-formateur »,
 * point 7) : seul le RP met fin a une relation eleve↔formateur, via
 * `DELETE /relations/teacher-student/:teacherId/:studentId` sur profile-service.
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
}
