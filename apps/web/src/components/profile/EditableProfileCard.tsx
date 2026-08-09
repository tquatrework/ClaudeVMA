/**
 * EditableProfileCard — carte d'un bloc de profil ouvert à la saisie.
 *
 * Pendant de `ProfileSection` (lecture) : même carte, même titre, même
 * description, mais le contenu est un formulaire. Les deux se ressemblent
 * volontairement — le lecteur qui a le droit d'écriture ne change pas d'écran
 * pour renseigner un champ, il le remplit là où il l'a lu.
 *
 * La carte porte aussi le retour d'enregistrement : réussite ou refus du
 * serveur, au plus près du bloc concerné. Un `403` sur le pédagogique ne doit pas
 * laisser croire que l'administratif a échoué.
 */

import React from 'react'
import { ErrorMessage } from '../ui/ErrorMessage'

interface EditableProfileCardProps {
  title: string
  description?: string
  /** Message de réussite du dernier enregistrement, `null` sinon. */
  successMessage?: string | null
  onDismissSuccess?: () => void
  /** Message d'échec traduit par `getProfileWriteErrorMessage`, `null` sinon. */
  saveError?: string | null
  children: React.ReactNode
}

export function EditableProfileCard({
  title,
  description,
  successMessage,
  onDismissSuccess,
  saveError,
  children,
}: EditableProfileCardProps) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">{title}</h2>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}

      {saveError && <ErrorMessage message={saveError} className="mb-4" />}
      {successMessage && (
        <ErrorMessage
          variant="success"
          message={successMessage}
          onClose={onDismissSuccess}
          className="mb-4"
        />
      )}

      {children}
    </section>
  )
}
