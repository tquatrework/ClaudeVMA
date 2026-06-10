import { IsUUID, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitializeDashboardDto {
  @ApiProperty({ description: 'User UUID to initialize dashboard for' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'User role', example: 'eleve' })
  @IsString()
  role: string;
}
