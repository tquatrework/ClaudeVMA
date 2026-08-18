/**
 * Nature des relations métier entre deux personnes, du point de vue du LECTEUR
 * vers la CIBLE (`viewer` → `target`).
 *
 * Ce fichier est la transcription du CONTRAT de
 * `GET /internal/relations/:viewerId/:targetId` exposé par `profile-service`
 * (voir `docs/routes.md`). Ce n'est pas une copie des relations elles-mêmes :
 * `profile-service` en reste l'unique propriétaire (arbitrage du 2026-08-11,
 * point 4), ce service les lui demande à chaque décision et n'en persiste
 * aucune. Copié fidèlement depuis
 * `archive-document-service/src/common/relations/relation-kind.ts`, seul
 * endroit du projet qui consommait déjà ce contrat avant `calendar-service`.
 *
 * Pourquoi une énumération ORIENTÉE plutôt qu'un booléen « sont-ils liés ? » :
 * les droits ne sont pas symétriques. Un formateur voit le calendrier
 * busy/free de son élève ; un AP voit celui des formateurs qu'il anime — deux
 * sens différents pour deux rôles différents. Un booléen rendrait cette
 * distinction impossible.
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

  /** Relation INDIRECTE : le lecteur finance un élève que la cible enseigne. */
  FINANCE_OWNER_OF_STUDENT_OF_TEACHER = 'finance_owner_of_student_of_teacher',
  /** Relation INDIRECTE symétrique : le lecteur enseigne à un élève financé par la cible. */
  TEACHER_OF_STUDENT_OF_FINANCE_OWNER = 'teacher_of_student_of_finance_owner',
}

/**
 * Une relation résolue entre deux personnes, telle que renvoyée par
 * `profile-service`.
 */
export interface ResolvedRelation {
  kind: RelationKind;
  /** Uniquement sur TEACHER_OF_STUDENT / STUDENT_OF_TEACHER. */
  isPrincipalTeacher?: boolean;
  /** Uniquement sur les relations indirectes : la ou les personnes par lesquelles passe le lien. */
  throughUserIds?: string[];
}

/**
 * Réponse complète de `GET /internal/relations/:viewerId/:targetId`.
 *
 * Elle porte des FAITS, pas un verdict : `profile-service` ne décide pas à la
 * place de ce service ce qu'un lien ouvre sur le calendrier.
 */
export interface RelationSnapshot {
  viewerId: string;
  targetId: string;
  isSelf: boolean;
  /** `true` pour RP, AF et TI. JAMAIS pour l'animateur pédagogique. */
  isAdministrator: boolean;
  relations: ResolvedRelation[];
}
