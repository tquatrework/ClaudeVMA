/**
 * ForumCharterEditorPage — édition du texte de la charte de bonne conduite des forums.
 *
 * Dernier gap connu du chantier Forums (`docs/architecture/identite-profils-acces.md` >
 * « Développement réel des Forums », point « Texte réel de la charte de bonne conduite ») :
 * jusqu'ici, seul un appel API direct (`PATCH /forums/charter`) permettait de modifier ce texte.
 *
 * Réservé au RP et au TI, exactement les deux rôles autorisés côté serveur
 * (`docs/routes.md` > « community-path-service » > « Charte de bonne conduite »).
 *
 * Le texte est du Markdown réel — la zone de saisie est un simple champ texte brut (Markdown
 * source), avec un aperçu rendu juste en dessous via `MarkdownText` (le même composant que celui
 * utilisé par `ForumCharterGate` avant acceptation), pour que l'auteur voie le résultat sans quitter
 * l'écran.
 *
 * Routes API consommées :
 *   GET   /forums/charter
 *   PATCH /forums/charter
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useForumCharter } from '../hooks/community/useForumCharter'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { MarkdownText } from '../components/ui/MarkdownText'
import { FORUM_LABELS } from '../utils/forumLabels'

export default function ForumCharterEditorPage() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const canEditCharter = hasRole('responsable_pedagogique') || hasRole('technicien_informatique')

  // Ne charge la charte que si l'appelant a effectivement le droit d'y accéder — un rôle sans
  // accès voit l'écran « Accès réservé » sans déclencher d'appel réseau inutile.
  const charter = useForumCharter(canEditCharter)
  const [draftContent, setDraftContent] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Synchronise le brouillon avec la valeur du serveur : au premier chargement, puis à chaque
  // enregistrement réussi (`updatedAt` change) — on réaffiche la réponse reçue, jamais uniquement
  // le corps envoyé (règle du projet du 2026-08-10, point 3bis).
  useEffect(() => {
    if (charter.updatedAt !== null) {
      setDraftContent(charter.content)
    }
  }, [charter.updatedAt, charter.content])

  if (!canEditCharter) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux responsables pédagogiques et aux techniciens informatiques.
        </p>
      </Layout>
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaveSuccess(false)
    const ok = await charter.saveCharter(draftContent)
    if (ok) setSaveSuccess(true)
  }

  return (
    <Layout>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/community/forums')}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Retour aux forums
        </button>

        <PageHeader
          title="Charte de bonne conduite"
          subtitle="Texte affiché aux utilisateurs avant qu'ils puissent participer à un forum."
        />

        {charter.isLoadingCharter && (
          <p className="text-gray-400 text-sm">Chargement de la charte…</p>
        )}

        {charter.loadError && <ErrorMessage message={charter.loadError} />}

        {!charter.isLoadingCharter && !charter.loadError && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
              <label htmlFor="charter-content" className="block text-sm font-semibold text-gray-800">
                Texte de la charte (Markdown)
              </label>
              <p className="text-xs text-gray-500">
                Titres (<code>#</code>, <code>##</code>), listes à puces (<code>*</code>) et gras
                (<code>**texte**</code>) sont pris en charge.
              </p>
              <textarea
                id="charter-content"
                rows={18}
                value={draftContent}
                onChange={(e) => {
                  setDraftContent(e.target.value)
                  setSaveSuccess(false)
                }}
                disabled={charter.isSavingCharter}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />

              {charter.saveError && <ErrorMessage message={charter.saveError} />}
              {saveSuccess && (
                <p className="text-sm text-green-700">Charte enregistrée avec succès.</p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={charter.isSavingCharter}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {charter.isSavingCharter ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <p className="text-sm font-semibold text-gray-800 mb-3">Aperçu</p>
              {draftContent.trim().length > 0 ? (
                <MarkdownText content={draftContent} />
              ) : (
                <p className="text-sm text-gray-400">{FORUM_LABELS.charterEmptyPlaceholder}</p>
              )}
            </div>
          </form>
        )}
      </div>
    </Layout>
  )
}
