import { fetchLinkedStudents, fetchStudentProfile } from '../../api/relations'
import { fetchUserEvents } from '../../api/calendar'
import type { CalendarEvent } from '../../types/calendar'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage } from '../../utils/apiError'
import { getFutureEvents } from '../../utils/dashboardFormat'

export interface StudentCard {
  studentId: string
  displayName: string
  loginIdentifier: string | null
  nextCourse: CalendarEvent | null
  /**
   * Message d'erreur si le calendrier de cet élève n'a pas pu être chargé — n'empêche jamais
   * l'affichage des autres cartes élève (chargement indépendant, `Promise.all` sans rejet
   * global : chaque échec est capturé localement dans son propre traitement).
   */
  calendarError: string | null
}

async function loadStudentCard(studentId: string): Promise<StudentCard> {
  const card: StudentCard = {
    studentId,
    displayName: 'Élève',
    loginIdentifier: null,
    nextCourse: null,
    calendarError: null,
  }

  try {
    const profileData = await fetchStudentProfile(studentId)
    const firstName = profileData.administrative?.firstName ?? ''
    const lastName = profileData.administrative?.lastName ?? ''
    const resolvedName = [firstName, lastName].filter(Boolean).join(' ')
    card.displayName = resolvedName || profileData.loginIdentifier || 'Élève inconnu'
    card.loginIdentifier = profileData.loginIdentifier ?? null
  } catch {
    card.displayName = 'Élève inconnu'
  }

  try {
    const events = await fetchUserEvents(studentId)
    card.nextCourse = getFutureEvents(events)[0] ?? null
  } catch (caughtError: unknown) {
    card.calendarError = getErrorMessage(caughtError, 'Calendrier indisponible pour cet élève')
  }

  return card
}

async function loadStudentCards(parentId: string): Promise<StudentCard[]> {
  const links = await fetchLinkedStudents(parentId)
  return Promise.all(links.map((link) => loadStudentCard(link.studentId)))
}

export interface UseParentDashboardResult {
  studentCards: StudentCard[]
  isLoading: boolean
}

/**
 * useParentDashboard — charge la liste des élèves rattachés au parent financeur connecté,
 * puis enrichit chaque carte avec le profil (nom affiché) et le prochain cours. Un échec sur
 * le profil ou le calendrier d'un élève reste local à sa carte — il ne bloque jamais
 * l'affichage des autres élèves (comportement non bloquant préexistant, préservé).
 */
export function useParentDashboard(parentId: string | undefined): UseParentDashboardResult {
  const { data, isLoading } = useAsyncData(
    () => (parentId ? loadStudentCards(parentId) : Promise.resolve([])),
    [parentId],
  )

  return {
    studentCards: data ?? [],
    isLoading,
  }
}
