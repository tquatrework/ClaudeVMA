import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ResumeWorkflowDto {
  @ApiPropertyOptional({ description: 'Forçage TI sans accord utilisateur (audité) — ORCH-BR-007' })
  @IsOptional()
  @IsBoolean()
  tiOverride?: boolean;
}
