import { ApiProperty } from '@nestjs/swagger';
import { DashboardPreference } from '../entities/dashboard-preference.entity';

export class DashboardPreferenceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  role: string;

  @ApiProperty({
    description: 'Widget configuration as a free-form JSON object',
    example: { showCalendar: true, showNotifications: true, compactView: false },
  })
  widgetConfig: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(preference: DashboardPreference): DashboardPreferenceResponseDto {
    const response = new DashboardPreferenceResponseDto();
    response.id = preference.id;
    response.userId = preference.userId;
    response.role = preference.role;
    response.widgetConfig = preference.widgetConfig;
    response.createdAt = preference.createdAt;
    response.updatedAt = preference.updatedAt;
    return response;
  }
}
