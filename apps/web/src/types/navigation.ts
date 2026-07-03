/**
 * Types partagés — Navigation
 */

import type { UserRole } from './user'

export interface TopNavItem {
  id: string
  label: string
  path: string
  /** Rôles autorisés. Absent = accessible à tous les connectés. */
  allowedRoles?: UserRole[]
  /** Condition booléenne supplémentaire */
  condition?: boolean
}

export interface RailItem {
  label: string
  path: string
  icon?: string
  badge?: number
}

export interface RailGroup {
  groupLabel: string
  items: RailItem[]
}

/** Item de nav simplifié utilisé par DashboardShell (NavItem) */
export interface NavItem {
  label: string
  path: string
  badge?: number
}
