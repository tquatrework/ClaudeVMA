/**
 * Types partagés — flow « demande de professeur » (teacher-request-service).
 *
 * Alignés sur les réponses réelles de la pile (vérifiées le 2026-08-12) et sur
 * `docs/routes.md` > teacher-request-service. Le flow a été refondu côté serveur le
 * 2026-08-12 : c'est le RP qui tranche, l'acceptation d'un formateur n'est qu'une
 * candidature (`docs/architecture.md` > « Flow de la demande de professeur »).
 *
 * Règle « un seul nom par donnée » : les noms ci-dessous sont exactement ceux du
 * serveur. Les champs inventés du modèle précédent (`teacherId`, `candidates`,
 * `collaborationId`, `candidatesCount`, `subject`/`level`/`sector`) ont été supprimés.
 */

/**
 * Portée de `GET /teacher-requests` : les demandes traitées disparaissent des listes
 * ouvertes (étape 8 du flow).
 */
export type TeacherRequestScope = 'open' | 'closed' | 'all'

/**
 * Statuts d'une demande.
 * Cycle du flow : `pending` → `redirected` → `closed`.
 * `cancelled` / `declined` sont terminaux. Les autres valeurs sont héritées de
 * modèles abandonnés : plus jamais écrites, mais encore portées par des lignes en base.
 */
export type TeacherRequestStatus =
  | 'pending'
  | 'redirected'
  | 'closed'
  | 'cancelled'
  | 'declined'
  // Valeurs héritées, encore lisibles
  | 'assigned'
  | 'accepted'
  | 'candidates_published'
  | 'candidates_selected'
  | 'candidate_chosen'

/**
 * Statuts d'une proposition adressée à un formateur.
 * `not_selected` = avait accepté, un autre a été choisi. `expired` = n'a jamais répondu.
 * Les confondre avec `declined` (refus explicite du formateur) serait un mensonge affiché.
 */
export type TeacherProposalStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'not_selected'
  | 'expired'

/** Type de demande — `specific` pour le flow courant, `pp_change` hors flow. */
export type TeacherRequestType = 'specific' | 'pp_change'

/**
 * Une demande de professeur, telle que renvoyée par `GET /teacher-requests`,
 * `GET /teacher-requests/:id`, `POST /teacher-requests` et `POST /.../validate`.
 * Une seule forme : le serveur ne distingue pas résumé et détail.
 */
export interface TeacherRequest {
  id: string
  requesterId: string
  requesterRole: string
  studentId: string
  /** Prénom + nom de l'élève, résolu par le serveur — jamais un UUID à l'écran. */
  studentName: string | null
  description: string
  status: TeacherRequestStatus
  type: TeacherRequestType
  currentPpTeacherId: string | null
  chosenTeacherId: string | null
  /** Prénom + nom du formateur retenu, résolu par le serveur. */
  chosenTeacherName: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  /** Renseignés pour le RP uniquement. */
  acceptedProposalCount?: number
  pendingProposalCount?: number
}

/**
 * Une proposition, vue par le RP (`GET /teacher-requests/:requestId/proposals`).
 */
export interface TeacherProposal {
  id: string
  requestId: string
  teacherId: string
  /** Prénom + nom du formateur, résolu par le serveur. */
  teacherName: string | null
  message: string | null
  availabilityNote: string | null
  compensationNote: string | null
  responseDeadline: string | null
  status: TeacherProposalStatus
  respondedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Une proposition, vue par le formateur destinataire — c'est la forme que
 * `GET /teacher-requests` renvoie quand l'appelant est formateur, et celle que
 * renvoient `POST /proposals/:id/accept|decline`.
 *
 * `id` est bien l'identifiant de la **proposition** : c'est lui qu'il faut poster sur
 * `/proposals/:proposalId/accept`, jamais `requestId`.
 */
export interface TeacherProposalInboxItem {
  id: string
  requestId: string
  requestDescription: string
  studentName: string | null
  message: string | null
  availabilityNote: string | null
  compensationNote: string | null
  responseDeadline: string | null
  status: TeacherProposalStatus
  /** Statut de la demande porteuse — permet de savoir si elle est encore ouverte. */
  requestStatus: TeacherRequestStatus
  respondedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Corps de `POST /teacher-requests` — un seul champ de saisie : `description`. */
export interface CreateTeacherRequestPayload {
  description: string
  /** Obligatoire quand l'appelant n'est pas l'élève lui-même (parent). */
  studentId?: string
}

/** Corps de `POST /teacher-requests/:requestId/proposals` — envoi groupé et atomique. */
export interface SendTeacherProposalsPayload {
  teacherIds: string[]
  message: string
  availabilityNote?: string
  compensationNote?: string
  /** Date au format `YYYY-MM-DD`. */
  responseDeadline?: string
}

/** Corps de `POST /teacher-requests/:id/validate` — point de décision unique du RP. */
export interface ValidateTeacherRequestPayload {
  proposalId: string
  isPrincipalTeacher?: boolean
}

/** Corps de `PATCH /teacher-requests/:id/status` — RP uniquement. */
export interface UpdateTeacherRequestStatusPayload {
  status: 'declined' | 'cancelled' | 'closed'
}

/** Corps de `POST /teacher-requests/pp-change` — parent financeur uniquement. */
export interface PpChangeRequestPayload {
  studentId: string
  currentPpTeacherId?: string
  description: string
}

/**
 * Un formateur tel que le composeur de l'étape 3 le propose au RP : un nom
 * lisible, l'expertise quand elle est renseignée, et l'identifiant technique
 * réservé à l'appel suivant.
 *
 * Forme d'affichage dérivée de `ValidatedTeacher` (`src/types/profile.ts`) par
 * `toSelectableTeacher` : le composeur ne formate rien lui-même et n'a donc
 * aucun moyen de faire apparaître un UUID par mégarde.
 */
export interface SelectableTeacher {
  /** Jamais affiché — sert uniquement à construire `teacherIds`. */
  userId: string
  displayName: string
  /** Niveaux et matières en une ligne, `null` quand rien n'est renseigné. */
  expertise: string | null
}
