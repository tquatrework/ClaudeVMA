import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' }) status: string;
  @ApiProperty({ example: 'communication-service' }) service: string;
  @ApiProperty({ example: '2026-07-22T10:00:00.000Z' }) timestamp: string;
}
