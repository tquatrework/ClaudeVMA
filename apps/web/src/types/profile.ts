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

/**
 * Bloc `visibility` de `GET /profiles/:userId` et `GET /profiles/:userId/statistics`
 * (`docs/routes.md` § « Application en lecture »).
 *
 * Contrat serveur, à respecter à la lettre — c'est lui qui rend les deux états
 * distinguables sans convention implicite :
 *
 * | Observation                                | Signification              |
 * |--------------------------------------------|----------------------------|
 * | clé **présente** valant `null`              | champ **non renseigné**    |
 * | clé **absente** + nom dans `hiddenFields`   | champ **masqué** par le titulaire |
 *
 * Un champ masqué n'est donc **jamais** remplacé par `null` ni par une chaîne
 * vide : il disparaît de son bloc. Tout code qui lit un champ de profil doit
 * accepter `undefined`.
 *
 * `isFiltered: false` signifie « fiche renvoyée en entier » : c'est le cas du
 * titulaire, du parent financeur rattaché et des administrateurs. Ce n'est pas
 * la même information qu'un `hiddenFields` vide chez un lecteur filtré dont tous
 * les champs se trouvent visibles — d'où deux données et non une.
 *
 * Le bloc est optionnel côté front : un serveur antérieur au 2026-08-09, ou une
 * réponse tronquée, ne doit pas faire passer la fiche pour filtrée.
 */
export interface ProfileVisibility {
  isFiltered: boolean
  hiddenFields: string[]
}

export interface Profile {
  userId: string
  loginIdentifier?: string | null
  administrative?: Record<string, unknown> | null
  /**
   * Profil pédagogique COMPLET, **sections confondues et à plat** : champs
   * déclaratifs (écrits par le titulaire) et champs de prescription (écrits par
   * le RP seul, lus par le titulaire). La séparation est portée par les listes
   * de `src/utils/profileFields.ts`, pas par la réponse serveur.
   *
   * Les champs masqués au lecteur en sont **absents** : ne jamais supposer
   * qu'une clé du catalogue s'y trouve.
   */
  pedagogical?: Record<string, unknown> | null
  pedagogicalType?: PedagogicalProfileType | null
  visibility?: ProfileVisibility
}

/**
 * Réponse d'une écriture de profil — `PUT /profiles/:userId/administrative`,
 * `PUT /profiles/:userId/pedagogical`, `PUT /profiles/:userId/prescription`.
 *
 * C'est un **bloc à plat**, jamais l'enveloppe de `GET /profiles/:userId` : les
 * trois routes renvoient `{userId, ...champs}`, la prescription y ajoutant le
 * profil pédagogique complet avec `filledBy`/`filledAt` posés côté serveur.
 *
 * Volontairement plus large que les interfaces de champs **écrivables** : la
 * réponse porte aussi ce que le serveur gère seul (`userId`, `createdAt`,
 * `updatedAt`, `avatarUrl`, `filledBy`, `filledAt`), qu'un `PUT` refuserait en
 * `400`. C'est cette réponse qui fait foi à l'écran après un enregistrement,
 * jamais le corps envoyé.
 */
export type SavedProfileBlock = Record<string, unknown>

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
 *
 * `department` en a été **retiré le 2026-08-11** (demande utilisateur) : la colonne
 * est droppée côté serveur et l'envoyer renvoie désormais
 * `400 property department should not exist`.
 *
 * `email` n'y figure pas et n'y figurera pas : l'adresse de contact appartient au
 * **compte** (`identity-access-service`), pas au profil. L'envoyer ici renvoie
 * `400 property email should not exist` — vérifié le 2026-08-11 contre la pile
 * réelle. Elle s'affiche depuis la session authentifiée, voir `AccountEmailField`.
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
  passions?: string[]
}

