import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Headers,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialSettingsService } from './financial-settings.service';
import { UpdateRewardSettingsDto } from './dto/update-reward-settings.dto';

@ApiTags('financial-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('financial-settings')
export class FinancialSettingsController {
  constructor(private readonly financialSettingsService: FinancialSettingsService) {}

  @Get('rewards')
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Get all reward settings (AF only)',
    description:
      'Returns all configurable reward and pricing settings. ' +
      'FIN-FB-003: accessible only by the Administrateur Financier (AF).',
  })
  @ApiResponse({ status: 200, description: 'List of reward settings' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Only AF can access reward settings' })
  getRewardSettings(
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.financialSettingsService.findAllSettings(req.user.role);
  }

  @Patch('rewards')
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'Update reward settings (AF only)',
    description:
      'Upsert one or more reward/price settings. ' +
      'FIN-FB-003: only the Administrateur Financier can modify these values. ' +
      'Publishes RewardSettingUpdated event after update.',
  })
  @ApiResponse({
    status: 200,
    description: 'Settings updated — emits RewardSettingUpdated event',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Only AF can modify reward settings' })
  updateRewardSettings(
    @Body() dto: UpdateRewardSettingsDto,
    @Req() req: any,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.financialSettingsService.upsertSettings(
      dto,
      req.user.id,
      req.user.role,
      correlationId,
    );
  }
}

@ApiTags('finance-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance-events')
export class FinanceEventsController {
  constructor(private readonly financialSettingsService: FinancialSettingsService) {}

  @Get()
  @ApiQuery({
    name: 'ownerId',
    required: false,
    description: 'Filter events by funding owner UUID',
  })
  @ApiHeader({ name: 'x-correlation-id', required: false })
  @ApiOperation({
    summary: 'List all financial events (AF only)',
    description:
      'Returns a chronological list of all financial events (payments, ledger entries, archives). ' +
      'FIN-FB-003: the AF interface for tri, filtre, export and synthese statistique. ' +
      'Optional ownerId query parameter to filter by funding owner.',
  })
  @ApiResponse({ status: 200, description: 'List of finance events' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Only AF can access finance events' })
  getFinanceEvents(
    @Req() req: any,
    @Query('ownerId') ownerId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.financialSettingsService.getFinanceEvents(req.user.role, ownerId);
  }
}
