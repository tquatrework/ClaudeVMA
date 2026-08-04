import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  service: string;

  @ApiProperty()
  timestamp: string;
}
