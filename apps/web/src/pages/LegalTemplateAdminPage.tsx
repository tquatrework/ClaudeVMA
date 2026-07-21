/**
 * LegalTemplateAdminPage — Phase 10
 *
 * Page d'administration des modèles légaux.
 * Accès restreint : administrateur_financier uniquement (LDS-BR-001).
 *
 * Permet de :
 * - Créer un nouveau modèle légal
 * - Modifier un modèle existant (incrémente la version)
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useLegalTemplates } from '../hooks/legal/useLegalTemplates'
import type { LegalDocumentType } from '../api/legal'

const DOCUMENT_TYPE_OPTIONS: { value: LegalDocumentType; label: string }[] = [
  { value: 'MANDAT_CLIENT', label: 'Mandat client' },
  { value: 'CONTRAT_FORMATEUR', label: 'Contrat formateur' },
]

export default function LegalTemplateAdminPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const isFinancialAdmin = hasRole('administrateur_financier')

  const {
    legalTemplates,
    isLoadingTemplates,
    templatesError,
    createTemplate,
    isCreatingTemplate,
    createError,
    updateTemplate,
    isUpdatingTemplate,
    updateError,
  } = useLegalTemplates(isFinancialAdmin)

  // Create form state
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplateTitle, setNewTemplateTitle] = useState('')
  const [newTemplateDocumentType, setNewTemplateDocumentType] = useState<LegalDocumentType>('MANDAT_CLIENT')
  const [newTemplateContent, setNewTemplateContent] = useState('')
  const [createSuccess, setCreateSuccess] = useState(false)

  // Edit state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    if (!isFinancialAdmin) {
      navigate('/forbidden', { replace: true })
    }
  }, [isFinancialAdmin, navigate])

  const handleCreateTemplate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newTemplateTitle.trim() || !newTemplateContent.trim()) return

    setCreateSuccess(false)

    const created = await createTemplate({
      title: newTemplateTitle.trim(),
      documentType: newTemplateDocumentType,
      content: newTemplateContent.trim(),
    })

    if (created) {
      setIsCreating(false)
      setNewTemplateTitle('')
      setNewTemplateContent('')
      setCreateSuccess(true)
    }
  }

  const handleOpenEdit = (template: { id: string; title: string; content: string }) => {
    setEditingTemplateId(template.id)
    setEditTitle(template.title)
    setEditContent(template.content)
  }

  const handleSaveEdit = async (templateId: string) => {
    const updated = await updateTemplate(templateId, {
      title: editTitle.trim() || undefined,
      content: editContent.trim() || undefined,
    })

    if (updated) {
      setEditingTemplateId(null)
    }
  }

  if (!isFinancialAdmin) {
    return null
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modèles légaux</h1>
            <p className="text-gray-500 text-sm mt-1">
              Gérez les modèles de mandats et contrats utilisés sur la plateforme.
            </p>
          </div>
          <button
            onClick={() => {
              setIsCreating(true)
              setCreateSuccess(false)
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
          >
            Nouveau modèle
          </button>
        </div>

        {/* Succès de création */}
        {createSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Modèle légal créé avec succès.
          </div>
        )}

        {/* Formulaire de création */}
        {isCreating && (
          <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-700">Créer un nouveau modèle</h2>
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Titre *</label>
                <input
                  type="text"
                  value={newTemplateTitle}
                  onChange={(event) => setNewTemplateTitle(event.target.value)}
                  required
                  placeholder="ex: Mandat client standard 2026"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Type de document *</label>
                <select
                  value={newTemplateDocumentType}
                  onChange={(event) =>
                    setNewTemplateDocumentType(event.target.value as LegalDocumentType)
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Contenu *</label>
                <textarea
                  value={newTemplateContent}
                  onChange={(event) => setNewTemplateContent(event.target.value)}
                  required
                  rows={8}
                  placeholder="Texte complet du document légal…"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {createError && <p className="text-xs text-red-600">{createError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={
                    isCreatingTemplate ||
                    !newTemplateTitle.trim() ||
                    !newTemplateContent.trim()
                  }
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {isCreatingTemplate ? 'Création…' : 'Créer le modèle'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2"
                >
                  Annuler
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Liste des modèles existants */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Modèles existants</h2>
          {templatesError && (
            <p className="text-xs text-red-600 mb-3">{templatesError}</p>
          )}
          {isLoadingTemplates ? (
            <p className="text-gray-400 text-sm">Chargement…</p>
          ) : legalTemplates.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucun modèle légal disponible.</p>
          ) : (
            <ul className="space-y-4">
              {legalTemplates.map((legalTemplate) => {
                const isBeingEdited = editingTemplateId === legalTemplate.id

                return (
                  <li
                    key={legalTemplate.id}
                    className="bg-white border border-gray-200 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-gray-900">{legalTemplate.title}</h3>
                        <p className="text-xs text-gray-500">
                          {DOCUMENT_TYPE_OPTIONS.find((opt) => opt.value === legalTemplate.documentType)?.label}
                          {' · '}Version {legalTemplate.version}
                          {legalTemplate.isActive ? (
                            <span className="ml-2 text-green-600">Actif</span>
                          ) : (
                            <span className="ml-2 text-gray-400">Inactif</span>
                          )}
                        </p>
                      </div>
                      {!isBeingEdited && (
                        <button
                          onClick={() => handleOpenEdit(legalTemplate)}
                          className="text-xs text-indigo-600 hover:underline shrink-0"
                        >
                          Modifier
                        </button>
                      )}
                    </div>

                    {isBeingEdited ? (
                      <div className="space-y-3 border border-indigo-100 bg-indigo-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-indigo-800">Modifier le modèle</h4>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Titre</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(event) => setEditTitle(event.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Contenu</label>
                          <textarea
                            value={editContent}
                            onChange={(event) => setEditContent(event.target.value)}
                            rows={8}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                        {updateError && <p className="text-xs text-red-600">{updateError}</p>}
                        <p className="text-xs text-gray-400">
                          La modification incrémente automatiquement la version du modèle.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(legalTemplate.id)}
                            disabled={isUpdatingTemplate}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {isUpdatingTemplate ? 'Enregistrement…' : 'Enregistrer les modifications'}
                          </button>
                          <button
                            onClick={() => setEditingTemplateId(null)}
                            className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap">
                        {legalTemplate.content.slice(0, 300)}
                        {legalTemplate.content.length > 300 ? '…' : ''}
                      </pre>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  )
}
