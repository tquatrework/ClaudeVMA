import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class CreateTeacherStudentLinkDto {
  @ApiProperty({ description: 'UUID of the formateur account', example: 'a1b2c3d4-...' })
  @IsUUID()
  teacherId: string;

  @ApiProperty({ description: 'UUID of the eleve account to link', example: 'e5f6g7h8-...' })
  @IsUUID()
  studentId: string;

  @ApiPropertyOptional({
    description: 'PROF-BR-007: mark this teacher as the principal (référent) teacher for the student',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrincipalTeacher?: boolean;
}
