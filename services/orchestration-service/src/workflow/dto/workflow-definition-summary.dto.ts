import { ApiProperty } from '@nestjs/swagger';

export class WorkflowDefinitionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phase: number;

  @ApiProperty()
  stepCount: number;
}
