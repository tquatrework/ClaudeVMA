import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowStatus } from '../../common/enums/workflow-status.enum';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { WorkflowStep } from '../entities/workflow-step.entity';
import { WorkflowStepSummaryDto } from './workflow-step-summary.dto';

export class WorkflowInstanceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workflowType: string;

  @ApiProperty()
  correlationId: string;

  @ApiProperty({ enum: WorkflowStatus })
  status: WorkflowStatus;

  @ApiPropertyOptional()
  error?: string | null;

  @ApiPropertyOptional()
  initiatedBy?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [WorkflowStepSummaryDto] })
  steps: WorkflowStepSummaryDto[];

  static fromEntity(
    entity: WorkflowInstance,
    steps: WorkflowStep[],
  ): WorkflowInstanceResponseDto {
    const dto = new WorkflowInstanceResponseDto();
    dto.id = entity.id;
    dto.workflowType = entity.workflowType;
    dto.correlationId = entity.correlationId;
    dto.status = entity.status;
    dto.error = entity.error ?? null;
    dto.initiatedBy = entity.initiatedBy ?? null;
    dto.createdAt = entity.createdAt;
    dto.steps = steps.map((step) => WorkflowStepSummaryDto.fromEntity(step));
    return dto;
  }
}
