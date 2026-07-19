import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RelationsService } from './relations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateFinanceOwnerStudentLinkDto } from './dto/create-finance-owner-student-link.dto';
import { CreateTeacherStudentLinkDto } from './dto/create-teacher-student-link.dto';
import { CreatePedagogicalCoordinatorLinkDto } from './dto/create-pedagogical-coordinator-link.dto';

@ApiTags('relations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('relations')
export class RelationsController {
  constructor(private readonly relationsService: RelationsService) {}

  @Post('finance-owner-student')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ADMINISTRATEUR_FINANCIER)
  @ApiOperation({
    summary: 'Link financeur to student',
    description:
      'Creates a financeur→élève relation. ' +
      'Allowed for RP and AdministrateurFinancier. ' +
      'Publishes StudentLinkedToFinanceOwner event.',
  })
  @ApiResponse({ status: 201, description: 'Link created' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP or AdministrateurFinancier only' })
  @ApiResponse({ status: 409, description: 'Link already exists' })
  linkFinanceOwnerToStudent(
    @Body() dto: CreateFinanceOwnerStudentLinkDto,
    @Request() req,
  ) {
    return this.relationsService.linkFinanceOwnerToStudent(dto, req.user);
  }

  @Get('finance-owner-student/by-student/:studentId')
  @ApiOperation({
    summary: 'List financeurs of a student',
    description:
      'Returns all financeurs (parents) linked to the given student. ' +
      'Accessible to the student themselves, RP, AdministrateurFinancier and TI.',
  })
  @ApiParam({ name: 'studentId', description: 'Student (élève) UUID' })
  @ApiResponse({ status: 200, description: 'List of financeur–student links' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getFinanceOwnersByStudent(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Request() req,
  ) {
    return this.relationsService.getFinanceOwnersByStudent(studentId, req.user);
  }

  @Get('finance-owner-student/:financeOwnerId')
  @ApiOperation({
    summary: 'List students of a financeur',
    description:
      'Returns all élève linked to the given financeur. ' +
      'Accessible to RP, AdministrateurFinancier, TI and the financeur themselves.',
  })
  @ApiParam({ name: 'financeOwnerId', description: 'Financeur UUID' })
  @ApiResponse({ status: 200, description: 'List of financeur–student links' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getStudentsByFinanceOwner(
    @Param('financeOwnerId', ParseUUIDPipe) financeOwnerId: string,
    @Request() req,
  ) {
    return this.relationsService.getStudentsByFinanceOwner(financeOwnerId, req.user);
  }

  @Post('teacher-student')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Link teacher to student',
    description:
      'Creates a formateur→élève relation (PROF-BR-007). ' +
      'Optionally marks the teacher as the principal teacher. ' +
      'Restricted to RP only. ' +
      'Publishes TeacherLinkedToStudent event.',
  })
  @ApiResponse({ status: 201, description: 'Link created' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP only' })
  @ApiResponse({ status: 409, description: 'Link already exists' })
  linkTeacherToStudent(
    @Body() dto: CreateTeacherStudentLinkDto,
    @Request() req,
  ) {
    return this.relationsService.linkTeacherToStudent(dto, req.user);
  }

  @Get('teacher-student/:studentId')
  @ApiOperation({
    summary: 'List teachers of a student',
    description:
      'Returns all formateurs linked to the given student. ' +
      'Accessible to RP, TI, AdministrateurFinancier, the student themselves, ' +
      'any PARENT_FINANCEUR linked to that student, ' +
      'and their linked teachers (own link only, PROF-FB-003).',
  })
  @ApiParam({ name: 'studentId', description: 'Student (élève) UUID' })
  @ApiResponse({ status: 200, description: 'List of teacher–student links' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getTeachersByStudent(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Request() req,
  ) {
    return this.relationsService.getTeachersByStudent(studentId, req.user);
  }

  @Post('pedagogical-coordinator')
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE)
  @ApiOperation({
    summary: 'Assign a pedagogical coordinator to a student',
    description:
      'Links a RP or AP as the pedagogical coordinator for a student. ' +
      'Restricted to RP only.',
  })
  @ApiResponse({ status: 201, description: 'Coordinator link created' })
  @ApiResponse({ status: 403, description: 'Forbidden — RP only' })
  @ApiResponse({ status: 409, description: 'Link already exists' })
  linkPedagogicalCoordinator(
    @Body() dto: CreatePedagogicalCoordinatorLinkDto,
    @Request() req,
  ) {
    return this.relationsService.linkPedagogicalCoordinator(dto, req.user);
  }

  @Get('pedagogical-coordinator/:coordinatorId')
  @ApiOperation({
    summary: 'List students of a coordinator',
    description:
      'Returns all students assigned to the given RP or AP coordinator. ' +
      'Accessible to RP, TI and the coordinator themselves.',
  })
  @ApiParam({ name: 'coordinatorId', description: 'Coordinator (RP or AP) UUID' })
  @ApiResponse({ status: 200, description: 'List of coordinator–student links' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient rights' })
  getStudentsByCoordinator(
    @Param('coordinatorId', ParseUUIDPipe) coordinatorId: string,
    @Request() req,
  ) {
    return this.relationsService.getStudentsByCoordinator(coordinatorId, req.user);
  }
}
