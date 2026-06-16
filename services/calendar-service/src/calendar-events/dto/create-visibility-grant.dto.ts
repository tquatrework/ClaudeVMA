import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateVisibilityGrantDto {
  @ApiProperty({ description: 'User ID to grant read access to this calendar' })
  @IsUUID('4')
  granteeId: string;
}
