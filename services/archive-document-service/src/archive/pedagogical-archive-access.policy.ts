import { RelationKind, RelationSnapshot } from '../common/relations/relation-kind';

/**
 * Position du lecteur vis-à-vis des ARCHIVES PÉDAGOGIQUES d'une personne.
 *
 * `denied` ne doit JAMAIS se distinguer, côté HTTP, d'une absence d'archive :
 * arbitrage du 2026-08-11, point 5 — « un accès refusé par absence de relation
 * se comporte comme les autres masquages », dans la lignée de la règle du
 * 2026-08-10 sur les médias masqués (404, jamais 403).
 */
export type ArchiveViewerPosition = 'owner' | 'administrator' | 'linked' | 'denied';

/**
 * Relations qui OUVRENT les archives pédagogiques du titulaire.
 *
 * Toutes vont dans le même sens : **celui qui accompagne** accède à l'archive
 * de **celui qui est accompagné**. L'archive pédagogique retrace un parcours
 * d'apprentissage ou d'exercice ; elle s'ouvre à qui encadre ce parcours, pas à
 * qui en bénéficie.
 *
 * Le sens inverse est donc absent, et c'est délibéré :
 *  - `student_of_teacher` — l'élève voit les STATISTIQUES de son formateur
 *    (`profile-service`), pas ses archives : elles portent l'historique
 *    d'exercice du formateur, elles ne regardent pas ses élèves ;
 *  - `finance_owner_of_student_of_teacher` — même raison pour le parent, dont
 *    le lien au formateur passe par son élève ;
 *  - `student_of_finance_owner`, `teacher_of_animator`, `student_of_coordinator`
 *    — mêmes symétries, refusées pour la même raison.
 *
 * C'est précisément cette asymétrie qui impose une énumération orientée plutôt
 * qu'un booléen « sont-ils liés ? » côté `profile-service`.
 */
const RELATION_KINDS_OPENING_ARCHIVES: readonly RelationKind[] = [
  /** Le formateur accède aux archives de son élève. */
  RelationKind.TEACHER_OF_STUDENT,
  /** Le parent financeur accède aux archives de son élève. */
  RelationKind.FINANCE_OWNER_OF_STUDENT,
  /** L'AP accède aux archives des formateurs qu'il anime. */
  RelationKind.ANIMATOR_OF_TEACHER,
  /** Le coordinateur pédagogique (RP ou AP) accède aux archives des élèves qu'il coordonne. */
  RelationKind.COORDINATOR_OF_STUDENT,
];

/**
 * Décide de l'accès aux ARCHIVES PÉDAGOGIQUES à partir de la RELATION, jamais
 * d'une liste de rôles.
 *
 * Une liste de rôles oublie un rôle à chaque évolution — défaut corrigé le
 * 2026-08-11 dans `finance-credit-service` (`formateur` et
 * `animateur_pedagogique` s'y voyaient refuser leurs PROPRES données), puis
 * dans `profile-service`. Ici, le rôle ne sert qu'à une chose : reconnaître un
 * administrateur, et cette reconnaissance est faite par `profile-service`
 * lui-même (`isAdministrator`), pas rejouée localement.
 *
 * Trois positions ouvrent l'accès :
 *  - `owner`         : le titulaire de l'archive ;
 *  - `administrator` : RP, AF et TI, sans distinction pour l'instant
 *    (arbitrage du 2026-08-11, point 3 — la distinction par surface est actée
 *    dans son principe et remise à plus tard ; elle se posera ICI, sur cette
 *    seule branche, le jour venu) ;
 *  - `linked`        : une relation de la liste ci-dessus.
 *
 * L'ANIMATEUR PÉDAGOGIQUE n'est PAS un administrateur : `isAdministrator` vaut
 * `false` pour lui côté `profile-service`. Son droit passe entièrement par la
 * relation `animator_of_teacher`. Sans lien créé par un RP, il ne voit les
 * archives de personne — état normal, pas une anomalie.
 */
export function resolveArchiveViewerPosition(snapshot: RelationSnapshot): ArchiveViewerPosition {
  if (snapshot.isSelf) return 'owner';
  if (snapshot.isAdministrator) return 'administrator';

  const hasOpeningRelation = snapshot.relations.some((relation) =>
    RELATION_KINDS_OPENING_ARCHIVES.includes(relation.kind),
  );

  return hasOpeningRelation ? 'linked' : 'denied';
}

/** `true` si la position autorise la lecture des archives pédagogiques. */
export function isArchiveReadAllowed(position: ArchiveViewerPosition): boolean {
  return position !== 'denied';
}

/** Exporté pour la documentation et les tests : la liste fait foi, pas un commentaire. */
export const ARCHIVE_OPENING_RELATION_KINDS = RELATION_KINDS_OPENING_ARCHIVES;
