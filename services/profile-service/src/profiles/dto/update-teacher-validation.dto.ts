import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export type TeacherValidationStatus = 'pending' | 'in_review' | 'validated' | 'rejected';

export class UpdateTeacherValidationDto {
  @ApiProperty({
    description: 'New validation status for the formateur',
    enum: ['pending', 'in_review', 'validated', 'rejected'],
    example: 'validated',
  })
  @IsEnum(['pending', 'in_review', 'validated', 'rejected'], {
    message: 'status must be one of: pending, in_review, validated, rejected',
  })
  status: TeacherValidationStatus;

  @ApiPropertyOptional({
    description: 'Optional comment (e.g. rejection reason or validation notes)',
    example: 'CV et expériences validés par le RP lors de l\'entretien du 15/06.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
