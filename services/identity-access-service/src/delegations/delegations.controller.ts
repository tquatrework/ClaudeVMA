import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { DelegationsService } from './delegations.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { DelegatedAccessRequest } from './entities/delegated-access-request.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('delegations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
@Controller('delegations')
export class DelegationsController {
  constructor(private readonly delegationsService: DelegationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create delegation request',
    description:
      'RP or TI creates a delegated-action request targeting another user account. ' +
      'Every request is audit-logged. Requires user consent when applicable.',
  })
  @ApiResponse({ status: 201, description: 'Delegation request created and logged' })
  @ApiResponse({ status: 403, description: 'Only RP or TI can create delegations' })
  @ApiResponse({ status: 404, description: 'Target account not found' })
  createDelegation(
    @Body() dto: CreateDelegationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DelegatedAccessRequest> {
    return this.delegationsService.createDelegation(dto, actor);
  }

  @Get()
  @ApiOperation({
    summary: 'List my delegation requests',
    description: 'Return all delegation requests created by the authenticated RP or TI actor.',
  })
  @ApiResponse({ status: 200, description: 'List of delegation requests' })
  @ApiResponse({ status: 403, description: 'Only RP or TI can list delegations' })
  listDelegations(@CurrentUser() actor: AuthenticatedUser): Promise<DelegatedAccessRequest[]> {
    return this.delegationsService.listDelegations(actor);
  }
}
