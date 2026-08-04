import { ApiProperty } from '@nestjs/swagger';

export class SuspendWorkflowResponseDto {
  @ApiProperty()
  workflowInstanceId: string;

  @ApiProperty({ example: 'needs_arbitration' })
  status: string;

  @ApiProperty()
  reason: string;
}
