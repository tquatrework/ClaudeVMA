import {
  Controller,
  Get,
  Patch,
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
import { Roles } from '../common/decorators/roles.decorator';
import { OwnerAccess } from '../common/decorators/owner-access.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { FinancialProfilesService } from './financial-profiles.service';
import { FinancialProfile } from './entities/financial-profile.entity';
import { UpdateFinancialProfileDto } from './dto/update-financial-profile.dto';

@ApiTags('financial-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('financial-profiles')
export class FinancialProfilesController {
  constructor(private readonly financialProfilesService: FinancialProfilesService) {}

  @Get(':ownerId')
  @OwnerAccess()
  @ApiParam({ name: 'ownerId', description: 'UUID of the funding owner' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Get a financial profile',
    description:
      'Returns the financial profile of an owner. ' +
      'Access is granted by OWNERSHIP, not by a role allowlist: any authenticated user ' +
      'may read their OWN financial profile, whatever their role — parent_financeur, ' +
      'formateur, animateur_pedagogique or eleve alike. Teachers are paid through this ' +
      'service and therefore need their own financial profile. ' +
      'Reading SOMEONE ELSE\'S profile stays restricted to the privileged roles ' +
      'administrateur_financier, responsable_pedagogique and technicien_informatique. ' +
      'Shows account type (limite/membre), points balance, and payment method. ' +
      'A 404 means "no profile yet" (a normal state, the client may offer to create one), ' +
      'never "not allowed" — the permission check runs first and answers 403.',
  })
  @ApiResponse({ status: 200, description: 'Financial profile found', type: FinancialProfile })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({
    status: 403,
    description: 'Requester is neither the owner nor a privileged role (AF, RP, TI)',
  })
  @ApiResponse({
    status: 404,
    description: 'No financial profile exists for this owner yet (normal state, not an access error)',
  })
  getFinancialProfile(
    @Param('ownerId') ownerId: string,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<FinancialProfile> {
    return this.financialProfilesService.findByOwnerId(ownerId, req.user.id, req.user.role);
  }

  @Patch(':ownerId')
  @Roles(UserRole.PARENT_FINANCEUR, UserRole.ADMINISTRATEUR_FINANCIER, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiParam({ name: 'ownerId', description: 'UUID of the funding owner' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Update a financial profile',
    description:
      'Update payment method, payment reference, or funding end date. ' +
      'WRITE access is deliberately narrower than read access and is NOT ownership-based: ' +
      'the caller must hold one of the roles parent_financeur, administrateur_financier or ' +
      'technicien_informatique, and on top of that be the owner (parent_financeur) or a ' +
      'privileged role (AF, TI). ' +
      'Consequence, stated explicitly: a formateur or animateur_pedagogique can READ their own ' +
      'financial profile but cannot yet WRITE it — opening that is a separate decision. ' +
      'Profile type transitions (limite -> membre) are managed by the payment flow.',
  })
  @ApiResponse({ status: 200, description: 'Financial profile updated', type: FinancialProfile })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({
    status: 403,
    description: 'Role not allowed to write, or requester is neither the owner nor AF/TI',
  })
  @ApiResponse({ status: 404, description: 'Financial profile not found' })
  updateFinancialProfile(
    @Param('ownerId') ownerId: string,
    @Body() dto: UpdateFinancialProfileDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<FinancialProfile> {
    return this.financialProfilesService.update(ownerId, dto, req.user.id, req.user.role);
  }
}
