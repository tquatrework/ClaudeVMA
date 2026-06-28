import {
  Controller,
  Get,
  Param,
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
import { UserRole } from '../common/enums/user-role.enum';
import { FinancialArchivesService } from './financial-archives.service';

@ApiTags('financial-archives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('financial-archives')
export class FinancialArchivesController {
  constructor(private readonly financialArchivesService: FinancialArchivesService) {}

  @Get(':ownerId')
  @Roles(UserRole.PARENT_FINANCEUR, UserRole.ADMINISTRATEUR_FINANCIER, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiParam({ name: 'ownerId', description: 'UUID of the funding owner' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'List financial archive items for an owner',
    description:
      'Returns all financial events (payments, invoices, ledger entries) for a funding owner, ' +
      'ordered by most recent first. ' +
      'Accessible by the owner themselves, AF, RP, or TI. ' +
      'FIN-FB-002: each item includes a label, amount, and balance snapshot.',
  })
  @ApiResponse({ status: 200, description: 'List of financial archive items' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  // accès filtré par ownership dans le service
  listFinancialArchives(
    @Param('ownerId') ownerId: string,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.financialArchivesService.findAllByOwner(ownerId, req.user.id, req.user.role);
  }
}
