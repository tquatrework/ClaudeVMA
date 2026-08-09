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
/**
 * Forme du profil pédagogique, telle que **déclarée par le serveur** dans
 * `pedagogicalType` (`GET /profiles/:userId`). `null` tant qu'aucun profil
 * pédagogique n'existe — état normal, ce profil étant facultatif.
 *
 * Le front ne devine plus le jeu de champs à partir du contenu : il lit ce que
 * le serveur annonce.
 */
export type PedagogicalProfileType = 'student' | 'teacher'

export interface Profile {
  userId: string
  loginIdentifier?: string | null
  administrative?: Record<string, unknown> | null
  /**
   * Profil pédagogique COMPLET, **sections confondues et à plat** : champs
   * déclaratifs (écrits par le titulaire) et champs de prescription (écrits par
   * le RP seul, lus par le titulaire). La séparation est portée par les listes
   * de `src/utils/profileFields.ts`, pas par la réponse serveur.
   */
  pedagogical?: Record<string, unknown> | null
  pedagogicalType?: PedagogicalProfileType | null
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
 * Section DÉCLARATIVE du profil pédagogique ÉLÈVE — ce que l'élève déclare sur
 * lui-même, seuls champs acceptés par `PUT /profiles/:userId/pedagogical`.
 *
 * Il n'existe pas de champ `notes` : le besoin correspondant est `specificNeeds`.
 * `difficulties` (ce sur quoi l'élève bute) ne se confond pas avec
 * `specificNeeds` (aménagement reconnu : DYS, PAP, PPS).
 */
export interface StudentDeclarativeFields {
  level?: string
  goals?: string
  specificNeeds?: string
  difficulties?: string
  context?: string
  subjects?: string[]
}

/**
 * Section DÉCLARATIVE du profil pédagogique FORMATEUR.
 *
 * `isAnimateurPedagogique` en est **absent** : c'est un droit attribué par
 * `POST /profiles/:teacherId/ap-status`, refusé en `400` sur cette route.
 * `testResults` en est absent aussi : c'est une évaluation menée par le RP,
 * passée en section prescription.
 */
export interface TeacherDeclarativeFields {
  levels?: string[]
  experience?: string
  diplomas?: string
  specialties?: string[]
  particularities?: string
  cvDocumentId?: string
  subjects?: string[]
}

export type DeclarativePedagogicalFields = StudentDeclarativeFields | TeacherDeclarativeFields

/**
 * Section PRESCRIPTION du profil pédagogique ÉLÈVE — `PUT /profiles/:userId/prescription`,
 * **RP seul**. Le titulaire les lit, ne les écrit jamais.
 */
export interface StudentPrescriptionFields {
  generalAssessment?: string
  recommendedPace?: string
  recommendedTeacherProfile?: string
  recommendedPath?: string
  recommendedActivities?: string
}

/** Section PRESCRIPTION du profil pédagogique FORMATEUR — **RP seul**. */
export interface TeacherPrescriptionFields {
  maxValidatedLevel?: string
  audienceType?: string
  testResults?: string
  testComments?: string
}

export type PrescriptionFields = StudentPrescriptionFields | TeacherPrescriptionFields

/**
 * Traçabilité de la prescription : qui l'a remplie et quand. Posés **par le
 * serveur**, jamais envoyés par le front (`400` sinon) — ce sont eux qui rendent
 * la prescription opposable.
 */
export interface PrescriptionAuthorship {
  filledBy?: string | null
  filledAt?: string | null
}

/**
 * Forme du profil pédagogique à éditer. `unknown` quand ni `pedagogicalType` ni
 * le rôle ne permettent de trancher (profil vierge d'un tiers) : aucun
 * formulaire n'est alors proposé, plutôt que d'écrire dans la mauvaise table.
 */
export type PedagogicalProfileKind = PedagogicalProfileType | 'unknown'

/**
 * Valeurs de formulaire — les champs `string[]` de l'API (`subjects`, `levels`,
 * `specialties`, `passions`) sont saisis en texte libre séparé par des virgules
 * et convertis à la frontière API par `src/utils/profileFields.ts`.
 */
export type StudentPedagogicalFormValues = Record<keyof StudentDeclarativeFields, string>

export type TeacherPedagogicalFormValues = Record<keyof TeacherDeclarativeFields, string>

export type PrescriptionFormValues = Record<
  keyof StudentPrescriptionFields | keyof TeacherPrescriptionFields,
  string
>

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

// ─── Visibilité champ par champ ───────────────────────────────────────────────

/**
 * Public autorisé à voir un champ (`GET|PUT /profiles/:userId/field-visibility`).
 * - `self` : le titulaire et les administrateurs seuls ;
 * - `linked` : aussi les personnes liées (parent↔élève, formateur↔élève, RP…) ;
 * - `all` : tout utilisateur authentifié.
 */
export type FieldVisibilityAudience = 'self' | 'linked' | 'all'

/**
 * Bloc de regroupement d'écran renvoyé par le serveur. Le front ne le calcule
 * pas : il se contente de grouper ce qui lui arrive.
 */
export type FieldVisibilityBlock =
  | 'administrative'
  | 'pedagogical-student'
  | 'pedagogical-teacher'

export interface FieldVisibilityEntry {
  fieldName: string
  block: FieldVisibilityBlock
  audience: FieldVisibilityAudience
  /** Valeur retenue quand l'utilisateur n'a rien réglé explicitement. */
  defaultAudience: FieldVisibilityAudience
  /** `true` si l'utilisateur a explicitement réglé ce champ. */
  isExplicit: boolean
  /** Champ de la section prescription : réglable, mais écrit par le RP. */
  isPrescription: boolean
  /** Champ conservé du modèle hérité, sans colonne le portant aujourd'hui. */
  isReserved: boolean
}

/**
 * Réponse de `GET /profiles/:userId/field-visibility` : le **catalogue complet**
 * (34 champs), valeurs par défaut comprises. Le front ne duplique donc ni la
 * liste des champs ni leurs défauts.
 */
export interface FieldVisibilitySettings {
  userId: string
  fields: FieldVisibilityEntry[]
}

/** Élément du corps de `PUT /profiles/:userId/field-visibility` (upsert partiel). */
export interface FieldVisibilityUpdate {
  fieldName: string
  audience: FieldVisibilityAudience
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
