/**
 * StudentsOfTeacherPanel — liste des élèves d'un formateur, affichée sur la fiche
 * de profil de ce formateur.
 *
 * Complément du 2026-09-02 (point 3, « Contacts essentiels » — professeur → élèves),
 * `docs/architecture.md` > « Reconstruction du rail gauche du RP » : la route
 * (`GET /relations/teacher-student/by-teacher/:teacherId`, PR #212) vient d'être
 * livrée côté `profile-service`, sens inverse de `LinkedTeachersPanel`. Lecture
 * seule via `RelationLinksPanel` — aucune action n'est proposée ici (la fin de la
 * relation se fait depuis la fiche de l'élève, réservée au RP).
 */

import React from 'react'
import { useStudentsOfTeacher } from '../../hooks/relations/useStudentsOfTeacher'
import { STUDENT_GENERIC_LABEL } from '../../utils/relationLabels'
import { RelationLinksPanel } from './RelationLinksPanel'

interface StudentsOfTeacherPanelProps {
  /** Identifiant du formateur consulté. */
  teacherId: string
  /**
   * Le lecteur a-t-il, structurellement, une chance d'avoir ce droit (RP, TI, AF,
   * ou le formateur lui-même) ? Sert uniquement à éviter un appel réseau inutile —
   * le serveur reste seul juge du droit réel.
   */
  enabled: boolean
}

export function StudentsOfTeacherPanel({ teacherId, enabled }: StudentsOfTeacherPanelProps) {
  const { relations, isLoading, loadError } = useStudentsOfTeacher(teacherId, enabled)

  if (!enabled) return null

  return (
    <RelationLinksPanel
      title="Élèves"
      emptyMessage="Aucun élève"
      genericLabel={STUDENT_GENERIC_LABEL}
      isLoading={isLoading}
      loadError={loadError}
      items={relations.map((relation) => ({
        id: relation.id,
        targetUserId: relation.studentId,
        personName: relation.studentName,
      }))}
    />
  )
}
