/**
 * NotebookPage — Carnet personnel, générique par titulaire.
 *
 * Chantier de généralisation (pedagogical-log-service, PR #140, 2026-08-27) :
 * ouvert à tout rôle authentifié, chacun ne voyant et n'écrivant strictement
 * que le sien — aucune exception, y compris pour les rôles administratifs.
 *
 * Spécification fonctionnelle réelle — révisée le 2026-08-27 après retour
 * utilisateur sur les captures d'écran des menus (docs/architecture.md,
 * « Specification fonctionnelle reelle du carnet personnel — notes rapides
 * immuables ») : ce ne sont PAS des notes éditables, ce sont des « pensées
 * instantanées » — notes rapides, horodatées automatiquement à la création,
 * IMMUABLES (suppression possible, AUCUNE édition). On les retrouve par
 * recherche (une date, ou un mot), pas par simple défilement de liste.
 * Toute UI d'édition (formulaire, bouton « Modifier ») est donc absente,
 * délibérément — pas un oubli.
 *
 * Le titulaire est déduit du JWT côté serveur, jamais d'un paramètre d'URL.
 * Montée sur une seule route générique (`/notebook/mine`), dont les rôles
 * autorisés reflètent ce qui a été explicitement demandé pour cette session
 * (élève, formateur, animateur pédagogique) — voir App.tsx. Le backend
 * autoriserait davantage de rôles (RP, TI, AF, parent), mais aucune entrée de
 * menu n'a été demandée pour eux : ne pas l'ouvrir sans demande explicite
 * (règle projet « jamais de menu sans approbation »).
 *
 * Routes API (voir src/api/pedagogicalLogNotebook.ts) :
 *   GET    /pedagogical-logs/notebook?date=&q=
 *   POST   /pedagogical-logs/notebook
 *   DELETE /pedagogical-logs/notebook/:id
 */

import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import {
  fetchNotebookEntries,
  createNotebookEntry,
  deleteNotebookEntry,
  type NotebookEntry,
} from '../api/pedagogicalLogNotebook'

export default function NotebookPage() {
  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Recherche — une pensée instantanée se retrouve par sa date ou par un mot
  // de son contenu, jamais par simple défilement d'une liste brute.
  const [searchWord, setSearchWord] = useState('')
  const [searchDate, setSearchDate] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const loadEntries = (params?: { q?: string; date?: string }) => {
    setIsLoading(true)
    setErrorMessage(null)
    fetchNotebookEntries(params)
      .then((fetchedEntries) => setEntries(fetchedEntries))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setErrorMessage('Accès refusé')
        else setErrorMessage('Impossible de charger le carnet personnel')
      })
      .finally(() => {
        setIsLoading(false)
        setIsSearching(false)
      })
  }

  useEffect(() => {
    loadEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      const newEntry = await createNotebookEntry({ content: newContent.trim() })
      setEntries((prev) => [newEntry, ...prev])
      setNewContent('')
    } catch {
      setErrorMessage("Erreur lors de l'ajout de la note")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm('Supprimer cette note ?')) return
    setErrorMessage(null)
    try {
      await deleteNotebookEntry(entryId)
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
    } catch {
      setErrorMessage('Erreur lors de la suppression')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSearching(true)
    loadEntries({
      q: searchWord.trim() || undefined,
      date: searchDate || undefined,
    })
  }

  const handleResetSearch = () => {
    setSearchWord('')
    setSearchDate('')
    loadEntries()
  }

  const hasActiveSearch = Boolean(searchWord.trim() || searchDate)

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mon carnet personnel</h1>
          <p className="text-xs text-indigo-600 mt-1">
            Espace privé — visible uniquement par vous, y compris pour les administrateurs
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Des pensées instantanées, horodatées automatiquement. Une fois notées, elles ne se
            modifient pas — seulement se supprimer et se réécrire si besoin.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600 ml-3">
              ✕
            </button>
          </div>
        )}

        {/* Saisie rapide — une pensée instantanée, jamais un formulaire d'édition */}
        <form
          onSubmit={handleAddEntry}
          className="mb-6 bg-white border border-indigo-100 rounded-xl p-4 space-y-3"
        >
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Noter une pensée…"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <button
            type="submit"
            disabled={isSaving || !newContent.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? 'Ajout…' : 'Noter'}
          </button>
        </form>

        {/* Recherche — par date ou par mot, pas de défilement d'une liste brute */}
        <form
          onSubmit={handleSearch}
          className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[160px]">
            <label htmlFor="notebook-search-word" className="block text-xs text-gray-500 mb-1">
              Rechercher un mot
            </label>
            <input
              id="notebook-search-word"
              type="text"
              value={searchWord}
              onChange={(e) => setSearchWord(e.target.value)}
              placeholder="ex. intégrales"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label htmlFor="notebook-search-date" className="block text-xs text-gray-500 mb-1">
              Rechercher une date
            </label>
            <input
              id="notebook-search-date"
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="bg-white border border-indigo-300 text-indigo-600 px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-50 disabled:opacity-50"
          >
            {isSearching ? 'Recherche…' : 'Rechercher'}
          </button>
          {hasActiveSearch && (
            <button
              type="button"
              onClick={handleResetSearch}
              className="text-xs text-gray-500 hover:underline"
            >
              Réinitialiser
            </button>
          )}
        </form>

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && entries.length === 0 && !errorMessage && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">
              {hasActiveSearch ? 'Aucune note ne correspond à cette recherche' : 'Aucune note pour l\'instant'}
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.content}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-400">
                  {new Date(entry.createdAt).toLocaleString('fr-FR')}
                </p>
                <button
                  onClick={() => handleDeleteEntry(entry.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
