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
import { FinancialProfilesService } from './financial-profiles.service';
import { UpdateFinancialProfileDto } from './dto/update-financial-profile.dto';

@ApiTags('financial-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('financial-profiles')
export class FinancialProfilesController {
  constructor(private readonly financialProfilesService: FinancialProfilesService) {}

  @Get(':ownerId')
  @ApiParam({ name: 'ownerId', description: 'UUID of the funding owner' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Get a financial profile',
    description:
      'Returns the financial profile of a funding owner. ' +
      'Accessible by the owner themselves, AF, RP, or TI. ' +
      'Shows account type (limite/membre), points balance, and payment method.',
  })
  @ApiResponse({ status: 200, description: 'Financial profile found' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Financial profile not found' })
  getFinancialProfile(
    @Param('ownerId') ownerId: string,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.financialProfilesService.findByOwnerId(ownerId, req.user.id, req.user.role);
  }

  @Patch(':ownerId')
  @ApiParam({ name: 'ownerId', description: 'UUID of the funding owner' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Update a financial profile',
    description:
      'Update payment method, payment reference, or funding end date. ' +
      'Allowed for the owner themselves, AF, or TI. ' +
      'Profile type transitions (limite → membre) are managed by the payment flow.',
  })
  @ApiResponse({ status: 200, description: 'Financial profile updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Financial profile not found' })
  updateFinancialProfile(
    @Param('ownerId') ownerId: string,
    @Body() dto: UpdateFinancialProfileDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.financialProfilesService.update(ownerId, dto, req.user.id, req.user.role);
  }
}
