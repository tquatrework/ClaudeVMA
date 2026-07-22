import { ApiProperty } from '@nestjs/swagger';
import { DashboardWidgetDto } from './dashboard-widget.dto';
import { NotificationResponseDto } from '../../notification/dto/notification-response.dto';

export class DashboardResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  role: string;

  @ApiProperty({ type: [DashboardWidgetDto] })
  widgets: DashboardWidgetDto[];

  @ApiProperty({ type: [NotificationResponseDto] })
  notifications: NotificationResponseDto[];

  @ApiProperty()
  generatedAt: string;
}
