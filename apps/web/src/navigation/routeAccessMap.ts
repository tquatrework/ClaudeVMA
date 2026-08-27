/**
 * routeAccessMap — table de correspondance route → rôles autorisés
 *
 * Chaque entrée reflète exactement les `allowedRoles` de App.tsx.
 * Les routes sans restriction de rôle (ProtectedRoute sans allowedRoles)
 * ne figurent pas ici — elles sont accessibles à tout connecté.
 *
 * Clé : préfixe de path (ex: "/admin/accounts" couvre "/admin/accounts" et
 * "/admin/accounts/..."). On teste la correspondance par startsWith.
 *
 * Extrait de navigationFilters (lot 10 — normalisation, découpage > 300 lignes) :
 * données statiques séparées de la logique canAccess/useCanAccess.
 */

import type { UserRole } from '../types/user'

export interface RouteAccessRule {
  prefix: string
  roles: UserRole[]
}

export const ROUTE_ACCESS_MAP: RouteAccessRule[] = [
  // Demandes professeur
  {
    prefix: '/teacher-requests',
    roles: ['eleve', 'parent_financeur', 'formateur', 'responsable_pedagogique'],
  },
  // `/rp/teacher-requests` n'est plus qu'une redirection vers `/teacher-requests` :
  // mêmes rôles que la règle ci-dessus, pas de règle propre à maintenir en double.
  {
    prefix: '/rp/teacher-requests',
    roles: ['eleve', 'parent_financeur', 'formateur', 'responsable_pedagogique'],
  },

  // Calendrier
  {
    prefix: '/calendar',
    roles: [
      'eleve',
      'parent_financeur',
      'formateur',
      'responsable_pedagogique',
      'animateur_pedagogique',
      'technicien_informatique',
      'administrateur_financier',
    ],
  },

  // Activités
  {
    prefix: '/activities',
    roles: ['eleve', 'parent_financeur', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique'],
  },

  // Messages
  {
    prefix: '/messages',
    roles: [
      'eleve',
      'parent_financeur',
      'formateur',
      'responsable_pedagogique',
      'animateur_pedagogique',
      'technicien_informatique',
    ],
  },

  // Cahier de texte — animateur_pedagogique ajouté le 2026-08-20 (voir App.tsx,
  // même commentaire : l'item de rail existait déjà pour l'AP, la route non).
  {
    prefix: '/pedagogical-log',
    roles: ['eleve', 'formateur', 'responsable_pedagogique', 'parent_financeur', 'animateur_pedagogique'],
  },

  // Mémos — liste
  {
    prefix: '/memos',
    roles: ['eleve'],
  },

  // Contacts
  {
    prefix: '/contacts',
    roles: [
      'eleve',
      'parent_financeur',
      'formateur',
      'responsable_pedagogique',
      'animateur_pedagogique',
      'technicien_informatique',
      'administrateur_financier',
    ],
  },

  // Mes élèves
  {
    prefix: '/my-students',
    roles: ['formateur', 'responsable_pedagogique', 'animateur_pedagogique', 'parent_financeur'],
  },

  // Carnet personnel — route générique unique depuis le 2026-08-27
  // (chantier de généralisation pedagogical-log-service, PR #140) : plus de
  // /notebook/:studentId, le titulaire est déduit du JWT. Rôles limités à
  // ceux explicitement demandés pour cette session (élève, formateur, AP) —
  // le backend autoriserait davantage de rôles, mais aucune entrée de menu
  // n'a été demandée pour eux.
  {
    prefix: '/notebook/mine',
    roles: ['eleve', 'formateur', 'animateur_pedagogique'],
  },

  // Demandes de rattachement parent↔élève
  {
    prefix: '/parent-link-requests',
    roles: ['parent_financeur', 'eleve', 'responsable_pedagogique', 'technicien_informatique'],
  },

  // Activité globale admin
  {
    prefix: '/admin/activity',
    roles: [
      'responsable_pedagogique',
      'animateur_pedagogique',
      'technicien_informatique',
      'administrateur_financier',
    ],
  },

  // Gestion des comptes
  {
    prefix: '/admin/accounts',
    roles: ['responsable_pedagogique', 'technicien_informatique'],
  },

  // Délégations
  {
    prefix: '/delegations',
    roles: ['responsable_pedagogique', 'technicien_informatique', 'administrateur_financier'],
  },

  // Finance
  {
    prefix: '/finance',
    roles: [
      'parent_financeur',
      'administrateur_financier',
      'responsable_pedagogique',
      'technicien_informatique',
    ],
  },
  {
    prefix: '/admin/finance',
    roles: ['administrateur_financier'],
  },

  // Paiements formateurs
  {
    prefix: '/teacher-payment-requests',
    roles: ['formateur', 'administrateur_financier'],
  },

  // Documents légaux
  {
    prefix: '/legal',
    roles: [
      'administrateur_financier',
      'responsable_pedagogique',
      'technicien_informatique',
      'parent_financeur',
    ],
  },

  // Statistiques et archives pédagogiques
  // `animateur_pedagogique` ajouté le 2026-08-11 : TOP_NAV_CONFIG lui affichait
  // déjà « Stats / Archives » alors que cette table l'en excluait — il tombait
  // sur /forbidden depuis son propre menu.
  {
    prefix: '/archives',
    roles: [
      'eleve',
      'parent_financeur',
      'formateur',
      'animateur_pedagogique',
      'responsable_pedagogique',
      'administrateur_financier',
      'technicien_informatique',
    ],
  },

  // Contenu pédagogique
  {
    prefix: '/content/quizz',
    // 'Quizz' ajouté le 2026-08-27 : présent uniquement au rail élève et
    // formateur (navigationConfig.ts) — état « à venir », voir QuizzPage.
    roles: ['eleve', 'formateur'],
  },
  {
    prefix: '/content/exercises',
    roles: ['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique'],
  },
  {
    prefix: '/content/tutorials',
    roles: ['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique'],
  },
  {
    prefix: '/content/validation',
    roles: ['responsable_pedagogique', 'animateur_pedagogique'],
  },

  // Activités non pourvues
  {
    prefix: '/open-activities',
    roles: ['formateur', 'responsable_pedagogique', 'animateur_pedagogique'],
  },

  // Export activités
  {
    prefix: '/admin/activities/export',
    roles: [
      'responsable_pedagogique',
      'animateur_pedagogique',
      'technicien_informatique',
      'administrateur_financier',
    ],
  },

  // Community
  {
    prefix: '/community/forums',
    roles: ['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique'],
  },
  {
    prefix: '/community/paths',
    roles: ['eleve', 'formateur', 'responsable_pedagogique', 'animateur_pedagogique'],
  },
  {
    prefix: '/community/games',
    roles: ['eleve'],
  },

  // Admin observabilité
  {
    prefix: '/admin/observability',
    roles: [
      'technicien_informatique',
      'responsable_pedagogique',
      'administrateur_financier',
    ],
  },

  // Orchestration
  {
    prefix: '/admin/orchestration',
    roles: [
      'technicien_informatique',
      'responsable_pedagogique',
      'administrateur_financier',
    ],
  },

  // Incidents (accessible à tous les connectés selon App.tsx — pas de allowedRoles)
  // → non listé ici, accessible par défaut

  // Jeux
  {
    prefix: '/community/games',
    roles: ['eleve'],
  },
]
