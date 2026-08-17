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
  initializeDashboard(@Body() dto: InitializeDashboardDto): Promise<DashboardPreferenceResponseDto> {
    return this.dashboardService.initializeDashboard({ id: dto.userId, role: dto.role });
  }

  @Post('notify')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Send a notification to a user or role',
    description:
      'Called by orchestration-service to push a notification. ' +
      'Provide either targetUserId or targetRole (not both). ' +
      'When targetRole is provided, one notification record is created per real account currently ' +
      'holding that role (resolved via identity-access-service, the sole owner of the role) — a real ' +
      "fan-out, not the former single row keyed by a synthetic userId=\"role:<role>\" that never " +
      'matched a real account. See docs/architecture.md > "Propriete du role" and ' +
      'docs/services/dashboard-notification-service.md (correctif 2026-08-17).',
  })
  @ApiResponse({ status: 201, description: 'Notification(s) created', type: NotificationResponseDto, isArray: true })
  @ApiResponse({ status: 400, description: 'Neither targetUserId nor targetRole provided' })
  @ApiResponse({ status: 401, description: 'Missing or invalid X-Internal-Secret' })
  async notify(@Body() dto: InternalNotifyDto): Promise<NotificationResponseDto[]> {
    if (!dto.targetUserId && !dto.targetRole) {
      throw new BadRequestException('Either targetUserId or targetRole must be provided');
    }

    const payload = {
      type: dto.type as NotificationType,
      title: dto.title,
      message: dto.message,
      metadata: dto.metadata,
    };

    if (dto.targetRole) {
      return this.notificationService.createForRole(dto.targetRole, payload);
    }

    const notification = await this.notificationService.create({ userId: dto.targetUserId as string, ...payload });
    return [notification];
  }
}
