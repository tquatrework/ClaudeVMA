import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartWorkflowDto {
  @ApiProperty({ example: 'student-onboarding', description: 'Identifiant du type de workflow' })
  @IsString()
  @IsNotEmpty()
  workflowType: string;

  @ApiProperty({ description: 'Données initiales du workflow' })
  @IsObject()
  payload: Record<string, any>;

  @ApiPropertyOptional({ description: 'Identifiant de l\'utilisateur déclencheur' })
  @IsOptional()
  @IsString()
  initiatedBy?: string;

  @ApiPropertyOptional({ description: 'correlationId à propager (généré si absent)' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}
