import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LogVisibility } from '../entities/pedagogical-log.entity';

const VISIBILITY_VALUES: LogVisibility[] = [
  'eleve_parent_formateur',
  'eleve_formateur',
  'formateur_rp',
  'special',
];

export class UpdateLogDto {
  @ApiPropertyOptional({ description: 'Contenu de l\'entrée pédagogique' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    enum: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
  })
  @IsOptional()
  @IsIn(VISIBILITY_VALUES)
  visibility?: LogVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  skillsWorked?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;
}
