/**
 * ThirdPartyNotebookSection — carnet personnel d'un tiers, en lecture seule.
 *
 * Arbitrage du 2026-08-28 (docs/architecture.md « Acces administratif et
 * parental au carnet personnel — parametrable par le TI, defaut ferme ») :
 * RP/AF/TI peuvent lire le carnet de n'importe qui si le réglage TI l'ouvre
 * ; un parent financeur peut lire celui du/des élève(s) auquel il est
 * rattaché si l'axe parental est ouvert. Jamais d'écriture, jamais pour le
 * titulaire lui-même consultant son propre profil (il utilise `/notebook/mine`).
 *
 * Règle de filtrage UI de ce projet : ne jamais afficher une section qui
 * mènerait à une découverte vide ou en erreur. Cette section ne rend RIEN
 * tant que l'appel n'a pas réussi (`hasAccess`) — ni squelette, ni message
 * d'erreur, ni état vide affiché à tort pour un réglage désactivé ou un rôle
 * sans droit. Voir `useThirdPartyNotebook`.
 *
 * Réutilise `NotebookEntryList`/`NotebookSearchForm` (chantier de groundwork
 * du même jour) : aucun `onDelete` n'est fourni à `NotebookEntryList`, ce qui
 * suffit à retirer le bouton « Supprimer » — pas de composant dupliqué.
 */

import React from 'react'
import { useThirdPartyNotebook } from '../../hooks/profile/useThirdPartyNotebook'
import { NotebookEntryList } from '../notebook/NotebookEntryList'
import { NotebookSearchForm } from '../notebook/NotebookSearchForm'

interface ThirdPartyNotebookSectionProps {
  /** Titulaire du carnet consulté — jamais l'utilisateur connecté lui-même. */
  ownerId: string
  /**
   * Le lecteur a-t-il, structurellement, une chance d'avoir ce droit
   * (rôle RP/AF/TI, ou parent_financeur) ? Sert uniquement à éviter un appel
   * réseau inutile — le serveur reste seul juge du droit réel.
   */
  enabled: boolean
  /** Prénom du titulaire, pour un titre humain — jamais un UUID affiché. */
  ownerFirstName?: string | null
}

export function ThirdPartyNotebookSection({
  ownerId,
  enabled,
  ownerFirstName,
}: ThirdPartyNotebookSectionProps) {
  const {
    entries,
    hasAccess,
    isLoading,
    isSearching,
    searchWord,
    setSearchWord,
    searchDate,
    setSearchDate,
    hasActiveSearch,
    search,
    resetSearch,
  } = useThirdPartyNotebook(ownerId, enabled)

  if (!hasAccess) return null

  const title = ownerFirstName ? `Carnet personnel de ${ownerFirstName}` : 'Carnet personnel'

  return (
    <section className="bg-white border border-indigo-100 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-400 mt-1">
          Lecture seule — ces notes restent la propriété du titulaire ; elles ne peuvent être ni
          modifiées ni supprimées depuis cet écran.
        </p>
      </div>

      <NotebookSearchForm
        idPrefix={`notebook-${ownerId}`}
        searchWord={searchWord}
        onSearchWordChange={setSearchWord}
        searchDate={searchDate}
        onSearchDateChange={setSearchDate}
        onSubmit={search}
        onReset={resetSearch}
        isSearching={isSearching}
        hasActiveSearch={hasActiveSearch}
      />

      {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

      {!isLoading && (
        <NotebookEntryList
          entries={entries}
          emptyMessage={
            hasActiveSearch ? 'Aucune note ne correspond à cette recherche' : 'Aucune note pour le moment'
          }
        />
      )}
    </section>
  )
}
