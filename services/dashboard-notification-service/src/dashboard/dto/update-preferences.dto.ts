import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiProperty({
    description: 'Widget configuration as a free-form JSON object',
    example: { showCalendar: true, showNotifications: true, compactView: false },
  })
  @IsObject()
  widgetConfig: Record<string, unknown>;
}
