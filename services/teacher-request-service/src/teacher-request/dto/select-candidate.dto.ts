import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SelectCandidateDto {
  @ApiProperty({ description: 'UUID of the TeacherProposal chosen by the client (ELEVE or PARENT_FINANCEUR)' })
  @IsUUID()
  proposalId: string;
}
