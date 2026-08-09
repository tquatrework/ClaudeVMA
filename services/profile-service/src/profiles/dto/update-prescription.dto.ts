import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body de PUT /profiles/:userId/prescription — SECTION PRESCRIPTION UNIQUEMENT.
 *
 * Route réservée au RESPONSABLE PÉDAGOGIQUE. Le titulaire lit sa prescription
 * via GET /profiles/:userId mais ne l'écrit jamais : un élève ne rédige pas
 * ses propres préconisations, un formateur pas ses propres résultats de test.
 *
 * `filledBy` et `filledAt` ne figurent VOLONTAIREMENT PAS dans ce DTO : ils
 * sont renseignés côté serveur à partir de l'acteur authentifié et de l'heure
 * courante. Les accepter depuis le corps de la requête permettrait d'attribuer
 * une prescription à quelqu'un d'autre, ce qui la viderait de sa valeur
 * d'opposabilité. Un client qui les envoie reçoit un 400
 * (`forbidNonWhitelisted`), jamais un silence.
 *
 * Le DTO couvre les deux rôles ; le service résout le profil cible (élève ou
 * formateur) et REFUSE EXPLICITEMENT en 400 tout champ appartenant à l'autre
 * rôle — il ne le laisse jamais tomber en silence.
 */
export class UpdatePrescriptionDto {
  // --- Prescription élève ---------------------------------------------------

  @ApiPropertyOptional({
    description: 'Student only — RP general assessment of the student',
    example: 'Élève sérieux mais en difficulté sur les fondamentaux d’algèbre.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  generalAssessment?: string;

  @ApiPropertyOptional({
    description: 'Student only — recommended working pace',
    example: '2 séances d’1h par semaine sur 3 mois',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendedPace?: string;

  @ApiPropertyOptional({
    description: 'Student only — recommended teacher profile',
    example: 'Formateur patient, habitué aux profils anxieux',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendedTeacherProfile?: string;

  @ApiPropertyOptional({
    description: 'Student only — recommended pedagogical path',
    example: 'Parcours « Remise à niveau seconde » puis « Préparation bac »',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendedPath?: string;

  @ApiPropertyOptional({
    description: 'Student only — recommended activities',
    example: 'Exercices hebdomadaires de calcul mental, un DS blanc par mois',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendedActivities?: string;

  // --- Prescription formateur -----------------------------------------------

  @ApiPropertyOptional({
    description: 'Teacher only — maximum school level validated by the RP',
    example: 'Terminale spécialité mathématiques',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  maxValidatedLevel?: string;

  @ApiPropertyOptional({
    description: 'Teacher only — audience the teacher is cleared to support',
    example: 'Collège et lycée général, hors public à besoins particuliers',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  audienceType?: string;

  @ApiPropertyOptional({
    description:
      'Teacher only — test and evaluation results. Moved out of the ' +
      'self-edited pedagogical profile by design: these results are an ' +
      'evaluation run BY the RP, a teacher must not be able to write their own.',
    example: 'Score 87/100 — algèbre 92, géométrie 78',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  testResults?: string;

  @ApiPropertyOptional({
    description: 'Teacher only — RP comments on the evaluation tests',
    example: 'Très bon niveau disciplinaire, à retester sur la géométrie dans l’espace',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  testComments?: string;
}
