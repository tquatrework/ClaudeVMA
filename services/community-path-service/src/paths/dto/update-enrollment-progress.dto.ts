import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { EnrollmentStatus } from '../../common/enums/enrollment-status.enum';

export class UpdateEnrollmentProgressDto {
  @ApiPropertyOptional({ description: 'Identifiant de l\'étape terminée' })
  @IsOptional()
  @IsString()
  completedStepId?: string;

  @ApiPropertyOptional({ enum: EnrollmentStatus, description: 'Nouveau statut de l\'inscription' })
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;
}
