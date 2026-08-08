/**
 * Types partagés — Profil utilisateur (profile-service)
 * Partagés entre ProfilePage, ProfileEditPage, TeacherValidationPanel, etc.
 */

/**
 * Réponse de `GET /profiles/:userId` (profile-service).
 *
 * Les rubriques s'appellent `administrative` / `pedagogical`. C'est le seul nom de
 * ces données dans le front — y compris pour les états locaux de formulaire
 * (arbitrage : un seul nom par donnée, voir `docs/architecture.md`).
 *
 * `pedagogical: null` est un état NORMAL : l'utilisateur renseigne son profil
 * pédagogique quand il le souhaite. À afficher comme « non renseigné », jamais
 * comme une erreur.
 */
export interface Profile {
  userId: string
  loginIdentifier?: string | null
  administrative?: Record<string, unknown> | null
  pedagogical?: Record<string, unknown> | null
}

/**
 * Nom d'affichage d'une personne, tel que renvoyé par les routes de relations
 * (`financeOwnerName` de `GET /relations/finance-owner-student/by-student/:studentId`,
 * `studentName` de `GET /relations/finance-owner-student/:financeOwnerId`).
 *
 * `null` (l'objet entier) quand la personne n'a pas de profil administratif ;
 * `firstName`/`lastName` peuvent être `null` individuellement.
 */
export interface PersonName {
  firstName?: string | null
  lastName?: string | null
}

export interface InternalNote {
  id: string
  authorId: string
  content: string
  createdAt: string
  updatedAt?: string
}

export interface TeacherStudentRelation {
  teacherId: string
  studentId: string
  isPrincipalTeacher?: boolean
  createdAt?: string
}

export interface CoordinatorRelation {
  coordinatorId: string
  studentId: string
  coordinatorRole: string
}

/**
 * Champs du profil administratif — noms EXACTS acceptés en écriture par
 * `PUT /profiles/:userId/administrative` et renvoyés dans le bloc `administrative`
 * de `GET /profiles/:userId` (docs/routes.md § « Noms de champs des profils »).
 *
 * Liste exhaustive et fermée côté serveur : tout champ absent d'ici fait échouer
 * la requête en `400` (`forbidNonWhitelisted`). Ne jamais y réintroduire `address`
 * (l'adresse est découpée en `addressLine1` / `addressLine2`) ni un nom français.
 */
export interface AdministrativeProfileFields {
  firstName?: string
  lastName?: string
  birthDate?: string
  phone?: string
  addressLine1?: string
  addressLine2?: string
  postalCode?: string
  city?: string
  country?: string
  avatarUrl?: string
  department?: string
  passions?: string[]
}

/**
 * Champs du profil pédagogique ÉLÈVE — `PUT /profiles/:userId/pedagogical`.
 *
 * `level`, `goals` et `specificNeeds` sont **discriminants** : leur présence dans
 * le body cible le profil élève côté serveur. `subjects` ne discrimine jamais.
 * Il n'existe pas de champ `notes` : le besoin correspondant est `specificNeeds`.
 */
export interface StudentPedagogicalProfileFields {
  level?: string
  goals?: string
  specificNeeds?: string
  subjects?: string[]
}

/**
 * Champs du profil pédagogique FORMATEUR — `PUT /profiles/:userId/pedagogical`.
 *
 * Forme distincte de celle de l'élève : `levels` au pluriel et en tableau,
 * `experience`, `testResults`. Un body sans champ discriminant élève cible ce
 * profil.
 */
export interface TeacherPedagogicalProfileFields {
  levels?: string[]
  experience?: string
  testResults?: string
  subjects?: string[]
  isAnimateurPedagogique?: boolean
}

export type PedagogicalProfileFields =
  | StudentPedagogicalProfileFields
  | TeacherPedagogicalProfileFields

/**
 * Forme du profil pédagogique à éditer. `unknown` quand le front ne peut pas la
 * déterminer (profil vierge d'un tiers dont le rôle n'est pas exposé par
 * `GET /profiles/:userId`) : aucun formulaire n'est alors proposé, plutôt que de
 * risquer d'écrire dans la mauvaise table.
 */
export type PedagogicalProfileKind = 'student' | 'teacher' | 'unknown'

/**
 * Valeurs de formulaire — les champs `string[]` de l'API (`subjects`, `levels`,
 * `passions`) sont saisis en texte libre séparé par des virgules et convertis à
 * la frontière API par `src/utils/profileFields.ts`.
 */
export interface StudentPedagogicalFormValues {
  level: string
  subjects: string
  goals: string
  specificNeeds: string
}

export interface TeacherPedagogicalFormValues {
  levels: string
  subjects: string
  experience: string
  testResults: string
}

/**
 * Statistiques pédagogiques d'un utilisateur (ProfileStatisticsPanel).
 * Écart : `GET /profiles/:userId/statistics` n'apparaît pas dans docs/routes.md.
 */
export interface PedagogicalStatistics {
  totalSessionsAttended?: number
  totalHoursLearned?: number
  averageSessionDurationMinutes?: number
  lastSessionDate?: string
  subjectsStudied?: string[]
  currentLevel?: string
  progressScore?: number
}

/**
 * Préférences de confidentialité d'un élève (ProfileVisibilitySettingsPage).
 * Écart : `GET/PATCH /profiles/:userId/visibility-preferences` n'apparaissent pas
 * dans docs/routes.md.
 */
export interface VisibilityPreferences {
  showEmailToTeachers: boolean
  showPhoneToTeachers: boolean
  showAddressToTeachers: boolean
  showProgressToParents: boolean
  showCalendarToParents: boolean
}

/**
 * Statut de validation d'un formateur (TeacherValidationPanel, RP/TI uniquement).
 * Écart : `GET/PATCH /profiles/:teacherId/validation` n'apparaissent pas dans
 * docs/routes.md (seul `POST /profiles/:teacherId/ap-status` y est documenté).
 */
export interface TeacherValidationStatus {
  teacherId: string
  validationStatus: 'pending' | 'in_review' | 'validated' | 'rejected'
  validatedAt?: string
  validatedBy?: string
  rejectionReason?: string
}

export interface UpdateTeacherValidationPayload {
  validationStatus: 'in_review' | 'validated' | 'rejected'
  rejectionReason?: string
}
