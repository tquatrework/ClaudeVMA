import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsBoolean, MaxLength } from 'class-validator';

/**
 * Body de PUT /profiles/:userId/pedagogical — DTO unique couvrant les champs
 * élève ET formateur.
 *
 * Pourquoi une seule classe et non deux ? Le contrôleur typait auparavant le
 * body en union TypeScript (`UpdateStudentPedagogicalProfileDto |
 * UpdateTeacherPedagogicalProfileDto`). Une union n'existe pas à l'exécution :
 * `ValidationPipe` ne pouvait résoudre aucun metatype et **désactivait
 * totalement la validation** sur cette route. Conséquences constatées en
 * conditions réelles : `whitelist`/`forbidNonWhitelisted` inopérants (un body
 * entièrement inconnu renvoyait 200 au lieu de 400), et le corps brut atteignait
 * le service. Une classe concrète unique rétablit la validation.
 *
 * Le service choisit ensuite la table cible (élève ou formateur) à partir des
 * champs présents — voir ProfilesService.updatePedagogicalProfile.
 */
export class UpdatePedagogicalProfileDto {
  // --- Champs du profil élève ----------------------------------------------

  @ApiPropertyOptional({
    description: 'Student only — school level being studied (e.g. "3ème", "Terminale")',
    example: 'Terminale',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  level?: string;

  @ApiPropertyOptional({
    description: 'Student only — pedagogical goals',
    example: 'Préparer le bac S mention TB',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  goals?: string;

  @ApiPropertyOptional({
    description: 'Student only — specific learning needs',
    example: 'Dyslexie légère',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specificNeeds?: string;

  // --- Champs du profil formateur ------------------------------------------

  @ApiPropertyOptional({
    description: 'Teacher only — school levels taught',
    example: ['Collège', 'Lycée'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  levels?: string[];

  @ApiPropertyOptional({
    description: 'Teacher only — pedagogical experience description',
    example: '5 ans de cours particuliers au lycée',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  experience?: string;

  @ApiPropertyOptional({
    description: 'Teacher only — test and evaluation results summary',
    example: 'Score moyen 87/100',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  testResults?: string;

  @ApiPropertyOptional({
    description:
      'Teacher only — PROF-BR-008: whether the teacher is also an Animateur Pédagogique. ' +
      'Use POST /profiles/:teacherId/ap-status instead to promote.',
  })
  @IsOptional()
  @IsBoolean()
  isAnimateurPedagogique?: boolean;

  // --- Champ commun aux deux profils ---------------------------------------

  @ApiPropertyOptional({
    description:
      'Subjects — studied (student profile) or taught (teacher profile), depending on ' +
      'which profile the payload targets. Always an array of strings.',
    example: ['Mathématiques', 'Physique'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];
}
