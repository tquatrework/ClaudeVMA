/**
 * Types partagés — Dashboard et notifications
 * Source API : GET /notifications · GET /contacts · GET /dashboards/me
 */

export interface DashboardNotification {
  id: string
  message: string
  read: boolean
  createdAt: string
}

export interface DashboardContact {
  id: string
  displayName?: string
  role?: string
  email?: string
  status: string
  mandatory: boolean
}

export interface DashboardReminder {
  id: string
  title: string
  dueAt?: string
}
