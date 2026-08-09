import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, MaxLength } from 'class-validator';

/**
 * Body de PUT /profiles/:userId/pedagogical — SECTION DÉCLARATIVE UNIQUEMENT,
 * champs élève ET formateur.
 *
 * CE DTO NE PORTE AUCUN CHAMP DE PRESCRIPTION, et c'est le cœur du chantier :
 * la section prescription (préconisations élève, résultats et commentaires de
 * test formateur, niveau max validé, type de public) est réservée au
 * responsable pédagogique et passe par PUT /profiles/:userId/prescription.
 * Grâce à `forbidNonWhitelisted`, un titulaire qui tenterait d'y glisser
 * `generalAssessment` ou `testResults` reçoit un 400 explicite plutôt qu'un
 * champ silencieusement ignoré.
 *
 * Deux champs ont été retirés par ce chantier :
 *  - `testResults` : évaluation menée par le RP → section prescription ;
 *  - `isAnimateurPedagogique` : c'est un DROIT, attribué par
 *    POST /profiles/:teacherId/ap-status. Le laisser ici exposait une
 *    promotion de rôle à une route d'auto-édition.
 *
 * Pourquoi une seule classe et non deux ? Le contrôleur typait auparavant le
 * body en union TypeScript. Une union n'existe pas à l'exécution :
 * `ValidationPipe` ne pouvait résoudre aucun metatype et **désactivait
 * totalement la validation** sur cette route. Une classe concrète unique
 * rétablit la validation. Le service choisit ensuite la table cible (élève ou
 * formateur) — voir ProfilesService.updatePedagogicalProfile.
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
    description:
      'Student only — officially recognised accommodations (DYS, PAP, PPS). ' +
      'Distinct from `difficulties`, which describes a learning difficulty: ' +
      'do not merge the two.',
    example: 'PAP en place depuis la 4e (dyslexie)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specificNeeds?: string;

  @ApiPropertyOptional({
    description:
      'Student only — what the student struggles with. Distinct from ' +
      '`specificNeeds`, which carries recognised accommodations.',
    example: 'Blocage sur les fonctions dérivées et la trigonométrie',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  difficulties?: string;

  @ApiPropertyOptional({
    description: 'Student only — school and family context useful to the follow-up',
    example: 'Redoublement en seconde, déménagement en cours d’année',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  context?: string;

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
    description: 'Teacher only — declared degrees and certifications',
    example: 'Master MEEF mathématiques, CAPES externe 2018',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diplomas?: string;

  @ApiPropertyOptional({
    description:
      'Teacher only — pedagogical specialties, distinct from `subjects`: ' +
      '`subjects` carries the school subject, `specialties` the kind of support.',
    example: ['Préparation Grand Oral', 'Remise à niveau'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({
    description: 'Teacher only — teaching modalities, constraints, specific audiences',
    example: 'Ne prend pas de créneaux avant 14h ; habitué aux élèves à besoins particuliers',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  particularities?: string;

  @ApiPropertyOptional({
    description:
      'Teacher only — REFERENCE of the CV document held by archive-document-service. ' +
      'Never a file URL: profile-service does not store documents.',
    example: 'b0e3f6f2-9a1e-4f7b-9c1a-2f0f9d2b7c31',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  cvDocumentId?: string;

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
