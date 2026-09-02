/**
 * AnimatorsOfTeacherPanel — liste des animateurs pédagogiques (AP) qui animent un
 * formateur, affichée sur la fiche de profil de ce formateur.
 *
 * Complément du 2026-09-02 (point 3, « Contacts essentiels » — professeur → AP),
 * `docs/architecture.md` > « Reconstruction du rail gauche du RP » : la route
 * (`GET /relations/animator-teacher/by-teacher/:teacherId`, PR #212) vient d'être
 * livrée côté `profile-service`, sens inverse de `AnimatedTeachersPanel`. Lecture
 * seule via `RelationLinksPanel` — aucune route de rupture de ce lien n'existe côté
 * serveur, donc aucune action n'est proposée ici.
 */

import React from 'react'
import { useAnimatorsOfTeacher } from '../../hooks/relations/useAnimatorsOfTeacher'
import { ANIMATOR_GENERIC_LABEL } from '../../utils/relationLabels'
import { RelationLinksPanel } from './RelationLinksPanel'

interface AnimatorsOfTeacherPanelProps {
  /** Identifiant du formateur consulté. */
  teacherId: string
  /**
   * Le lecteur a-t-il, structurellement, une chance d'avoir ce droit (RP, TI, ou
   * le formateur lui-même — l'AF en est exclu, comme côté serveur) ? Sert
   * uniquement à éviter un appel réseau inutile.
   */
  enabled: boolean
}

export function AnimatorsOfTeacherPanel({ teacherId, enabled }: AnimatorsOfTeacherPanelProps) {
  const { relations, isLoading, loadError } = useAnimatorsOfTeacher(teacherId, enabled)

  if (!enabled) return null

  return (
    <RelationLinksPanel
      title="Animateurs pédagogiques"
      emptyMessage="Aucun animateur pédagogique"
      genericLabel={ANIMATOR_GENERIC_LABEL}
      isLoading={isLoading}
      loadError={loadError}
      items={relations.map((relation) => ({
        id: relation.id,
        targetUserId: relation.animatorId,
        personName: relation.animatorName,
      }))}
    />
  )
}
