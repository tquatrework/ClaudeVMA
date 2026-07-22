import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { DashboardPreferenceResponseDto } from './dto/dashboard-preference-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('dashboards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboards')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get my dashboard',
    description:
      'Returns a role-contextualised dashboard with widget references and recent notifications. ' +
      'Widget data is referenced by service name — the frontend fetches each widget data independently. ' +
      'DASH-FB-001: parent_financeur view never includes personal notebook data.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard returned', type: DashboardResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyDashboard(@CurrentUser() user: AuthUser): Promise<DashboardResponseDto> {
    return this.service.getMyDashboard({ id: user.id, role: user.role });
  }

  @Put('me/preferences')
  @ApiOperation({
    summary: 'Update my dashboard preferences',
    description: 'Saves the widget configuration for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Preferences saved', type: DashboardPreferenceResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<DashboardPreferenceResponseDto> {
    return this.service.updatePreferences({ id: user.id, role: user.role }, dto);
  }
}
