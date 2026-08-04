import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StepStatus } from '../../common/enums/step-status.enum';
import { WorkflowStep } from '../entities/workflow-step.entity';

export class WorkflowStepSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  stepOrder: number;

  @ApiProperty()
  stepName: string;

  @ApiProperty()
  targetService: string;

  @ApiProperty()
  action: string;

  @ApiProperty({ enum: StepStatus })
  status: StepStatus;

  @ApiPropertyOptional()
  output?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  error?: string | null;

  @ApiPropertyOptional()
  startedAt?: Date | null;

  @ApiPropertyOptional()
  completedAt?: Date | null;

  static fromEntity(entity: WorkflowStep): WorkflowStepSummaryDto {
    const dto = new WorkflowStepSummaryDto();
    dto.id = entity.id;
    dto.stepOrder = entity.stepOrder;
    dto.stepName = entity.stepName;
    dto.targetService = entity.targetService;
    dto.action = entity.action;
    dto.status = entity.status;
    dto.output = entity.output ?? null;
    dto.error = entity.error ?? null;
    dto.startedAt = entity.startedAt ?? null;
    dto.completedAt = entity.completedAt ?? null;
    return dto;
  }
}
