import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ReminderDelay } from '../entities/reminder-rule.entity';

export class ConfigureReminderDto {
  @ApiProperty({
    enum: ReminderDelay,
    description: 'Reminder delay before the event. Valid values: 1week, 1day, 1hour, 15min, none',
    example: ReminderDelay.ONE_HOUR,
  })
  @IsEnum(ReminderDelay)
  delay: ReminderDelay;
}
