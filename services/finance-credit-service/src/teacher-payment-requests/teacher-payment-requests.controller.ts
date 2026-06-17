import {
  Controller,
  Post,
  Get,
  Param,
  Body,
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
import { TeacherPaymentRequestsService } from './teacher-payment-requests.service';
import { CreateTeacherPaymentRequestDto } from './dto/create-teacher-payment-request.dto';
import { ValidateTeacherPaymentRequestDto } from './dto/validate-teacher-payment-request.dto';

@ApiTags('teacher-payment-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teacher-payment-requests')
export class TeacherPaymentRequestsController {
  constructor(
    private readonly teacherPaymentRequestsService: TeacherPaymentRequestsService,
  ) {}

  @Post()
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Submit a teacher payment request',
    description:
      'A formateur submits a payment request with an optional invoice reference. ' +
      'The request starts in PENDING status and must be validated by AF. ' +
      'Supports idempotency key to prevent duplicate submissions. ' +
      'Publishes TeacherPaymentRequested event.',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment request created — emits TeacherPaymentRequested event',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 409, description: 'Duplicate idempotency key' })
  createRequest(
    @Body() dto: CreateTeacherPaymentRequestDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.teacherPaymentRequestsService.createRequest(req.user.id, dto, correlationId);
  }

  @Post(':id/validate')
  @ApiParam({ name: 'id', description: 'UUID of the teacher payment request' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Validate or reject a teacher payment request (AF only)',
    description:
      'The Administrateur Financier (AF) validates or rejects a teacher payment request. ' +
      'FIN-AC-003: on validation, financial points are debited from the funding owner, ' +
      'an archive entry is created, and a TeacherPaymentValidated event is published. ' +
      'On rejection, a PaymentIncidentDetected event is published and a rejection reason is required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Request validated or rejected — emits TeacherPaymentValidated or PaymentIncidentDetected',
  })
  @ApiResponse({ status: 400, description: 'Missing rejection reason on reject decision' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Only AF can validate payment requests' })
  @ApiResponse({ status: 404, description: 'Payment request not found' })
  @ApiResponse({ status: 409, description: 'Request already processed' })
  validateRequest(
    @Param('id') requestId: string,
    @Body() dto: ValidateTeacherPaymentRequestDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.teacherPaymentRequestsService.validateRequest(
      requestId,
      dto,
      req.user.id,
      req.user.role,
      correlationId,
    );
  }

  @Get('by-teacher/:teacherId')
  @ApiParam({ name: 'teacherId', description: 'UUID of the teacher' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'List payment requests for a teacher',
    description:
      'Returns all payment requests submitted by a given teacher, ordered by most recent first. ' +
      'Accessible by the teacher themselves, AF, RP, or TI.',
  })
  @ApiResponse({ status: 200, description: 'List of teacher payment requests' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  findByTeacher(
    @Param('teacherId') teacherId: string,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.teacherPaymentRequestsService.findByTeacher(
      teacherId,
      req.user.id,
      req.user.role,
    );
  }
}
