import { Controller, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { TerminationResponseDto } from './dto/response/termination-response.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/jwt.guard';
import { UserRole } from '../common/user-role.enum';

// ── /collaborations routes ────────────────────────────────────────────────────
@ApiTags('collaborations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('collaborations')
export class CollaborationController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':assignmentId/stop-request')
  @Roles(UserRole.FORMATEUR)
  @ApiOperation({
    summary: 'Request collaboration stop (FORMATEUR only)',
    description: 'Teacher requests to end an active collaboration with a notice date.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Stop request created' })
  @ApiResponse({ status: 400, description: 'Assignment is not active' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the assigned teacher' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async createCollaborationStopRequest(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: CreateTerminationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TerminationResponseDto> {
    const termination = await this.service.createCollaborationStopRequest(assignmentId, dto, user);
    return TerminationResponseDto.fromEntity(termination);
  }
}
