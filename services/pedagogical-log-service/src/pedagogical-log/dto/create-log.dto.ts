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
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LogVisibility } from '../entities/pedagogical-log.entity';

const VISIBILITY_VALUES: LogVisibility[] = [
  'eleve_parent_formateur',
  'eleve_formateur',
  'formateur_rp',
  'special',
];

export class LinkedResourceDto {
  @ApiProperty({ description: 'Type de ressource (exercice, evaluation, tuto, visio…)' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'UUID de la ressource' })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({ description: 'Libellé affiché' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateLogDto {
  @ApiProperty({ description: "UUID de l'élève concerné" })
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: "Contenu de l'entrée pédagogique (texte riche ou LaTeX)" })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({
    enum: ['eleve_parent_formateur', 'eleve_formateur', 'formateur_rp', 'special'],
    default: 'eleve_parent_formateur',
    description: "Règle de visibilité de l'entrée (PLOG-BR-006)",
  })
  @IsOptional()
  @IsIn(VISIBILITY_VALUES)
  visibility?: LogVisibility;

  @ApiPropertyOptional({
    description:
      "Masquer cette page à l'élève (pages spéciales parent/financeur). XML spec func 003.",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hiddenFromStudent?: boolean;

  @ApiPropertyOptional({
    type: [LinkedResourceDto],
    description: 'Liens vers exercices, évaluations, tutos, parcours ou visios. XML spec func 002.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkedResourceDto)
  linkedResources?: Array<{ type: string; id: string; label?: string }>;

  @ApiPropertyOptional({ description: "UUID de l'activité ou séance associée" })
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
