/**
 * Nature des relations métier entre deux personnes, du point de vue du LECTEUR
 * vers la CIBLE (`viewer` → `target`).
 *
 * Pourquoi une énumération orientée plutôt qu'un booléen « sont-ils liés ? » :
 * les droits ne sont pas symétriques d'une surface à l'autre. L'arbitrage du
 * 2026-08-11 (`docs/architecture.md` > « Arbitrages rendus ») accorde à l'élève
 * les STATISTIQUES de son formateur mais pas ses ARCHIVES pédagogiques, alors
 * que le formateur accède aux deux pour son élève. Un service appelant
 * (`archive-document-service`) ne peut donc pas décider avec un booléen : il lui
 * faut savoir de quel côté du lien se trouve le demandeur.
 *
 * `profile-service` reste l'unique propriétaire de ces relations ; les autres
 * services les lui demandent (`GET /internal/relations/:viewerId/:targetId`) et
 * n'en tiennent jamais de copie.
 */
export enum RelationKind {
  /** Le lecteur est le parent financeur de la cible (élève). */
  FINANCE_OWNER_OF_STUDENT = 'finance_owner_of_student',
  /** Le lecteur est l'élève dont la cible est le parent financeur. */
  STUDENT_OF_FINANCE_OWNER = 'student_of_finance_owner',

  /** Le lecteur est le formateur de la cible (élève). */
  TEACHER_OF_STUDENT = 'teacher_of_student',
  /** Le lecteur est l'élève de la cible (formateur). */
  STUDENT_OF_TEACHER = 'student_of_teacher',

  /** Le lecteur anime la cible (formateur) — relation AP → formateur. */
  ANIMATOR_OF_TEACHER = 'animator_of_teacher',
  /** Le lecteur est le formateur animé par la cible (AP). */
  TEACHER_OF_ANIMATOR = 'teacher_of_animator',

  /** Le lecteur coordonne la cible (élève) — RP ou AP coordinateur. */
  COORDINATOR_OF_STUDENT = 'coordinator_of_student',
  /** Le lecteur est l'élève coordonné par la cible. */
  STUDENT_OF_COORDINATOR = 'student_of_coordinator',

  /**
   * Relation INDIRECTE : le lecteur finance un élève que la cible enseigne.
   * C'est ce qui donne corps à « parents et élèves voient les statistiques
   * pédagogiques des formateurs auxquels ils sont reliés » — un parent n'est
   * jamais lié en direct à un formateur, il l'est toujours par son élève.
   */
  FINANCE_OWNER_OF_STUDENT_OF_TEACHER = 'finance_owner_of_student_of_teacher',
  /** Relation INDIRECTE symétrique : le lecteur enseigne à un élève financé par la cible. */
  TEACHER_OF_STUDENT_OF_FINANCE_OWNER = 'teacher_of_student_of_finance_owner',
}

/**
 * Une relation résolue entre deux personnes.
 *
 * `throughUserIds` n'est renseigné que pour les relations indirectes : il nomme
 * la ou les personnes par lesquelles passe le lien (l'élève commun, pour un
 * parent et un formateur). Il sert au diagnostic et à l'affichage d'un contexte
 * (« formateur de Théo »), jamais à être affiché tel quel.
 */
export interface ResolvedRelation {
  kind: RelationKind;
  /** Uniquement sur TEACHER_OF_STUDENT / STUDENT_OF_TEACHER. */
  isPrincipalTeacher?: boolean;
  /** Uniquement sur les relations indirectes. */
  throughUserIds?: string[];
}

/** Toutes les valeurs de l'énumération, pour la validation des DTO et la doc. */
export const RELATION_KINDS: RelationKind[] = Object.values(RelationKind);
