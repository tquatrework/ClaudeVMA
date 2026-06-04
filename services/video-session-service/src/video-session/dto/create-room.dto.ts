import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ description: 'UUID of the linked calendar session' })
  @IsUUID()
  calendarSessionId: string;
}
