import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/**
 * Plafond du lot, déclaré explicitement plutôt que laissé au hasard : une
 * liste non bornée transformerait un appel interservices en requête SQL
 * arbitrairement large. Un maillon qui laisse son défaut s'appliquer est un
 * plafond caché (règle du 2026-08-10, posée pour les envois de fichiers mais
 * de portée générale).
 */
export const DISPLAY_NAMES_BATCH_MAX_SIZE = 200;

/**
 * Corps de `POST /internal/profiles/display-names`.
 *
 * Variante par lot de `GET /internal/profiles/:userId/display-name`, pour
 * qu'une liste de N lignes ne coûte pas N appels HTTP. Même contrat que la
 * route unitaire : uniquement `firstName` / `lastName` en sortie, jamais un
 * champ de plus (voir `display-name.ts`).
 */
export class ResolveDisplayNamesDto {
  @IsArray({ message: 'userIds doit être un tableau d’identifiants.' })
  @ArrayNotEmpty({ message: 'Fournir au moins un userId.' })
  @ArrayMaxSize(DISPLAY_NAMES_BATCH_MAX_SIZE, {
    message: `Un lot ne peut pas dépasser ${DISPLAY_NAMES_BATCH_MAX_SIZE} identifiants.`,
  })
  @IsUUID('all', { each: true, message: 'Chaque userId doit être un UUID.' })
  userIds: string[];
}
