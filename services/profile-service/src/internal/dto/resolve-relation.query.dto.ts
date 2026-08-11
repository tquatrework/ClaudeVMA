import { IsEnum } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

/**
 * Paramètres de `GET /internal/relations/:viewerId/:targetId`.
 *
 * `viewerRole` est OBLIGATOIRE : le rôle conditionne la quasi-totalité des
 * règles de droit et doit accompagner systématiquement les appels
 * interservices, au même titre que `x-correlation-id` (arbitrage du
 * 2026-08-07). Le rendre optionnel obligerait `profile-service` à le deviner ou
 * à le redemander à `identity-access-service`, qui en reste l'unique
 * propriétaire — `profile-service` le consomme comme contexte de décision, il ne
 * le persiste ni ne l'expose.
 *
 * Un rôle inconnu renvoie `400` explicite, jamais un « pas administrateur »
 * silencieux : un appelant qui se trompe de valeur doit l'apprendre, pas
 * recevoir une réponse plausible et fausse.
 */
export class ResolveRelationQueryDto {
  @IsEnum(UserRole, {
    message: `viewerRole must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  viewerRole: UserRole;
}
