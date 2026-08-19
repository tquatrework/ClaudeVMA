import React from 'react'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import CalendarUnifiedView from '../components/calendar/CalendarUnifiedView'
import CourseProposalsPanel from '../components/calendar/CourseProposalsPanel'

/**
 * CalendarPage — vue calendrier unifiée (chantier calendrier vue unifiée, 2026-08-19, demande
 * explicite de l'utilisateur en testant l'écran précédent). Remplace l'ancien découpage en 3
 * onglets (« Mes événements » / « Mes disponibilités » / « Propositions de cours ») : les trois
 * sources — créneaux de disponibilité, propositions/confirmations de créneau de cours et
 * événements de calendrier — sont désormais fusionnées sur une seule et même grille, affichée
 * immédiatement (`CalendarUnifiedView`).
 *
 * `CourseProposalsPanel` (suivi des propositions envoyées **par le proposeur**, et point d'entrée
 * pour « proposer un créneau à quelqu'un d'autre ») reste un panneau distinct, replié par défaut,
 * en marge de la grille — décision explicite : proposer un cours à un tiers cible SON calendrier
 * (choix de destinataire, consultation de SES disponibilités via `LinkedCalendarView`), ce qui ne
 * correspond pas à « cliquer sur mon propre calendrier » et ne rentre donc pas dans le sélecteur
 * de mode de `CalendarUnifiedView`.
 */
export default function CalendarPage() {
  const { user } = useAuth()

  return (
    <Layout>
      <div className="max-w-3xl mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Mon calendrier</h1>
      </div>

      {user && <CalendarUnifiedView ownerId={user.id} userRole={user.role} />}

      <details className="mt-6 border border-gray-200 rounded-xl bg-white">
        <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer select-none">
          Propositions de cours
        </summary>
        <div className="p-4 pt-0">
          <CourseProposalsPanel />
        </div>
      </details>
    </Layout>
  )
}
