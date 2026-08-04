import { ApiProperty } from '@nestjs/swagger';

export class DeleteNotificationResponseDto {
  @ApiProperty()
  deleted: boolean;
}
