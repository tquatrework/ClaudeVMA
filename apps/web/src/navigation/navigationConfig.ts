/**
 * Configuration de navigation centralisée — VisioMath
 *
 * Définit une seule fois :
 *   - les items de la navigation haute (topnav) avec les rôles autorisés
 *   - les groupes du rail gauche par rôle
 *
 * Les dashboards et le Layout filtrent depuis cette source unique.
 * Référence design : .claude/design/front-design.md
 */

import type { UserRole } from '../types/user'
import type { TopNavItem, RailGroup } from '../types/navigation'

/* ─────────────────────────────────────────────────────────
   NAVIGATION HAUTE
   Règle : Accueil + items filtrés par rôle
───────────────────────────────────────────────────────── */

export const TOP_NAV_CONFIG: TopNavItem[] = [
  {
    id: 'accueil',
    label: 'Accueil',
    path: '/dashboard',
    // Accessible à tous les rôles connectés
  },
  {
    id: 'calendrier',
    label: 'Calendrier',
    path: '/calendar',
    allowedRoles: [
      'eleve',
      'parent_financeur',
      'formateur',
      'animateur_pedagogique',
      'responsable_pedagogique',
    ],
  },
  {
    // Fusion « Contacts » + « Messages » (2026-09-04, demande explicite
    // utilisateur) : une seule entrée de menu du haut. L'envoi de message se
    // fait désormais uniquement depuis l'écran Contacts (bouton « Écrire »
    // sur une fiche contact, `ContactRow` → `/messages` avec le contact
    // présélectionné) — il n'y a plus d'entrée « Messagerie » séparée.
    // `allowedRoles` aligné sur `ROUTE_ACCESS_MAP['/contacts']`
    // (`routeAccessMap.ts`), qui autorisait déjà les 7 rôles avant cette
    // fusion : administrateur_financier et technicien_informatique avaient
    // le droit d'accéder à `/contacts` côté route mais n'avaient jamais de
    // lien pour y accéder depuis le menu — corrigé au passage (règle du
    // projet : ne jamais laisser un rôle avec accès sans point d'entrée).
    id: 'contacts',
    label: 'Contacts',
    path: '/contacts',
    allowedRoles: [
      'eleve',
      'parent_financeur',
      'formateur',
      'responsable_pedagogique',
      'animateur_pedagogique',
      'technicien_informatique',
      'administrateur_financier',
    ],
  },
  {
    // Ajouté au menu du haut le 2026-09-04 (demande explicite utilisateur),
    // positionné entre « Contacts » et « Stats / Archives » (repositionné le
    // même jour après un premier essai en dernière position, jugé mal placé
    // par l'utilisateur) — visible à TOUS les rôles connectés, pas
    // `allowedRoles` du tout, même convention que « Accueil » ci-dessus.
    // Auparavant réservé au rail gauche du RP (groupe « Contenu »,
    // reconstruction du 2026-09-02) et, séparément, au rail Communauté de
    // l'élève et de l'AP. community-path-service est réellement déployé
    // (`GET /api/v1/forums` répond 401 sans jeton, pas 404 — vérifié le
    // 2026-09-04) : ce n'est pas un lien mort.
    id: 'forums',
    label: 'Forums',
    path: '/community/forums',
  },
  {
    id: 'demandes',
    label: 'Demandes',
    path: '/teacher-requests',
    // Retiré du rôle élève le 2026-08-17 (demande explicite utilisateur) : l'entrée
    // vit désormais dans le rail gauche élève, sous le nom « Demandes professeurs »,
    // juste sous « Visio ». Conservée ici pour parent_financeur et responsable_pedagogique.
    allowedRoles: ['parent_financeur', 'responsable_pedagogique'],
  },
  {
    id: 'archives',
    label: 'Stats / Archives',
    path: '/archives',
    allowedRoles: [
      'eleve',
      'parent_financeur',
      'formateur',
      'responsable_pedagogique',
      'animateur_pedagogique',
      'administrateur_financier',
      'technicien_informatique',
    ],
  },
]

/**
 * Filtre les items de navigation haute selon le rôle courant.
 * Les items sans `allowedRoles` sont visibles pour tous les connectés.
 */
