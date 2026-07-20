import { useCallback, useState } from 'react'
import { createLegalTemplate, fetchLegalTemplates, updateLegalTemplate } from '../../api/legal'
import type {
  CreateLegalTemplatePayload,
  LegalTemplate,
  UpdateLegalTemplatePayload,
} from '../../api/legal'
import { useAsyncData } from '../useAsyncData'
import { getErrorStatus } from '../../utils/apiError'

function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

async function loadLegalTemplates(enabled: boolean): Promise<LegalTemplate[]> {
  if (!enabled) return pendingForever<LegalTemplate[]>()
  return fetchLegalTemplates()
}

export interface UseLegalTemplatesResult {
  legalTemplates: LegalTemplate[]
  isLoadingTemplates: boolean
  templatesError: string | null

  /** POST /legal-templates — préfixe la liste avec le modèle créé. */
  createTemplate: (payload: CreateLegalTemplatePayload) => Promise<LegalTemplate | null>
  isCreatingTemplate: boolean
  createError: string | null

  /** PATCH /legal-templates/:id — remplace le modèle correspondant dans la liste. */
  updateTemplate: (
    templateId: string,
    payload: UpdateLegalTemplatePayload,
  ) => Promise<LegalTemplate | null>
  isUpdatingTemplate: boolean
  updateError: string | null
}

/**
 * useLegalTemplates — charge les modèles légaux (si `enabled`, reproduisant le court-circuit
 * préexistant qui n'appelait pas l'API avant la redirection /forbidden pour les non-AF) et
 * expose la création et la modification d'un modèle, fusionnées localement par-dessus la liste
 * chargée sans rechargement réseau (à l'image de `useTeacherPaymentRequests`).
 *
 * Les messages d'erreur 403 reprennent le libellé métier préexistant ("Seul l'administrateur
 * financier peut …") plutôt que le message générique de `getErrorMessage`, pour ne pas changer
 * le texte affiché à l'utilisateur (LDS-BR-001).
 */
export function useLegalTemplates(enabled: boolean): UseLegalTemplatesResult {
  const { data, isLoading, error: templatesError } = useAsyncData(
    () => loadLegalTemplates(enabled),
    [enabled],
    { fallbackErrorMessage: 'Impossible de charger les modèles légaux.' },
  )

  const [addedTemplates, setAddedTemplates] = useState<LegalTemplate[]>([])
  const [updatedById, setUpdatedById] = useState<Record<string, LegalTemplate>>({})

  const legalTemplates = [...addedTemplates, ...(data ?? [])].map(
    (template) => updatedById[template.id] ?? template,
  )

  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const createTemplate = useCallback(
    async (payload: CreateLegalTemplatePayload): Promise<LegalTemplate | null> => {
      setIsCreatingTemplate(true)
      setCreateError(null)
      try {
        const created = await createLegalTemplate(payload)
        setAddedTemplates((previous) => [created, ...previous])
        return created
      } catch (caughtError) {
        setCreateError(
          getErrorStatus(caughtError) === 403
            ? "Seul l'administrateur financier peut créer des modèles légaux."
            : 'Impossible de créer le modèle légal.',
        )
        return null
      } finally {
        setIsCreatingTemplate(false)
      }
    },
    [],
  )

  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const updateTemplate = useCallback(
    async (
      templateId: string,
      payload: UpdateLegalTemplatePayload,
    ): Promise<LegalTemplate | null> => {
      setIsUpdatingTemplate(true)
      setUpdateError(null)
      try {
        const updated = await updateLegalTemplate(templateId, payload)
        setUpdatedById((previous) => ({ ...previous, [templateId]: updated }))
        return updated
      } catch (caughtError) {
        setUpdateError(
          getErrorStatus(caughtError) === 403
            ? 'Seul l\'administrateur financier peut modifier des modèles légaux.'
            : 'Impossible de modifier le modèle légal.',
        )
        return null
      } finally {
        setIsUpdatingTemplate(false)
      }
    },
    [],
  )

  return {
    legalTemplates,
    isLoadingTemplates: isLoading,
    templatesError,
    createTemplate,
    isCreatingTemplate,
    createError,
    updateTemplate,
    isUpdatingTemplate,
    updateError,
  }
}
