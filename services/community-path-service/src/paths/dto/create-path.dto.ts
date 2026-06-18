import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePathStepDto {
  @ApiProperty({ description: 'Ordre de l\'étape dans le parcours' })
  order: number;

  @ApiProperty({ description: 'Titre de l\'étape' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Identifiant de la ressource liée (exercice, vidéo, etc.)' })
  @IsOptional()
  @IsString()
  contentReferenceId?: string;

  @ApiPropertyOptional({ description: 'Type de contenu (exercice, evaluation, tuto_video, cours)' })
  @IsOptional()
  @IsString()
  contentType?: string;
}

export class CreatePathDto {
  @ApiProperty({ description: 'Titre du parcours' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Description du parcours' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Niveau scolaire ciblé' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: 'Difficulté' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Thème pédagogique' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'Compétences visées' })
  @IsOptional()
  @IsString()
  competences?: string;

  @ApiPropertyOptional({ description: 'Tags séparés par virgule' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'URL de l\'image de couverture' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [CreatePathStepDto], description: 'Étapes du parcours' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePathStepDto)
  steps?: CreatePathStepDto[];
}
