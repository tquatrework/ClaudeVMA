/**
 * ForumCharterGate — bloque la zone de saisie de commentaire tant que la charte de bonne conduite
 * n'a pas été acceptée, avec un chemin vers sa lecture puis son acceptation
 * (`GET`/`POST /forums/charter/acceptance`, globale — pas propre à un forum).
 *
 * La lecture d'un forum n'exige pas la charte, seule la participation (publier un commentaire) —
 * ce composant n'encadre donc que la zone de commentaire, jamais le fil de discussion lui-même.
 */

import React, { useState } from 'react'
import { useForumCharter } from '../../hooks/community/useForumCharter'
import { useForumCharterAcceptance } from '../../hooks/community/useForumCharterAcceptance'
import { ErrorMessage } from '../ui/ErrorMessage'
import { MarkdownText } from '../ui/MarkdownText'
import { FORUM_LABELS } from '../../utils/forumLabels'

interface ForumCharterGateProps {
  children: React.ReactNode
}

export function ForumCharterGate({ children }: ForumCharterGateProps) {
  const { isLoadingAcceptance, hasAcceptedCharter, isAccepting, acceptError, acceptCharter } =
    useForumCharterAcceptance()
  const [isReadingCharter, setIsReadingCharter] = useState(false)
  const charter = useForumCharter(isReadingCharter)

  if (isLoadingAcceptance) {
    return <p className="text-sm text-gray-400">Vérification de votre statut…</p>
  }

  if (hasAcceptedCharter) {
    return <>{children}</>
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
      <p className="text-sm text-yellow-800">{FORUM_LABELS.charterRequiredBanner}</p>

      {!isReadingCharter ? (
        <button
          type="button"
          onClick={() => setIsReadingCharter(true)}
          className="text-sm font-medium text-yellow-800 underline hover:no-underline"
        >
          {FORUM_LABELS.charterReadLink}
        </button>
      ) : (
        <div className="bg-white border border-yellow-100 rounded-lg p-3">
          {charter.isLoadingCharter ? (
            <p className="text-sm text-gray-400">Chargement de la charte…</p>
          ) : charter.loadError ? (
            <ErrorMessage message={charter.loadError} />
          ) : charter.content.trim().length > 0 ? (
            <MarkdownText content={charter.content} />
          ) : (
            <p className="text-sm text-gray-700">{FORUM_LABELS.charterEmptyPlaceholder}</p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void acceptCharter()}
          disabled={isAccepting}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAccepting ? FORUM_LABELS.charterAccepting : FORUM_LABELS.charterAccept}
        </button>
      </div>

      {acceptError && <ErrorMessage message={acceptError} />}
    </div>
  )
}
