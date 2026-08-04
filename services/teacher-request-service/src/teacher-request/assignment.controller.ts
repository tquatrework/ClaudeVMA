import { Controller, Post, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { AssignmentResponseDto } from './dto/response/assignment-response.dto';
import { TerminationResponseDto } from './dto/response/termination-response.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/jwt.guard';
import { UserRole } from '../common/user-role.enum';

// ── /assignments routes ───────────────────────────────────────────────────────
@ApiTags('assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assignments')
export class AssignmentController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':assignmentId/main-teacher')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ELEVE)
  @ApiOperation({
    summary: 'Designate main teacher',
    description: 'RP or ELEVE sets the main teacher for an assignment.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Main teacher flag set' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async setMainTeacher(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AssignmentResponseDto> {
    const updated = await this.service.setMainTeacher(assignmentId, user);
    return AssignmentResponseDto.fromEntity(updated);
  }

  @Post(':assignmentId/termination')
  @Roles(UserRole.FORMATEUR)
  @ApiOperation({
    summary: 'Request assignment termination (FORMATEUR only)',
    description: 'Teacher requests to end relation with a notice date.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Termination request created' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the teacher on this assignment' })
  async createTermination(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: CreateTerminationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TerminationResponseDto> {
    const termination = await this.service.createTermination(assignmentId, dto, user);
    return TerminationResponseDto.fromEntity(termination);
  }
}
