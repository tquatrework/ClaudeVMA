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
import { ParentLinkRequestsService } from './parent-link-requests.service';
import { CreateParentLinkRequestDto } from './dto/create-parent-link-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('parent-link-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parent-link-requests')
export class ParentLinkRequestsController {
  constructor(private readonly parentLinkRequestsService: ParentLinkRequestsService) {}

  @Post()
  @Roles(UserRole.PARENT_FINANCEUR)
  @ApiOperation({
    summary: 'Submit a parent-link request',
    description:
      'Allows a parent_financeur to request linkage to a student by providing the student\'s UUID. ' +
      'The student ID must be obtained through out-of-platform means. ' +
      'Returns 400 if the student profile is not found. ' +
      'Returns 409 if a pending request already exists for this parent–student pair. ' +
      'Triggers a best-effort notification to the student.',
  })
  @ApiResponse({ status: 201, description: 'Parent-link request created' })
  @ApiResponse({ status: 400, description: 'Student profile not found for the given studentId' })
  @ApiResponse({ status: 403, description: 'Forbidden — parent_financeur only' })
  @ApiResponse({ status: 409, description: 'A pending request already exists for this pair' })
  createRequest(@Body() dto: CreateParentLinkRequestDto, @Request() req) {
    return this.parentLinkRequestsService.createRequest(dto, req.user);
  }

  @Get()
  @Roles(
    UserRole.PARENT_FINANCEUR,
    UserRole.ELEVE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: 'List parent-link requests (role-filtered)',
    description:
      'Returns parent-link requests filtered by the caller\'s role: ' +
      'parent_financeur sees only their own requests, ' +
      'eleve sees only requests targeting them, ' +
      'responsable_pedagogique and technicien_informatique see all requests.',
  })
  @ApiResponse({ status: 200, description: 'List of parent-link requests' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  listRequests(@Request() req) {
    return this.parentLinkRequestsService.listRequests(req.user);
  }

  @Post(':id/approve')
  @Roles(
    UserRole.ELEVE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: 'Approve a parent-link request',
    description:
      'Approves the request and creates the finance-owner–student link. ' +
      'Allowed for the targeted élève (matching studentId), RP, or TI. ' +
      'Returns 403 if the eleve calling is not the targeted student. ' +
      'Returns 404 if the request is not found. ' +
      'Returns 409 if the request is not in pending status. ' +
      'Triggers a best-effort notification to the parent.',
  })
  @ApiParam({ name: 'id', description: 'Parent-link request UUID' })
  @ApiResponse({ status: 201, description: 'Request approved and link created' })
  @ApiResponse({ status: 403, description: 'Forbidden — eleve must be the targeted student' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 409, description: 'Request is not pending' })
  approveRequest(@Param('id', ParseUUIDPipe) requestId: string, @Request() req) {
    return this.parentLinkRequestsService.approveRequest(requestId, req.user);
  }

  @Post(':id/reject')
  @Roles(
    UserRole.ELEVE,
    UserRole.RESPONSABLE_PEDAGOGIQUE,
    UserRole.TECHNICIEN_INFORMATIQUE,
  )
  @ApiOperation({
    summary: 'Reject a parent-link request',
    description:
      'Rejects the parent-link request without creating any link. ' +
      'Allowed for the targeted élève (matching studentId), RP, or TI. ' +
      'Returns 403 if the eleve calling is not the targeted student. ' +
      'Returns 404 if the request is not found. ' +
      'Returns 409 if the request is not in pending status. ' +
      'Triggers a best-effort notification to the parent.',
  })
  @ApiParam({ name: 'id', description: 'Parent-link request UUID' })
  @ApiResponse({ status: 201, description: 'Request rejected' })
  @ApiResponse({ status: 403, description: 'Forbidden — eleve must be the targeted student' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 409, description: 'Request is not pending' })
  rejectRequest(@Param('id', ParseUUIDPipe) requestId: string, @Request() req) {
    return this.parentLinkRequestsService.rejectRequest(requestId, req.user);
  }
}
