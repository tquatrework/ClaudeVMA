/**
 * AnimatedTeachersPanel — liste des formateurs animés par un animateur pédagogique
 * (AP), affichée sur la fiche de profil de cet AP.
 *
 * Complément du 2026-09-02 (point 3, « Contacts essentiels » — AP → professeurs),
 * `docs/architecture.md` > « Reconstruction du rail gauche du RP » : la route
 * (`GET /relations/animator-teacher/:animatorId`) existait déjà et est déjà ouverte
 * au RP, au TI et à l'AP lui-même, mais n'était appelée par aucun composant front.
 * Même présentation que `LinkedTeachersPanel` (élève → professeurs), en lecture
 * seule via `RelationLinksPanel` — aucune route de rupture de ce lien n'existe côté
 * serveur, donc aucune action n'est proposée ici.
 */

import React from 'react'
import { useAnimatedTeachers } from '../../hooks/relations/useAnimatedTeachers'
import { TEACHER_GENERIC_LABEL } from '../../utils/relationLabels'
import { RelationLinksPanel } from './RelationLinksPanel'

interface AnimatedTeachersPanelProps {
  /** Identifiant de l'animateur pédagogique consulté. */
  animatorId: string
  /**
   * Le lecteur a-t-il, structurellement, une chance d'avoir ce droit (RP, TI, ou
   * l'AP lui-même) ? Sert uniquement à éviter un appel réseau inutile — le serveur
   * reste seul juge du droit réel.
   */
  enabled: boolean
}

export function AnimatedTeachersPanel({ animatorId, enabled }: AnimatedTeachersPanelProps) {
  const { relations, isLoading, loadError } = useAnimatedTeachers(animatorId, enabled)

  if (!enabled) return null

  return (
    <RelationLinksPanel
      title="Professeurs animés"
      emptyMessage="Aucun professeur animé"
      genericLabel={TEACHER_GENERIC_LABEL}
      isLoading={isLoading}
      loadError={loadError}
      items={relations.map((relation) => ({
        id: relation.id,
        targetUserId: relation.teacherId,
        personName: relation.teacherName,
      }))}
    />
  )
}