/**
 * Section DÉCLARATIVE du profil pédagogique ÉLÈVE — ce que l'élève déclare sur
 * lui-même, seuls champs acceptés par `PUT /profiles/:userId/pedagogical`.
 *
 * Il n'existe pas de champ `notes` : le besoin correspondant est `specificNeeds`.
 * `difficulties` (ce sur quoi l'élève bute) ne se confond pas avec
 * `specificNeeds` (aménagement reconnu : DYS, PAP, PPS).
 *
 * Le champ unique `context` a été **séparé le 2026-08-11** en `familyContext` et
 * `schoolContext` (demande utilisateur) ; l'envoyer renvoie désormais
 * `400 property context should not exist`. `schoolName` et `equipment` ont été
 * ajoutés au même moment. `equipment` est **un seul champ libre** : la parenthèse
 * de son libellé explique le contenu attendu, elle n'annonce pas deux sous-champs.
 */
export interface StudentDeclarativeFields {
  level?: string
  schoolName?: string
  goals?: string
  difficulties?: string
  specificNeeds?: string
  familyContext?: string
  schoolContext?: string
  equipment?: string
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
 * Réponse de `GET /profiles/:userId/statistics` — **enveloppe**, et non les
 * statistiques elles-mêmes : `{userId, profileType, statistics, visibility}`
 * (`docs/routes.md` § profile-service).
 *
 * En phase 1, `statistics` porte les données du **profil pédagogique** (`level`,
 * `subjects`, `isAnimateurPedagogique`…) : ses clés sont donc celles du catalogue
 * de champs, libellées par `src/utils/profileFieldLabels.ts` comme partout
 * ailleurs. Le front ne réinvente aucun indicateur.
 *
 * La route applique **les mêmes réglages de visibilité** que le bloc
 * `pedagogical` — sinon elle en serait le contournement exact. Les champs
 * masqués sont donc absents de `statistics` et nommés dans `visibility.hiddenFields`.
 *
 * Tous les membres sont optionnels : on ne suppose jamais qu'une clé est là.
 */
export interface ProfileStatisticsResponse {
  userId?: string
  profileType?: PedagogicalProfileType | null
  statistics?: Record<string, unknown> | null
  visibility?: ProfileVisibility
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

/**
 * Une entrée de l'annuaire des formateurs validés
 * (`GET /profiles/teachers/validated`, livrée le 2026-08-12).
 *
 * Contenu volontairement limité au **socle de visibilité** : rien de plus que
 * l'identifiant technique, le nom et les deux champs qui aident à choisir
 * (`docs/architecture.md` > « Annuaire des formateurs validés »).
 *
 * Deux nuances qui font contrat, à ne pas confondre :
 * - `levels` / `subjects` à `null` = **non renseigné** (le profil pédagogique est
 *   facultatif, arbitrage du 2026-08-07) ; `[]` = liste vide enregistrée ;
 * - `firstName` / `lastName` à `null` = **incohérence de données** côté serveur.
 *   Le formateur reste dans la liste (trié en fin) : un enregistrement abîmé ne
 *   doit priver le RP ni de l'annuaire, ni d'un libellé lisible.
 *
 * `userId` sert **uniquement** à désigner le formateur dans l'appel suivant ; il
 * n'est jamais affiché (arbitrage du 2026-08-09).
 */
export interface ValidatedTeacher {
  userId: string
  firstName: string | null
  lastName: string | null
  levels: string[] | null
  subjects: string[] | null
}

/**
 * Réponse de `GET /profiles/avatar/constraints` — contraintes d'envoi de la
 * photo de profil, **en vigueur côté serveur**.
 *
 * Ces valeurs ne sont jamais recopiées en dur dans le front : elles viennent de
 * la même configuration que celle opposée à l'envoi (`docs/routes.md`
 * § « Photo de profil »). Une copie divergerait au premier ajustement du
 * plafond et annoncerait alors une limite fausse — soit on refuserait
 * localement un fichier que le serveur aurait accepté, soit on laisserait
 * partir un envoi voué au `413`.
 */
export interface ProfileAvatarConstraints {
  /** Plafond en octets, appliqué aux octets du fichier avant ré-encodage. */
  maxUploadBytes: number
  /** Types MIME acceptés, ex. `image/jpeg`. */
  acceptedContentTypes: string[]
  /** Type produit après ré-encodage par le serveur, ex. `image/webp`. */
  outputContentType: string
  /** Côté maximal de l'image après redimensionnement, en pixels. */
  maxDimensionPixels: number
}
