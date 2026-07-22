import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SuspendWorkflowDto {
  @ApiProperty({ description: 'Motif de la suspension (arbitrage utilisateur requis)' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
