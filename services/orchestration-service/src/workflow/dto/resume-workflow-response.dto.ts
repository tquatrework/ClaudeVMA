import { ApiProperty } from '@nestjs/swagger';

export class ResumeWorkflowResponseDto {
  @ApiProperty()
  workflowInstanceId: string;

  @ApiProperty({ example: 'in_progress' })
  status: string;

  @ApiProperty()
  tiOverride: boolean;
}
