/**
 * QuizzPage — Quizz (à venir)
 *
 * Aucune fonctionnalité de quiz n'existe aujourd'hui côté backend :
 * `content-catalog-service` est prévu en phase 3 et n'expose, à ce jour, aucune
 * route de quiz (absente de `docs/routes.md`). Cette page n'effectue donc AUCUN
 * appel API — coder un appel vers une route non documentée est interdit
 * (`.claude/agents/front-developper.md`), et fabriquer un faux contenu serait
 * mentir à l'utilisateur.
 *
 * Elle affiche un état « à venir » explicite avec le composant `EmptyState`
 * déjà utilisé partout ailleurs dans le projet pour ce cas de figure (liste
 * vide, ressource pas encore disponible) — voir `TutorialCatalogPage`,
 * `ExerciseCatalogPage` — plutôt que d'inventer un nouveau composant.
 */

import React from 'react'
import Layout from '../components/Layout'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'

export default function QuizzPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Quizz"
          subtitle="Des quiz rapides pour réviser en s'amusant."
        />
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <EmptyState message="Les quiz seront bientôt disponibles. Cette fonctionnalité est en cours de préparation." />
        </div>
      </div>
    </Layout>
  )
}