export function filterTopNavItems(
  role: UserRole | undefined,
  hasRoleFn: (...roles: UserRole[]) => boolean,
): TopNavItem[] {
  return TOP_NAV_CONFIG.filter((item) => {
    if (item.condition !== undefined) return item.condition
    if (item.allowedRoles && item.allowedRoles.length > 0) {
      return hasRoleFn(...item.allowedRoles)
    }
    return true
  })
}

/* ─────────────────────────────────────────────────────────
   PLAN DE TRAVAIL DU RESPONSABLE PÉDAGOGIQUE
───────────────────────────────────────────────────────── */

/**
 * Les files de travail du RP, déclarées **une seule fois**.
 *
 * L'arbitrage du 2026-08-12 le formule ainsi : « le RP a un plan de travail, pas
 * des écrans épars ». Ces files sont de la même famille — un dossier arrive,
 * il l'instruit, il tranche — et doivent donc être voisines dans le rail *et*
 * atteignables l'une depuis l'autre (`RpWorkQueueNav`).
 *
 * Étendu le 2026-09-02 (reconstruction du rail RP, `docs/architecture.md` >
 * « Reconstruction du rail gauche du Responsable Pédagogique (RP) ») de 2 à
 * 4 entrées, pour couvrir le groupe « À traiter » demandé tel quel : Nouveaux
 * Formateurs, Demandes professeurs, Demandes rattachement, Contenus à valider.
 *
 * Quatre entrées plutôt qu'une page à quatre sections : les files n'ont ni la
 * même source (`profile-service` / `teacher-request-service` /
 * `content-catalog-service`), ni la même pagination, ni le même rythme de
 * traitement. Les fusionner obligerait à charger les quatre pour en consulter
 * une, ce que la règle de chargement au niveau de la page (2026-08-10)
 * déconseille.
 */
export const RP_WORK_QUEUES = [
  {
    id: 'teacher-validations',
    label: 'Nouveaux formateurs',
    shortLabel: 'Formateurs',
    path: '/rp/teacher-validations',
    icon: '🧑‍🏫',
    description: 'Formateurs inscrits en attente d\'examen.',
  },
  {
    id: 'teacher-requests',
    label: 'Demandes professeurs',
    shortLabel: 'Demandes',
    path: '/teacher-requests',
    icon: '🎓',
    description: 'Demandes des élèves à instruire.',
  },
  {
    id: 'parent-link-requests',
    label: 'Demandes rattachement',
    shortLabel: 'Rattachements',
    path: '/parent-link-requests/inbox',
    icon: '👨‍👩‍👧',
    description: 'Demandes de rattachement parent financeur ↔ élève en attente.',
  },
  {
    id: 'content-validation',
    label: 'Contenus à valider',
    shortLabel: 'Contenus',
    path: '/content/validation',
    icon: '✅',
    description: 'Quizz, exercices, évaluations et tutoriels soumis à validation.',
  },
] as const

export type RpWorkQueue = (typeof RP_WORK_QUEUES)[number]

/* ─────────────────────────────────────────────────────────
   RAIL GAUCHE PAR RÔLE
───────────────────────────────────────────────────────── */

