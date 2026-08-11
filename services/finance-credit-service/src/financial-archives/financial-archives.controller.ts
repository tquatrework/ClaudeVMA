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
import { OwnerAccess } from '../common/decorators/owner-access.decorator';
import { FinancialArchivesService } from './financial-archives.service';
import { FinancialArchiveItem } from './entities/financial-archive-item.entity';

@ApiTags('financial-archives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('financial-archives')
export class FinancialArchivesController {
  constructor(private readonly financialArchivesService: FinancialArchivesService) {}

  @Get(':ownerId')
  @OwnerAccess()
  @ApiParam({ name: 'ownerId', description: 'UUID of the owner' })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'List financial archive items for an owner',
    description:
      'Returns all financial events (payments, invoices, ledger entries) for an owner, ' +
      'ordered by most recent first. ' +
      'Access is granted by OWNERSHIP, not by a role allowlist: any authenticated user may ' +
      'list their OWN financial archives, whatever their role — parent_financeur, formateur, ' +
      'animateur_pedagogique or eleve alike. Teachers are paid through this service and ' +
      'therefore have financial archives of their own. ' +
      'Listing SOMEONE ELSE\'S archives stays restricted to the privileged roles ' +
      'administrateur_financier, responsable_pedagogique and technicien_informatique. ' +
      'An owner with no financial event yet gets an empty array with status 200, never an error. ' +
      'FIN-FB-002: each item includes a label, amount, and balance snapshot.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of financial archive items (empty array when there is no event yet)',
    type: [FinancialArchiveItem],
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({
    status: 403,
    description: 'Requester is neither the owner nor a privileged role (AF, RP, TI)',
  })
  listFinancialArchives(
    @Param('ownerId') ownerId: string,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<FinancialArchiveItem[]> {
    return this.financialArchivesService.findAllByOwner(ownerId, req.user.id, req.user.role);
  }
}
