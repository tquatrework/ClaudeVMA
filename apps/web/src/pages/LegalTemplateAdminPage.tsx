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

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  createLegalTemplate,
  updateLegalTemplate,
  type LegalTemplate,
  type LegalDocumentType,
} from '../api/legal'
import apiClient from '../api/client'

const DOCUMENT_TYPE_OPTIONS: { value: LegalDocumentType; label: string }[] = [
  { value: 'MANDAT_CLIENT', label: 'Mandat client' },
  { value: 'CONTRAT_FORMATEUR', label: 'Contrat formateur' },
]

export default function LegalTemplateAdminPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const [legalTemplates, setLegalTemplates] = useState<LegalTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)

  // Create form state
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplateTitle, setNewTemplateTitle] = useState('')
  const [newTemplateDocumentType, setNewTemplateDocumentType] = useState<LegalDocumentType>('MANDAT_CLIENT')
  const [newTemplateContent, setNewTemplateContent] = useState('')
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)

  // Edit state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasRole('administrateur_financier')) {
      navigate('/forbidden', { replace: true })
      return
    }

    // Chargement des modèles (endpoint à définir selon l'implémentation backend)
    apiClient
      .get<LegalTemplate[]>('/legal-templates')
      .then(({ data }) => setLegalTemplates(Array.isArray(data) ? data : []))
      .catch(() => { /* non-bloquant si endpoint non encore disponible */ })
      .finally(() => setIsLoadingTemplates(false))
  }, [hasRole, navigate])

  const handleCreateTemplate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newTemplateTitle.trim() || !newTemplateContent.trim()) return

    setIsSubmittingCreate(true)
    setCreateError(null)
    setCreateSuccess(false)

    try {
      const createdTemplate = await createLegalTemplate({
        title: newTemplateTitle.trim(),
        documentType: newTemplateDocumentType,
        content: newTemplateContent.trim(),
      })
      setLegalTemplates((previous) => [createdTemplate, ...previous])
      setIsCreating(false)
      setNewTemplateTitle('')
      setNewTemplateContent('')
      setCreateSuccess(true)
    } catch (error: unknown) {
      const statusCode = (error as { response?: { status?: number } })?.response?.status
      if (statusCode === 403) {
        setCreateError('Seul l\'administrateur financier peut créer des modèles légaux.')
      } else {
        setCreateError('Impossible de créer le modèle légal.')
      }
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  const handleOpenEdit = (template: LegalTemplate) => {
    setEditingTemplateId(template.id)
    setEditTitle(template.title)
    setEditContent(template.content)
    setEditError(null)
  }

  const handleSaveEdit = async (templateId: string) => {
    setIsSubmittingEdit(true)
    setEditError(null)

    try {
      const updatedTemplate = await updateLegalTemplate(templateId, {
        title: editTitle.trim() || undefined,
        content: editContent.trim() || undefined,
      })
      setLegalTemplates((previous) =>
        previous.map((template) =>
          template.id === templateId ? updatedTemplate : template,
        ),
      )
      setEditingTemplateId(null)
    } catch (error: unknown) {
      const statusCode = (error as { response?: { status?: number } })?.response?.status
      if (statusCode === 403) {
        setEditError('Seul l\'administrateur financier peut modifier des modèles légaux.')
      } else {
        setEditError('Impossible de modifier le modèle légal.')
      }
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  if (!hasRole('administrateur_financier')) {
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
                    isSubmittingCreate ||
                    !newTemplateTitle.trim() ||
                    !newTemplateContent.trim()
                  }
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmittingCreate ? 'Création…' : 'Créer le modèle'}
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
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                        <p className="text-xs text-gray-400">
                          La modification incrémente automatiquement la version du modèle.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(legalTemplate.id)}
                            disabled={isSubmittingEdit}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {isSubmittingEdit ? 'Enregistrement…' : 'Enregistrer les modifications'}
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
