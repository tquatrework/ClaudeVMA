import { UserRole } from '../common/enums/user-role.enum';
import { RelationKind, ResolvedRelation } from '../common/relations/relation-kind';

/**
 * Position du lecteur vis-à-vis du calendrier BUSY/FREE d'un tiers.
 *
 * `denied` répond `403` sur `GET /calendars/:ownerId/busy` — décision de
 * l'orchestrateur retenue à l'approbation du plan : contrairement aux
 * archives/statistiques pédagogiques (404 uniforme, arbitrage du
 * 2026-08-11), il n'y a ici aucune ambiguïté d'existence à protéger, le
 * calendrier existe toujours.
 */
export type CalendarBusyFreeViewerPosition = 'owner' | 'administrator' | 'linked' | 'denied';

/**
 * Rôle administratif habilité à voir le busy/free de n'importe qui, SANS
 * condition de lien.
 *
 * Périmètre tranché avec l'utilisateur à l'approbation du plan : **RP seul**,
 * PAS `ADMINISTRATOR_ROLES` (RP+AF+TI) utilisé ailleurs dans le projet pour
 * les statistiques/archives (arbitrage du 2026-08-11). Ne pas élargir à AF ni
 * TI malgré cette divergence délibérée — elle a été signalée à l'utilisateur
 * comme point d'arbitrage et tranchée dans ce sens précis.
 */
const CALENDAR_ADMINISTRATOR_ROLE = UserRole.RESPONSABLE_PEDAGOGIQUE;

/**
 * Relations qui ouvrent le busy/free d'un titulaire ÉLÈVE.
 *
 *  - `FINANCE_OWNER_OF_STUDENT` : le lecteur est le parent financeur de
 *    l'élève.
 *  - `TEACHER_OF_STUDENT` : le lecteur est un formateur actif de l'élève.
 */
const RELATION_KINDS_OPENING_STUDENT_BUSY_FREE: readonly RelationKind[] = [
  RelationKind.FINANCE_OWNER_OF_STUDENT,
  RelationKind.TEACHER_OF_STUDENT,
];

/**
 * Relations qui ouvrent le busy/free d'un titulaire FORMATEUR.
 *
 *  - `STUDENT_OF_TEACHER` : le lecteur est un élève lié à ce formateur.
 *  - `FINANCE_OWNER_OF_STUDENT_OF_TEACHER` : relation INDIRECTE — le lecteur
 *    est le parent financeur d'un élève de ce formateur (« parent-indirect »).
 *  - `ANIMATOR_OF_TEACHER` : le lecteur est l'AP qui anime ce formateur.
 */
const RELATION_KINDS_OPENING_TEACHER_BUSY_FREE: readonly RelationKind[] = [
  RelationKind.STUDENT_OF_TEACHER,
  RelationKind.FINANCE_OWNER_OF_STUDENT_OF_TEACHER,
  RelationKind.ANIMATOR_OF_TEACHER,
];

export interface ResolveCalendarBusyFreeAccessInput {
  viewerId: string;
  viewerRole: UserRole | string;
  ownerId: string;
  /**
   * Rôle du titulaire du calendrier consulté, résolu auprès de
   * `identity-access-service` (`IdentityAccessClient.resolveRole`) — jamais
   * lu depuis `Calendar.ownerRole`, qui n'existe que si la ligne `Calendar`
   * a déjà été créée paresseusement par un appel antérieur du titulaire
   * (bug CAL-FB-004 corrigé le 2026-08-18 : un titulaire n'ayant jamais
   * ouvert son propre calendrier bloquait tout le monde d'autre sur `/busy`,
   * y compris une relation active réelle). `undefined` quand
   * `identity-access-service` ne connaît pas ce compte (`404`) — dans ce cas
   * seuls le titulaire lui-même et le RP peuvent obtenir une réponse, par
   * défaut fermé : sans rôle connu on ne peut pas vérifier qu'une relation
   * retournée par `profile-service` s'applique bien à CE titulaire.
   */
  ownerRole: UserRole | string | undefined;
  relations: ResolvedRelation[];
}

/**
 * Décide de l'accès au calendrier BUSY/FREE (jamais le contenu) à partir de
 * la RELATION et du RÔLE réel du titulaire, jamais d'une simple liste de
 * rôles pour le lecteur — fonction pure, sur le modèle de
 * `profile-service/src/relations/pedagogical-access.policy.ts`.
 *
 * Quatre positions :
 *  - `owner`         : le titulaire lui-même, accès complet (pas seulement
 *    busy/free — cette route lui répond aussi, mais son propre calendrier
 *    complet reste `GET /calendars/:ownerId`) ;
 *  - `administrator` : le RP, sans condition de lien, que le titulaire soit
 *    élève ou formateur ;
 *  - `linked`        : une relation de la liste adéquate selon le rôle du
 *    titulaire ;
 *  - `denied`        : tout le reste — répond `403`, jamais un `200` vide
 *    qui laisserait deviner l'existence d'un calendrier.
 */
export function resolveCalendarBusyFreeAccess(
  input: ResolveCalendarBusyFreeAccessInput,
): CalendarBusyFreeViewerPosition {
  const { viewerId, viewerRole, ownerId, ownerRole, relations } = input;

  if (viewerId === ownerId) return 'owner';
  if (viewerRole === CALENDAR_ADMINISTRATOR_ROLE) return 'administrator';

  const openingKinds =
    ownerRole === UserRole.ELEVE
      ? RELATION_KINDS_OPENING_STUDENT_BUSY_FREE
      : ownerRole === UserRole.FORMATEUR
        ? RELATION_KINDS_OPENING_TEACHER_BUSY_FREE
        : null;

  if (!openingKinds) return 'denied';

  const hasOpeningRelation = relations.some((relation) => openingKinds.includes(relation.kind));
  return hasOpeningRelation ? 'linked' : 'denied';
}

/** `true` si la position autorise la lecture du busy/free. */
export function isCalendarBusyFreeAccessAllowed(
  position: CalendarBusyFreeViewerPosition,
): boolean {
  return position !== 'denied';
}

/** Exportées pour la documentation et les tests : les listes font foi, pas un commentaire. */
export const STUDENT_BUSY_FREE_OPENING_RELATION_KINDS = RELATION_KINDS_OPENING_STUDENT_BUSY_FREE;
export const TEACHER_BUSY_FREE_OPENING_RELATION_KINDS = RELATION_KINDS_OPENING_TEACHER_BUSY_FREE;
