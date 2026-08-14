import { useContext } from 'react'
import { NotificationsContext } from '../context/NotificationsContext'

/**
 * Returns the shared notifications state (cloche). Must be used inside
 * <NotificationsProvider>. Modelé sur `useAuth.ts`.
 */
export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotifications must be used inside <NotificationsProvider>')
  }
  return ctx
}
