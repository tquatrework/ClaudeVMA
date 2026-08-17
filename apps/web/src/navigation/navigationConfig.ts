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
    id: 'contacts',
    label: 'Contacts',
    path: '/contacts',
    allowedRoles: [
      'eleve',
      'parent_financeur',
      'formateur',
      'responsable_pedagogique',
      'animateur_pedagogique',
    ],
  },
  {
    id: 'messages',
    label: 'Messages',
    path: '/messages',
    allowedRoles: [
      'eleve',
      'parent_financeur',
      'formateur',
      'responsable_pedagogique',
      'animateur_pedagogique',
      'technicien_informatique',
    ],
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
 * des écrans épars ». Ses deux files sont de la même famille — un dossier arrive,
 * il l'instruit, il tranche — et doivent donc être voisines dans le rail *et*
 * atteignables l'une depuis l'autre (`RpWorkQueueNav`).
 *
 * Deux entrées plutôt qu'une page à deux sections : les deux files n'ont ni la
 * même source (`profile-service` / `teacher-request-service`), ni la même
 * pagination, ni le même rythme de traitement. Les fusionner obligerait à charger
 * les deux pour en consulter une, ce que la règle de chargement au niveau de la
 * page (2026-08-10) déconseille.
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
        { label: 'Mémo', path: '/memos', icon: '💡' },
        { label: 'Carnet personnel', path: '/notebook/', icon: '📓' },
        { label: 'Stats / Archives', path: '/archives', icon: '🗂️' },
      ],
    },
    {
      groupLabel: 'Contenus',
      items: [
        { label: 'Exercices', path: '/content/exercises', icon: '📐' },
        { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
        { label: 'Tutos-vidéos', path: '/content/tutorials', icon: '🎬' },
      ],
    },
    {
      groupLabel: 'Communauté',
      items: [
        { label: 'Forums', path: '/community/forums', icon: '💬' },
        { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
        { label: 'Jeux', path: '/community/games', icon: '🎮' },
      ],
    },
  ],

  parent_financeur: [
    {
      groupLabel: 'Suivi élève',
      items: [
        { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
        { label: 'Calendrier', path: '/calendar', icon: '📅' },
        { label: 'Archives', path: '/archives', icon: '🗂️' },
      ],
    },
    {
      groupLabel: 'Démarches',
      items: [
        { label: 'Demande de rattachement', path: '/parent-link-requests', icon: '🔗' },
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
      ],
    },
    {
      groupLabel: 'Contenus',
      items: [
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

  responsable_pedagogique: [
    // Plan de travail du RP (arbitrage du 2026-08-12) : ses deux files sont
    // voisines et en tête de rail, pas dispersées dans « Gestion » et
    // « Validation ». Voir RP_WORK_QUEUES ci-dessous, qui les rend également
    // visibles l'une depuis l'autre.
    {
      groupLabel: 'À traiter',
      items: RP_WORK_QUEUES.map(({ label, path, icon }) => ({ label, path, icon })),
    },
    {
      groupLabel: 'Gestion',
      items: [
        { label: 'Comptes', path: '/admin/accounts', icon: '🔑' },
        { label: 'Délégations', path: '/delegations', icon: '🔗' },
      ],
    },
    {
      groupLabel: 'Validation',
      items: [
        { label: 'Contenus à valider', path: '/content/validation', icon: '✅' },
        { label: 'Demandes rattachement', path: '/parent-link-requests/inbox', icon: '👨‍👩‍👧' },
      ],
    },
    {
      groupLabel: 'Pédagogie',
      items: [
        { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
        { label: 'Archives', path: '/archives', icon: '🗂️' },
        { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
        { label: 'Forums', path: '/community/forums', icon: '💬' },
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
    {
      groupLabel: 'Mes contenus',
      items: [
        { label: 'Exercices', path: '/content/exercises', icon: '📐' },
        { label: 'Évaluations', path: '/content/evaluations', icon: '📝' },
        { label: 'Tutoriels vidéo', path: '/content/tutorials', icon: '🎬' },
        { label: 'File de validation', path: '/content/validation', icon: '✅' },
      ],
    },
    {
      groupLabel: 'Communauté',
      items: [
        { label: 'Forums', path: '/community/forums', icon: '💬' },
        { label: 'Parcours', path: '/community/paths', icon: '🗺️' },
      ],
    },
    {
      groupLabel: 'Suivi',
      items: [
        { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
        { label: 'Activités non pourvues', path: '/open-activities', icon: '📢' },
        { label: 'Activité globale', path: '/admin/activity', icon: '📊' },
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
