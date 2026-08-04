import { ApiProperty } from '@nestjs/swagger';
import { WorkflowStatus } from '../../common/enums/workflow-status.enum';

export class StartWorkflowResponseDto {
  @ApiProperty()
  workflowInstanceId: string;

  @ApiProperty()
  workflowType: string;

  @ApiProperty()
  correlationId: string;

  @ApiProperty({ enum: WorkflowStatus })
  status: WorkflowStatus;

  @ApiProperty()
  startedAt: Date;
}
