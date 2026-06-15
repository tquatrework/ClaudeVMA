import {
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsIn,
  IsNotEmpty,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LogVisibility } from '../entities/pedagogical-log.entity';

const VISIBILITY_VALUES: LogVisibility[] = [
  'eleve_parent_formateur',
  'eleve_formateur',
  'formateur_rp',
  'special',
];

export class CreateLogDto {
  @ApiProperty({ description: 'UUID de l\'élève concerné' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: 'Contenu de l\'entrée pédagogique' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({
    enum: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
    default: 'eleve_parent_formateur',
    description: 'Règle de visibilité de l\'entrée (PLOG-BR-006)',
  })
  @IsOptional()
  @IsIn(VISIBILITY_VALUES)
  visibility?: LogVisibility;

  @ApiPropertyOptional({ description: 'UUID de l\'activité ou séance associée' })
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiPropertyOptional({ description: 'UUID de la session visio associée' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ type: [String], example: ['dérivées', 'intégrales'] })
  @IsOptional()
  @IsArray()
  skillsWorked?: string[];

  @ApiPropertyOptional({ example: 'intermédiaire' })
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
