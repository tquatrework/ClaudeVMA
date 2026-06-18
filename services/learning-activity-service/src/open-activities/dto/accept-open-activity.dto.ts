import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptOpenActivityDto {
  @ApiPropertyOptional({ description: 'Identifiant de l\'événement calendrier créé lors de l\'acceptation' })
  @IsOptional()
  @IsString()
  calendarEventId?: string;
}
