import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateFinanceOwnerStudentLinkDto {
  @ApiProperty({ description: 'UUID of the parent_financeur account', example: 'a1b2c3d4-...' })
  @IsUUID()
  financeOwnerId: string;

  @ApiProperty({ description: 'UUID of the eleve account to link', example: 'e5f6g7h8-...' })
  @IsUUID()
  studentId: string;
}
