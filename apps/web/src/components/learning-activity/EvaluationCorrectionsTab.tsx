/**
 * EvaluationCorrectionsTab — contenu de l'onglet « Corrections » de `EvaluationCatalogPage »,
 * extrait pour garder la page sous le seuil de 300 lignes (règle du projet). Réservé
 * formateur/RP : file d'attente (accepter/refuser) + corrections déjà prises en charge (score +
 * commentaire). Le RP voit en plus les demandes `all_declined` dans la file (état d'escalade,
 * arbitrage du 2026-09-01) et peut accepter en override, mais jamais refuser (route réservée au
 * professeur lié).
 */

import React from 'react'
import { ErrorMessage } from '../ui/ErrorMessage'
import { useEvaluationCorrectionQueue } from '../../hooks/learning-activity/useEvaluationCorrectionQueue'
import { useMyEvaluationCorrections } from '../../hooks/learning-activity/useMyEvaluationCorrections'
import { EvaluationCorrectionQueueList } from './EvaluationCorrectionQueueList'
import { MyEvaluationCorrectionsList } from './MyEvaluationCorrectionsList'

interface EvaluationCorrectionsTabProps {
  /** Un professeur peut refuser une demande individuellement, le RP jamais (route réservée). */
  canDecline: boolean
}

export function EvaluationCorrectionsTab({ canDecline }: EvaluationCorrectionsTabProps) {
  const {
    items: pendingCorrections,
    isLoading: isLoadingPending,
    error: pendingError,
    accept,
    decline,
  } = useEvaluationCorrectionQueue(true)

  const {
    items: myCorrections,
    isLoading: isLoadingMine,
    error: mineError,
    correct,
  } = useMyEvaluationCorrections(true)

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Demandes en attente</h2>
        {isLoadingPending && <p className="text-gray-400 text-sm">Chargement…</p>}
        {pendingError && <ErrorMessage message={pendingError} />}
        {!isLoadingPending && !pendingError && (
          <EvaluationCorrectionQueueList
            items={pendingCorrections}
            onAccept={accept}
            onDecline={decline}
            canDecline={canDecline}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Mes corrections</h2>
        {isLoadingMine && <p className="text-gray-400 text-sm">Chargement…</p>}
        {mineError && <ErrorMessage message={mineError} />}
        {!isLoadingMine && !mineError && (
          <MyEvaluationCorrectionsList items={myCorrections} onCorrect={correct} />
        )}
      </section>
    </div>
  )
}
