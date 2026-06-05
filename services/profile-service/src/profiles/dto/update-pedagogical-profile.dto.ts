import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsBoolean, MaxLength } from 'class-validator';

/** DTO for updating a student's pedagogical profile */
export class UpdateStudentPedagogicalProfileDto {
  @ApiPropertyOptional({ description: 'School level (e.g. "3ème", "Terminale")', example: 'Terminale' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  niveauScolaire?: string;

  @ApiPropertyOptional({ description: 'Subjects being studied', example: ['Mathématiques', 'Physique'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  matieres?: string[];

  @ApiPropertyOptional({ description: 'Pedagogical objectives', example: 'Préparer le bac S mention TB' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  objectifsPedagogiques?: string;

  @ApiPropertyOptional({ description: 'Specific learning needs', example: 'Dyslexie légère' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  besoinsSpecifiques?: string;
}

/** DTO for updating a teacher's pedagogical profile */
export class UpdateTeacherPedagogicalProfileDto {
  @ApiPropertyOptional({ description: 'School levels taught', example: ['Collège', 'Lycée'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  niveauxEnseignes?: string[];

  @ApiPropertyOptional({ description: 'Subjects taught', example: ['Mathématiques', 'Physique-Chimie'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  matieresEnseignees?: string[];

  @ApiPropertyOptional({ description: 'Pedagogical experience description', example: '5 ans de cours particuliers au lycée' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  experiencePedagogique?: string;

  @ApiPropertyOptional({ description: 'Test and evaluation results summary', example: 'Score moyen 87/100' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resultatsTests?: string;

  @ApiPropertyOptional({ description: 'PROF-BR-008: whether the teacher is also an Animateur Pédagogique. Use POST /ap-status instead to promote.' })
  @IsOptional()
  @IsBoolean()
  isAnimateurPedagogique?: boolean;
}
