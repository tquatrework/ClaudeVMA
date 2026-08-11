/**
 * FinancialProfilePage — page dédiée au profil financier (`/finance`,
 * `/finance/:ownerId`).
 *
 * Depuis le 2026-08-11, le contenu vit dans `FinancialProfilePanel` : la fiche
 * de profil l'affiche aussi, dans son onglet « Profil financier ». Cette page
 * reste la porte d'entrée des rôles qui consultent le profil financier
 * **d'autrui** — administrateur financier, responsable pédagogique, technicien
 * informatique — et le raccourci du rail gauche pour le parent financeur.
 *
 * Elle ne garde donc que ce qui est propre à une page : le cadre, le titre, et
 * l'identification du titulaire consulté.
 */

import React from 'react'
import { useParams, Navigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { usePersonDisplayName } from '../hooks/profile/usePersonDisplayName'
import { FinancialProfilePanel } from '../components/finance/FinancialProfilePanel'

export default function FinancialProfilePage() {
  const { ownerId } = useParams<{ ownerId: string }>()
  const { user, hasRole } = useAuth()

  const resolvedOwnerId = ownerId ?? user?.id ?? ''
  const isOwnFinancialProfile = user?.id === resolvedOwnerId

  /**
   * Le titulaire est désigné par son **nom**, jamais par son identifiant
   * technique : « aucun UUID ne doit être lu ni affiché par un utilisateur »
   * (`docs/architecture.md`, 2026-08-09). L'écran affichait jusqu'ici
   * « Identifiant propriétaire : <uuid> » au parent, au formateur, à l'AP et au
   * RP. Seul l'administrateur financier garde l'identifiant, pour ses
   * rapprochements.
   */
  const { displayName: ownerDisplayName } = usePersonDisplayName(
    isOwnFinancialProfile ? null : resolvedOwnerId,
    'Titulaire du compte',
  )
  const isAdministrateurFinancier = hasRole('administrateur_financier')

  // Un parent_financeur ne peut accéder qu'à son propre profil financier (FIN-FB-001).
  // AF, RP et TI peuvent accéder à n'importe quel profil — pas de restriction pour eux.
  const isAdminFinanceRole = hasRole(
    'administrateur_financier',
    'responsable_pedagogique',
    'technicien_informatique',
  )
  if (ownerId && hasRole('parent_financeur') && !isAdminFinanceRole && user?.id !== ownerId) {
    return <Navigate to="/forbidden" replace />
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profil financier</h1>
          {!isOwnFinancialProfile && ownerDisplayName && (
            <p className="text-gray-500 text-sm mt-1">
              Titulaire : <span className="font-medium text-gray-700">{ownerDisplayName}</span>
              {isAdministrateurFinancier && (
                <span className="text-gray-400"> — réf. {resolvedOwnerId}</span>
              )}
            </p>
          )}
        </div>

        <FinancialProfilePanel ownerId={resolvedOwnerId} />
      </div>
    </Layout>
  )
}
