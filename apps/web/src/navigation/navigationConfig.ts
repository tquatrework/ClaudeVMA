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
    allowedRoles: ['eleve', 'parent_financeur', 'responsable_pedagogique'],
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
   RAIL GAUCHE PAR RÔLE
───────────────────────────────────────────────────────── */

export const RAIL_GROUPS_BY_ROLE: Record<UserRole, RailGroup[]> = {
  eleve: [
    {
      groupLabel: 'Cours',
      items: [
        { label: 'Visio', path: '/activities', icon: '🎥' },
        { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
        { label: 'Mémo', path: '/memos', icon: '💡' },
        { label: 'Carnet personnel', path: '/notebook/', icon: '📓' },
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
    {
      groupLabel: 'Compte',
      items: [
        { label: 'Documents légaux', path: '/legal', icon: '📄' },
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
        { label: 'Documents légaux', path: '/legal', icon: '📄' },
      ],
    },
  ],

  formateur: [
    {
      groupLabel: 'Cours',
      items: [
        { label: 'Visio', path: '/activities', icon: '🎥' },
        { label: 'Demandes ouvertes', path: '/open-activities', icon: '📢' },
      ],
    },
    {
      groupLabel: 'Suivi',
      items: [
        { label: 'Cahier de texte', path: '/pedagogical-log', icon: '📖' },
        { label: 'Mes élèves', path: '/my-students', icon: '👥' },
        { label: 'Demandes prof.', path: '/teacher-requests', icon: '📋' },
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
        { label: 'Documents légaux', path: '/legal', icon: '📄' },
      ],
    },
  ],

  responsable_pedagogique: [
    {
      groupLabel: 'Gestion',
      items: [
        { label: 'Demandes professeurs', path: '/rp/teacher-requests', icon: '🎓' },
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
