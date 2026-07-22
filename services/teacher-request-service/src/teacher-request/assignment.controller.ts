import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { TeacherRequestService } from './teacher-request.service';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { JwtAuthGuard } from '../common/jwt.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtPayload } from '../common/jwt.guard';

// ── /assignments routes ───────────────────────────────────────────────────────
@ApiTags('assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assignments')
export class AssignmentController {
  constructor(private readonly service: TeacherRequestService) {}

  @Post(':assignmentId/main-teacher')
  @ApiOperation({
    summary: 'Designate main teacher',
    description: 'RP or ELEVE sets the main teacher for an assignment.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Main teacher flag set' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  setMainTeacher(@Param('assignmentId') assignmentId: string, @CurrentUser() user: JwtPayload) {
    return this.service.setMainTeacher(assignmentId, user);
  }

  @Post(':assignmentId/termination')
  @ApiOperation({
    summary: 'Request assignment termination (FORMATEUR only)',
    description: 'Teacher requests to end relation with a notice date.',
  })
  @ApiParam({ name: 'assignmentId', description: 'Assignment UUID' })
  @ApiResponse({ status: 201, description: 'Termination request created' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the teacher on this assignment' })
  createTermination(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: CreateTerminationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createTermination(assignmentId, dto, user);
  }
}
