import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { InternalGuard } from '../common/guards/internal.guard';
import { DashboardService } from '../dashboard/dashboard.service';
import { NotificationService } from '../notification/notification.service';
import { InitializeDashboardDto } from './dto/initialize-dashboard.dto';
import { InternalNotifyDto } from './dto/internal-notify.dto';
import { NotificationType } from '../notification/entities/notification.entity';
import { NotificationResponseDto } from '../notification/dto/notification-response.dto';
import { DashboardPreferenceResponseDto } from '../dashboard/dto/dashboard-preference-response.dto';

@ApiTags('internal')
@ApiSecurity('x-internal-secret')
@UseGuards(InternalGuard)
@Controller('internal')
export class InternalController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly notificationService: NotificationService,
  ) {}

  @Post('initialize-dashboard')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Initialize dashboard for a new user',
    description:
      'Called by orchestration-service during student or teacher onboarding. ' +
      'Creates default DashboardPreference. Idempotent — safe to call multiple times.',
  })
  @ApiResponse({ status: 201, description: 'Dashboard initialized', type: DashboardPreferenceResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Internal-Secret' })
  async initializeDashboard(@Body() dto: InitializeDashboardDto): Promise<DashboardPreferenceResponseDto> {
    const preference = await this.dashboardService.initializeDashboard(dto.userId, dto.role);
    return DashboardPreferenceResponseDto.fromEntity(preference);
  }

  @Post('notify')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Send a notification to a user or role',
    description:
      'Called by orchestration-service to push a notification. ' +
      'Provide either targetUserId or targetRole (not both). ' +
      'When targetRole is provided, a single notification record is created with userId set to the role value — ' +
      'the frontend filters by role until a full fan-out mechanism is in place.',
  })
  @ApiResponse({ status: 201, description: 'Notification created', type: NotificationResponseDto })
  @ApiResponse({ status: 400, description: 'Neither targetUserId nor targetRole provided' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Internal-Secret' })
  async notify(@Body() dto: InternalNotifyDto): Promise<NotificationResponseDto> {
    if (!dto.targetUserId && !dto.targetRole) {
      throw new BadRequestException('Either targetUserId or targetRole must be provided');
    }

    const userId = dto.targetUserId ?? `role:${dto.targetRole}`;

    const notification = await this.notificationService.create({
      userId,
      type: dto.type as NotificationType,
      title: dto.title,
      message: dto.message,
      metadata: dto.metadata,
    });
    return NotificationResponseDto.fromEntity(notification);
  }
}
