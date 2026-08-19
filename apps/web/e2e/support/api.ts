import { e2eEnv } from './env'

/**
 * Appels directs à api-gateway pour préparer les données du test — les mêmes
 * routes réelles que celles documentées dans `docs/routes.md`, jouées en
 * dehors du navigateur pour construire un état de départ (élève + formateur
 * + relation active) avant que le test ne pilote l'écran.
 *
 * Aucun mock : ce sont de vrais comptes, créés par les routes d'inscription
 * publiques, comme le ferait un utilisateur.
 */

interface CreatedAccount {
  id: string
  loginIdentifier: string
  email: string
}

/** Résultat d'un appel HTTP brut, conservé pour que les tests puissent citer le vrai code HTTP. */
export interface RawResponse<T> {
  status: number
  body: T
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  token?: string,
): Promise<RawResponse<T>> {
  const response = await fetch(`${e2eEnv.apiBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  return { status: response.status, body: parsed as T }
}

async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${e2eEnv.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`POST ${path} -> ${response.status} ${text}`)
  }
  return response.json() as Promise<T>
}

/** Crée un compte élève de test unique, actif dès la création (consentements fournis). */
export async function createTestStudent(
  uniqueSuffix: string,
  firstName: string,
  lastName: string,
): Promise<CreatedAccount> {
  const loginIdentifier = `e2e.eleve.${uniqueSuffix}`
  const result = await postJson<{ student: CreatedAccount }>('/accounts/students', {
    email: `${loginIdentifier}@example.test`,
    password: 'E2eTest!2026',
    firstName,
    lastName,
    loginIdentifier,
    consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
  })
  return result.student
}

/** Crée un compte formateur de test unique, actif dès la création. */
export async function createTestTeacher(
  uniqueSuffix: string,
  firstName: string,
  lastName: string,
): Promise<CreatedAccount> {
  const loginIdentifier = `e2e.prof.${uniqueSuffix}`
  return postJson<CreatedAccount>('/accounts/teachers', {
    email: `${loginIdentifier}@example.test`,
    password: 'E2eTest!2026',
    firstName,
    lastName,
    loginIdentifier,
    consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
  })
}

/** Connexion RP — le rôle n'est pas auto-inscriptible, ce compte doit déjà exister. */
export async function loginAsRp(): Promise<string> {
  const result = await postJson<{ access_token: string }>('/auth/login', {
    loginIdentifier: e2eEnv.rpLoginIdentifier,
    password: e2eEnv.rpPassword,
  })
  return result.access_token
}

/** Lie un formateur à un élève, comme le ferait le RP depuis l'écran de mise en relation. */
export async function linkTeacherToStudent(
  rpToken: string,
  teacherId: string,
  studentId: string,
): Promise<void> {
  await postJson(
    '/relations/teacher-student',
    { teacherId, studentId, isPrincipalTeacher: true },
    rpToken,
  )
}

// ── Ajouts pour la preuve du flow « demande de professeur → notifications » ──
// Reprennent le même principe que ci-dessus (routes réelles, aucun mock), mais renvoient le
// couple {status, body} au lieu de lancer sur un code non-2xx : ces tests ont explicitement
// besoin de citer le vrai code HTTP de chaque étape, y compris quand elle échoue.

export interface CreatedAccountWithLink extends CreatedAccount {
  linkedAccount: (CreatedAccount & { created: boolean }) | null
}

/** Connexion générique — renvoie le jeton et l'identité, pour n'importe quel compte de test. */
export async function login(
  loginIdentifier: string,
  password: string,
): Promise<RawResponse<{ access_token: string; user: { id: string; role: string } }>> {
  return request('POST', '/auth/login', { loginIdentifier, password })
}

/**
 * Crée un élève et son parent financeur dans le même appel (`parentAccountMode: 'new'`), ce qui
 * crée automatiquement le lien finance-owner-student côté profile-service — nécessaire pour
 * prouver la notification au parent financeur sur `TeacherAssigned`.
 */
export async function createTestStudentWithParent(
  uniqueSuffix: string,
  studentFirstName: string,
  studentLastName: string,
  parentFirstName: string,
  parentLastName: string,
): Promise<{ student: CreatedAccount; parent: CreatedAccount }> {
  const studentLoginIdentifier = `e2e.notif.eleve.${uniqueSuffix}`
  const parentLoginIdentifier = `e2e.notif.parent.${uniqueSuffix}`
  const result = await postJson<{ student: CreatedAccount; parent: CreatedAccount }>(
    '/accounts/students',
    {
      email: `${studentLoginIdentifier}@example.test`,
      password: 'E2eTest!2026',
      firstName: studentFirstName,
      lastName: studentLastName,
      loginIdentifier: studentLoginIdentifier,
      consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
      parentAccountMode: 'new',
      parentLoginIdentifier,
      parentEmail: `${parentLoginIdentifier}@example.test`,
      parentFirstName,
      parentLastName,
    },
  )
  return result
}

/** Fait progresser un formateur jusqu'à `validated` (pending -> in_review -> validated), RP. */
export async function validateTeacher(rpToken: string, teacherId: string): Promise<void> {
  await request('PATCH', `/profiles/${teacherId}/validation`, { status: 'in_review' }, rpToken)
  await request('PATCH', `/profiles/${teacherId}/validation`, { status: 'validated' }, rpToken)
}

/** Étape 1 du flow : l'élève crée une demande de professeur. */
export async function createTeacherRequest(
  studentToken: string,
  description: string,
): Promise<RawResponse<{ id: string; status: string; studentId: string; studentName: string }>> {
  return request('POST', '/requests', { description }, studentToken)
}

/** Étape 3 : le RP envoie une proposition groupée à un ou plusieurs formateurs. */
export async function sendTeacherProposals(
  rpToken: string,
  requestId: string,
  teacherIds: string[],
  message: string,
): Promise<RawResponse<Array<{ id: string; teacherId: string; status: string }>>> {
  return request('POST', `/requests/${requestId}/proposals`, { teacherIds, message }, rpToken)
}

/** Étape 4 : le formateur accepte une proposition (candidature, pas encore une affectation). */
export async function acceptProposal(
  teacherToken: string,
  proposalId: string,
): Promise<RawResponse<{ id: string; status: string; requestStatus: string }>> {
  return request('POST', `/proposals/${proposalId}/accept`, {}, teacherToken)
}

/** Étape 6 : le RP valide l'acceptation retenue — crée l'affectation, clôture la demande. */
export async function validateTeacherRequest(
  rpToken: string,
  requestId: string,
  proposalId: string,
  isPrincipalTeacher = true,
): Promise<RawResponse<{ id: string; status: string; chosenTeacherId: string }>> {
  return request(
    'POST',
    `/requests/${requestId}/validate`,
    { proposalId, isPrincipalTeacher },
    rpToken,
  )
}

export interface NotificationRecord {
  id: string
  userId: string
  type: string
  isRead: boolean
  metadata: Record<string, unknown>
  createdAt: string
}

/** `GET /notifications/unread-count` — le compteur affiché par la cloche. */
export async function getUnreadCount(token: string): Promise<RawResponse<{ count: number }>> {
  return request('GET', '/notifications/unread-count', undefined, token)
}

/** `GET /notifications` — liste des notifications de l'appelant. */
export async function listNotifications(
  token: string,
): Promise<RawResponse<{ data: NotificationRecord[] }>> {
  return request('GET', '/notifications', undefined, token)
}

/** `POST /notifications/:id/read` — marque une notification comme lue. */
export async function markNotificationRead(
  token: string,
  notificationId: string,
): Promise<RawResponse<NotificationRecord>> {
  return request('POST', `/notifications/${notificationId}/read`, {}, token)
}

/**
 * Attend qu'une notification arrive pour ce jeton (compteur non-lu > 0), en interrogeant
 * `GET /notifications/unread-count` à intervalles réguliers — la consommation du flux Redis
 * par dashboard-notification-service est asynchrone (arbitrage du 2026-08-14).
 * Renvoie le nombre de secondes écoulées avant l'arrivée, ou -1 si rien n'est arrivé dans le
 * délai imparti (le test doit alors traiter ce -1 comme un échec explicite, jamais l'ignorer).
 */
export async function waitForUnreadNotification(
  token: string,
  timeoutMs = 20000,
  intervalMs = 2000,
): Promise<number> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { body } = await getUnreadCount(token)
    if ((body?.count ?? 0) > 0) {
      return Math.round((Date.now() - start) / 1000)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return -1
}

// ── Ajouts pour la preuve du point 4 (« le créneau accepté doit ouvrir une visio ») du
// chantier calendrier-visio-livekit — mêmes principes que ci-dessus : routes réelles, aucun mock.

/** Étape 1/2 du point 3, réutilisées sans re-test détaillé : le formateur propose un cours. */
export async function createCourseActivity(
  teacherToken: string,
  studentId: string,
  startTime: string,
  endTime: string,
  title = 'Cours e2e LiveKit',
): Promise<RawResponse<{ id: string; status: string }>> {
  return request(
    'POST',
    '/activities',
    { title, type: 'cours', participantIds: [studentId], startTime, endTime, description: 'Preuve e2e LiveKit' },
    teacherToken,
  )
}

/** L'élève accepte — POST /activities/:id/accept, voir docs/routes.md > calendar-service. */
export async function acceptActivity(
  studentToken: string,
  activityId: string,
): Promise<RawResponse<{ id: string; status: string }>> {
  return request('POST', `/activities/${activityId}/accept`, {}, studentToken)
}

export interface VideoRoomRecord {
  id: string
  activityId: string | null
  calendarSessionId: string | null
  status: string
  startedAt: string | null
  endedAt: string | null
}

/**
 * `GET /video/rooms/by-activity/:activityId` — résout la salle créée automatiquement pour un
 * cours confirmé. `404` tant que le consommateur Redis de video-session-service n'a pas encore
 * traité `ActivityConfirmed` (asynchrone, voir docs/routes.md > video-session-service).
 */
export async function fetchRoomByActivity(
  token: string,
  activityId: string,
): Promise<RawResponse<VideoRoomRecord>> {
  return request('GET', `/video/rooms/by-activity/${activityId}`, undefined, token)
}

/** `GET /video/rooms/:id/join` — vrai token LiveKit + URL du serveur (contrat du 2026-08-19). */
export async function joinVideoRoom(
  token: string,
  roomId: string,
): Promise<RawResponse<{ token: string; url: string }>> {
  return request('GET', `/video/rooms/${roomId}/join`, undefined, token)
}

/**
 * Attend que la salle vidéo liée à une activité confirmée existe (poll de
 * `GET /video/rooms/by-activity/:activityId`), le déclenchement passant par un flux Redis
 * asynchrone côté serveur (`video-session-service`, événement `ActivityConfirmed`). Renvoie la
 * salle dès son apparition, ou `null` si le délai est dépassé.
 */
export async function waitForVideoRoom(
  token: string,
  activityId: string,
  timeoutMs = 30000,
  intervalMs = 2000,
): Promise<VideoRoomRecord | null> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { status, body } = await fetchRoomByActivity(token, activityId)
    if (status === 200) return body
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return null
}