export const RAIL_GROUPS_BY_ROLE: Record<UserRole, RailGroup[]> = {
  eleve: [
    {
      groupLabel: 'Cours',
      items: [
        { label: 'Visio', path: '/activities', icon: '🎥' },
        // Déplacé depuis le menu du haut le 2026-08-17 (demande explicite utilisateur) :
        // l'entrée « Demandes » du menu du haut, côté élève, devient « Demandes
        // professeurs » ici, juste sous « Visio ». Route inchangée.
        { label: 'Demandes professeurs', path: '/teacher-requests', icon: '🎓' },
        { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
        { label: 'Mémos', path: '/memos', icon: '💡' },
        // Route générique depuis le 2026-08-27 (plus de /notebook/:studentId,
        // titulaire déduit du JWT) — identique pour tous les rôles qui y ont accès.
        { label: 'Carnet personnel', path: '/notebook/mine', icon: '📓' },
        // 'Stats / Archives' retiré du rail le 2026-08-27 (demande explicite
        // utilisateur) : l'entrée reste accessible pour l'élève via le menu du
        // haut (TOP_NAV_CONFIG, id 'archives'), qui l'ouvre déjà.
      ],
    },
    {
      groupLabel: 'Contenus',
      items: [
        // 'Quizz' ajouté en première position le 2026-08-27 (demande explicite
        // utilisateur), branché sur la pile réelle le 2026-08-28
        // (content-catalog-service PR #152, learning-activity-service PR #151) —
        // recherche, passage et historique, voir QuizzPage/QuizDetailPage.
        { label: 'Quizz', path: '/content/quizz', icon: '❓' },
        { label: 'Exercices', path: '/content/exercises', icon: '📐' },
        { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
        { label: 'Tutos-vidéos', path: '/content/tutorials', icon: '🎬' },
      ],
    },
    {
      // 'Forums' retiré de ce groupe le 2026-09-04 : l'entrée vit désormais
      // dans le menu du haut (TOP_NAV_CONFIG, id 'forums'), visible à tous
      // les rôles connectés — la dupliquer ici serait un second lien vers la
      // même destination, contraire à la règle de non-duplication de la
      // navigation.
      groupLabel: 'Communauté',
      items: [
        { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
        { label: 'Jeux', path: '/community/games', icon: '🎮' },
      ],
    },
  ],

  parent_financeur: [
    // 'Démarches' repositionné tout en haut du rail le 2026-08-27 (demande
    // explicite utilisateur) — avant tout le reste, y compris 'Suivi élève'.
    {
      groupLabel: 'Démarches',
      items: [
        { label: 'Demande de rattachement', path: '/parent-link-requests', icon: '🔗' },
      ],
    },
    {
      groupLabel: 'Suivi élève',
      items: [
        { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
        { label: 'Calendrier', path: '/calendar', icon: '📅' },
        // 'Archives' retiré le 2026-08-27 (demande explicite utilisateur).
      ],
    },
    {
      groupLabel: 'Compte',
      items: [
        { label: 'Profil financier', path: '/finance', icon: '💳' },
      ],
    },
  ],

  formateur: [
    {
      groupLabel: 'Cours',
      items: [
        { label: 'Visio', path: '/activities', icon: '🎥' },
        { label: 'Propositions reçues', path: '/teacher-requests', icon: '📋' },
      ],
    },
    {
      groupLabel: 'Suivi',
      items: [
        { label: 'Mes élèves', path: '/my-students', icon: '👥' },
        { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
        // 'Carnet personnel' ajouté en dernière position le 2026-08-27 (demande
        // explicite utilisateur) : carnet strictement privé du formateur —
        // même route générique que les autres rôles (NotebookPage), le
        // titulaire est déduit du JWT (chantier de généralisation
        // pedagogical-log-service, PR #140).
        { label: 'Carnet personnel', path: '/notebook/mine', icon: '📓' },
      ],
    },
    {
      groupLabel: 'Contenus',
      items: [
        // 'Quizz' repositionné en première position le 2026-08-28 (demande
        // explicite utilisateur, correctif de positionnement) : ajouté en
        // dernière position le 2026-08-27 faute de consigne d'ordre explicite
        // pour ce rôle, alors que la règle posée pour l'élève le même jour
        // était déjà « Quizz en première position du groupe Contenus ». Branché
        // sur la pile réelle le 2026-08-28, voir QuizzPage/QuizDetailPage.
        { label: 'Quizz', path: '/content/quizz', icon: '❓' },
        { label: 'Exercices', path: '/content/exercises', icon: '📐' },
        { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
        { label: 'Tutos-vidéos', path: '/content/tutorials', icon: '🎬' },
      ],
    },
    {
      groupLabel: 'Compte',
      items: [
        { label: 'Rémunérations', path: '/teacher-payment-requests', icon: '💰' },
      ],
    },
  ],

  // Rail reconstruit le 2026-09-02 (`docs/architecture.md` > « Reconstruction
  // du rail gauche du Responsable Pédagogique (RP) »), structure demandée
  // telle quelle par l'utilisateur : Gestion (Comptes, Délégations,
  // Visualisation) → À traiter (les 4 files de RP_WORK_QUEUES) → Contenu
  // (Quizz, Exercices, Évaluations, Tutos/Vidéos, Forums, Parcours, Jeux) →
  // Observabilité (inchangé). Remplace l'ancien découpage
  // À traiter / Gestion / Validation / Pédagogie / Observabilité.
  //
  // Deux entrées de l'ancien groupe « Pédagogie » n'ont pas de repreneur dans
  // la structure demandée : « Cahier de texte » (`/pedagogical-log`) et
  // « Archives » (`/archives`). Archives reste atteignable pour le RP via le
  // menu du haut (TOP_NAV_CONFIG, id 'archives', déjà ouvert à
  // responsable_pedagogique) ; Cahier de texte perd tout point d'entrée
  // depuis le rail RP — signalé comme régression potentielle dans le rapport
  // de livraison, la route (`/pedagogical-log`) reste ouverte au RP côté
  // serveur, seul le raccourci de rail disparaît.
  responsable_pedagogique: [
    {
      groupLabel: 'Gestion',
      items: [
        { label: 'Comptes', path: '/admin/accounts', icon: '🔑' },
        { label: 'Délégations', path: '/delegations', icon: '🔗' },
        // 'Visualisation' — nouveau le 2026-09-02 : accès structuré du RP aux
        // fiches élèves / parents / professeurs / AP. Annuaire réel pour les
        // formateurs validés (`GET /profiles/teachers/validated`) ; élèves,
        // parents et AP n'ont aujourd'hui aucune route de liste côté serveur
        // — signalé explicitement à l'écran plutôt que simulé.
        { label: 'Visualisation', path: '/rp/visualisation', icon: '👁️' },
      ],
    },
    // Plan de travail du RP (arbitrage du 2026-08-12, étendu le 2026-09-02) :
    // ses files sont voisines et en tête utile du rail, pas dispersées dans
    // « Gestion » et « Validation ». Voir RP_WORK_QUEUES ci-dessus, qui les
    // rend également visibles l'une depuis l'autre (`RpWorkQueueNav`).
    {
      groupLabel: 'À traiter',
      items: RP_WORK_QUEUES.map(({ label, path, icon }) => ({ label, path, icon })),
    },
    {
      groupLabel: 'Contenu',
      items: [
        // 'Quizz' : le RP est un créateur autorisé
        // (docs/architecture.md > « Fonctionnalite Quizz »), auto-validé à la
        // création — sans cette entrée il n'aurait aucun moyen d'atteindre le
        // formulaire de création. La file de validation des quizz créés par
        // les professeurs reste accessible via « Contenus à valider » (groupe
        // « À traiter » ci-dessus).
        { label: 'Quizz', path: '/content/quizz', icon: '❓' },
        { label: 'Exercices', path: '/content/exercises', icon: '📐' },
        { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
        { label: 'Tutos/Vidéos', path: '/content/tutorials', icon: '🎬' },
        // 'Forums' retiré de ce groupe le 2026-09-04 (demande explicite
        // utilisateur, reconstruction du menu du haut) : accessible à tous
        // les rôles depuis TOP_NAV_CONFIG (id 'forums'), plus seulement
        // depuis ce rail — retirer ici évite une double entrée vers la même
        // destination.
        { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
        // 'Jeux' — route déjà réelle (`GamesPage`, ressources externes
        // statiques), jusqu'ici réservée au rôle élève. Ouverte au RP le
        // 2026-09-02 (App.tsx + routeAccessMap.ts) pour honorer la demande
        // explicite, sans construire de nouvel écran.
        { label: 'Jeux', path: '/community/games', icon: '🎮' },
      ],
    },
    {
      groupLabel: 'Observabilité',
      items: [
        { label: 'Activité globale', path: '/admin/activity', icon: '📊' },
        { label: 'Santé services', path: '/admin/observability/health', icon: '❤️' },
      ],
    },
  ],

  animateur_pedagogique: [
    // Groupe 'Suivi' repositionné tout en haut du rail le 2026-08-27 (demande
    // explicite utilisateur), et enrichi de deux entrées :
    //  - 'Carnet personnel' : carnet strictement privé de l'AP — même route
    //    générique que les autres rôles (NotebookPage), le titulaire est
    //    déduit du JWT (chantier de généralisation pedagogical-log-service,
    //    PR #140).
    //  - 'Mes professeurs' : liste des formateurs que l'AP anime. Réutilise
    //    /my-students (GET /relations/my-contacts, relation animator_of_teacher
    //    déjà gérée par MyStudentsPage/isSupervisedContact) — aucune nouvelle
    //    route ni nouveau composant nécessaire.
    // 'Cahier de texte' est retiré de ce groupe (demande explicite utilisateur).
    // Les deux entrées déjà présentes ('Activités non pourvues', 'Activité
    // globale') restent dans ce même groupe 'Suivi', simplement déplacé en
    // tête plutôt que dupliqué sous un second groupe au même libellé.
    {
      groupLabel: 'Suivi',
      items: [
        { label: 'Carnet personnel', path: '/notebook/mine', icon: '📓' },
        { label: 'Mes professeurs', path: '/my-students', icon: '👥' },
        { label: 'Activités non pourvues', path: '/open-activities', icon: '📢' },
        { label: 'Activité globale', path: '/admin/activity', icon: '📊' },
      ],
    },
    {
      groupLabel: 'Mes contenus',
      items: [
        // 'Quizz' ajouté le 2026-08-28 : l'AP est un créateur autorisé
        // (docs/architecture.md > « Fonctionnalite Quizz »), auto-validé à la
        // création, comme le RP.
        { label: 'Quizz', path: '/content/quizz', icon: '❓' },
        { label: 'Exercices', path: '/content/exercises', icon: '📐' },
        { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
        { label: 'Tutoriels vidéo', path: '/content/tutorials', icon: '🎬' },
        { label: 'File de validation', path: '/content/validation', icon: '✅' },
      ],
    },
    {
      // 'Forums' retiré de ce groupe le 2026-09-04, même motif que pour le
      // RP et l'élève ci-dessus : désormais dans le menu du haut, visible à
      // tous.
      groupLabel: 'Communauté',
      items: [
        { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
      ],
    },
  ],

  administrateur_financier: [
    {
      groupLabel: 'Finance',
      items: [
        { label: 'Profils financiers', path: '/finance', icon: '💳' },
        { label: 'Paiements formateurs', path: '/teacher-payment-requests', icon: '💰' },
        { label: 'Modèles légaux', path: '/legal/templates', icon: '📄' },
      ],
    },
    {
      groupLabel: 'Administration',
      items: [
        { label: 'Activité globale', path: '/admin/activity', icon: '📊' },
        { label: 'Délégations', path: '/delegations', icon: '🔑' },
        { label: 'Workflows', path: '/admin/orchestration/workflows', icon: '⚙️' },
      ],
    },
  ],

  technicien_informatique: [
    {
      groupLabel: 'Observabilité',
      items: [
        { label: 'Logs d\'activité', path: '/admin/observability/activity-log', icon: '📋' },
        { label: 'Logs techniques', path: '/admin/observability/technical-logs', icon: '🔧' },
        { label: 'État des services', path: '/admin/observability/health', icon: '❤️' },
      ],
    },
    {
      groupLabel: 'Administration',
      items: [
        { label: 'Comptes', path: '/admin/accounts', icon: '👥' },
        { label: 'Masquages', path: '/admin/observability/visibility-overrides', icon: '🙈' },
        { label: 'Métadonnées site', path: '/admin/observability/site-metadata', icon: '⚙️' },
      ],
    },
    {
      groupLabel: 'Incidents & Workflows',
      items: [
        { label: 'Incidents', path: '/incidents', icon: '⚠️' },
        { label: 'Workflows', path: '/admin/orchestration/workflows', icon: '🔄' },
        { label: 'Retries', path: '/admin/orchestration/retry', icon: '↩️' },
      ],
    },
  ],
}

/**
 * Retourne les groupes du rail gauche pour un rôle donné.
 */
export function getRailGroupsForRole(role: UserRole): RailGroup[] {
  return RAIL_GROUPS_BY_ROLE[role] ?? []
}
