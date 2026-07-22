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
import { DashboardWidgetDto } from './dto/dashboard-widget.dto';
import { NotificationResponseDto } from '../notification/dto/notification-response.dto';
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
  async getMyDashboard(@CurrentUser() user: AuthUser): Promise<DashboardResponseDto> {
    const dashboard = await this.service.getMyDashboard(user.id, user.role);

    const response = new DashboardResponseDto();
    response.userId = dashboard.userId;
    response.role = dashboard.role;
    response.widgets = dashboard.widgets.map((widget) => DashboardWidgetDto.fromWidget(widget));
    response.notifications = dashboard.notifications.map((notification) =>
      NotificationResponseDto.fromEntity(notification),
    );
    response.generatedAt = dashboard.generatedAt;
    return response;
  }

  @Put('me/preferences')
  @ApiOperation({
    summary: 'Update my dashboard preferences',
    description: 'Saves the widget configuration for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Preferences saved', type: DashboardPreferenceResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<DashboardPreferenceResponseDto> {
    const preference = await this.service.updatePreferences(user.id, user.role, dto);
    return DashboardPreferenceResponseDto.fromEntity(preference);
  }
}
