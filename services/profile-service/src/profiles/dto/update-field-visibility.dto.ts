import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FIELD_AUDIENCES, FieldAudience } from '../field-visibility.catalog';

/**
 * Une entrée de réglage : « ce champ-là est visible de cette audience-là ».
 *
 * `fieldName` est validé ici sur sa FORME (chaîne non vide, longueur bornée) ;
 * son APPARTENANCE au catalogue est vérifiée par le service, qui répond 400
 * avec la liste des noms acceptés. Faire la validation d'appartenance côté
 * service plutôt que via un @IsIn() figé garde le catalogue en un seul endroit
 * (field-visibility.catalog.ts) et permet un message d'erreur exploitable.
 */
export class FieldVisibilityEntryDto {
  @ApiProperty({
    description:
      'Technical field name, in English, as returned by GET /profiles/:userId. ' +
      'Must belong to the visibility catalog — an unknown name is rejected with 400.',
    example: 'difficulties',
  })
  @IsString()
  @MaxLength(100)
  fieldName: string;

  @ApiProperty({
    description:
      'self — owner (and administrators) only; ' +
      'linked — also visible to linked people (parent↔student, teacher↔student…); ' +
      'all — visible to any authenticated user.',
    enum: FIELD_AUDIENCES,
    example: 'linked',
  })
  @IsIn(FIELD_AUDIENCES as readonly string[], {
    message: `audience must be one of: ${FIELD_AUDIENCES.join(', ')}`,
  })
  audience: FieldAudience;
}

/**
 * Body de PUT /profiles/:userId/field-visibility.
 *
 * Sémantique d'UPSERT PARTIEL : seuls les champs listés sont modifiés. Un
 * champ absent du corps garde son réglage courant — il n'est pas remis à sa
 * valeur par défaut. Ce choix évite qu'un écran ne connaissant qu'une partie
 * du catalogue n'efface les réglages qu'il n'affiche pas.
 *
 * Pour revenir au défaut d'un champ, envoyer explicitement l'audience par
 * défaut de son bloc (lisible dans la réponse de GET, champ `defaultAudience`).
 */
export class UpdateFieldVisibilityDto {
  @ApiProperty({
    description: 'Field visibility settings to upsert. Only the listed fields are modified.',
    type: [FieldVisibilityEntryDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FieldVisibilityEntryDto)
  fields: FieldVisibilityEntryDto[];
}
