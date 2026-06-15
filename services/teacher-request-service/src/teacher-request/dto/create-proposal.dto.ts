import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProposalDto {
  @ApiProperty({ description: 'Teacher (formateur) UUID to redirect this request to' })
  @IsUUID()
  teacherId: string;

  @ApiPropertyOptional({ description: 'Note about teacher availability' })
  @IsOptional()
  @IsString()
  availabilityNote?: string;
}
