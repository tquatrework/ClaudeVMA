import { ApiProperty } from '@nestjs/swagger';

export class UnreadCountResponseDto {
  @ApiProperty({ description: 'Number of unread notifications for the authenticated user' })
  count: number;
}
