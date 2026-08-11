import { UserRole } from '../common/enums/user-role.enum';
import { RelationKind, ResolvedRelation } from './relation-kind';

/**
 * Rôles administratifs — accès à tout, SANS distinction pour l'instant.
 *
 * Arbitrage du 2026-08-11, point 3 : « RP, AF et TI accèdent aux statistiques et
 * archives de tous. La distinction souhaitable — RP sur le pédagogique, AF sur
 * le financier, TI sans besoin propre — est actée dans son principe et remise à
 * plus tard. Ne pas la coder par anticipation, mais ne pas non plus écrire de
 * code qui la rendrait coûteuse à introduire. »
 *
 * D'où cette constante UNIQUE, consommée par une seule fonction
 * (`isAdministrator`) : le jour où la distinction sera tranchée, elle devient un
 * tableau par surface (`PEDAGOGICAL_ADMIN_ROLES`, `FINANCIAL_ADMIN_ROLES`) sans
 * qu'aucun appelant n'ait à être retrouvé un par un.
 *
 * L'ANIMATEUR PÉDAGOGIQUE n'y figure pas : il n'est pas un administrateur au
 * sens de l'arbitrage. Son droit passe par la relation qu'il entretient avec les
 * formateurs qu'il anime (`animator_teacher_links`).
 */
export const ADMINISTRATOR_ROLES: readonly UserRole[] = [
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
  UserRole.TECHNICIEN_INFORMATIQUE,
];

export function isAdministrator(role: UserRole | string | undefined): boolean {
  return ADMINISTRATOR_ROLES.includes(role as UserRole);
}

/**
 * Position du lecteur vis-à-vis des statistiques pédagogiques d'une personne.
 *
 * `denied` ne doit JAMAIS se distinguer, côté HTTP, d'une absence de données :
 * arbitrage du 2026-08-11, point 5 — « un accès refusé par absence de relation
 * se comporte comme les autres masquages », dans la lignée de la règle du
 * 2026-08-10 sur les médias masqués (404, jamais 403).
 */
export type StatisticsViewerPosition = 'owner' | 'exempt' | 'linked' | 'denied';

/**
 * Décide de l'accès aux STATISTIQUES pédagogiques, à partir de la RELATION et
 * non d'une liste de rôles.
 *
 * Une liste de rôles oublie un rôle à chaque évolution — c'est le défaut corrigé
 * le 2026-08-11 dans `finance-credit-service`, où `formateur` et
 * `animateur_pedagogique` avaient été oubliés et se voyaient refuser leurs
 * PROPRES données. Ici le rôle ne sert qu'à deux choses : reconnaître un
 * administrateur, et savoir si le lecteur échappe au filtrage champ par champ.
 *
 * Trois positions ouvrent l'accès :
 *  - `owner`  : le titulaire, qui ne se masque jamais rien ;
 *  - `exempt` : voit la fiche entière — administrateurs, parent financeur DIRECT
 *    de la cible (arbitrage du 2026-08-09 : un élève ne masque rien à son parent
 *    financeur) et AP animant la cible (dont l'essentiel du dossier formateur
 *    est `self` par défaut : filtré, il serait aveugle à ce qu'il doit animer) ;
 *  - `linked` : toute autre relation, SOUMISE aux réglages de visibilité du
 *    titulaire — le formateur sur son élève, l'élève sur son formateur, le
 *    parent sur le formateur de son élève.
 *
 * Le parent financeur n'est exempté que sur SON élève : le lien indirect qui le
 * relie au formateur de cet élève ouvre la lecture, il ne lui donne pas le droit
 * de voir ce que le formateur a masqué.
 */
export function resolveStatisticsViewerPosition(input: {
  viewerId: string;
  viewerRole: UserRole | string;
  targetId: string;
  relations: ResolvedRelation[];
}): StatisticsViewerPosition {
  const { viewerId, viewerRole, targetId, relations } = input;

  if (viewerId === targetId) return 'owner';
  if (isAdministrator(viewerRole)) return 'exempt';

  const kinds = new Set(relations.map((relation) => relation.kind));
  if (kinds.size === 0) return 'denied';

  if (kinds.has(RelationKind.FINANCE_OWNER_OF_STUDENT)) return 'exempt';
  if (kinds.has(RelationKind.ANIMATOR_OF_TEACHER)) return 'exempt';

  return 'linked';
}
