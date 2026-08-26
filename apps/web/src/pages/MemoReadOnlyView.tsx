/**
 * MemoReadOnlyView — consultation d'un mémo individuel en lecture seule.
 *
 * Accessible aux rôles : formateur, responsable_pedagogique, animateur_pedagogique.
 * L'accès est conditionné par le rattachement à l'élève propriétaire (vérifié côté serveur).
 *
 * Route : GET /memos/:id
 * Page : /memos/:id
 */

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { fetchMemoById, type Memo } from '../api/pedagogicalLogMemos'

export default function MemoReadOnlyView() {
  const { id: memoId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [memo, setMemo] = useState<Memo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)

  useEffect(() => {
    if (!memoId) {
      setErrorStatus(404)
      setIsLoading(false)
      return
    }

    fetchMemoById(memoId)
      .then((fetchedMemo) => {
        setMemo(fetchedMemo)
      })
      .catch((err) => {
        const httpStatus = err?.response?.status ?? 500
        setErrorStatus(httpStatus)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [memoId])

  const renderError = () => {
    if (errorStatus === 404) {
      return (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
          <p className="text-gray-700 font-medium">Mémo introuvable</p>
          <p className="text-sm text-gray-500 mt-1">
            Ce mémo n'existe pas ou a été supprimé par l'élève.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-sm text-indigo-600 hover:underline"
          >
            Retour
          </button>
        </div>
      )
    }

    if (errorStatus === 403) {
      return (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
          <p className="text-amber-800 font-medium">Accès non autorisé</p>
          <p className="text-sm text-amber-700 mt-1">
            Vous n'êtes pas rattaché à l'élève propriétaire de ce mémo.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-sm text-indigo-600 hover:underline"
          >
            Retour
          </button>
        </div>
      )
    }

    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <p className="text-red-700 font-medium">Erreur lors du chargement</p>
        <p className="text-sm text-red-600 mt-1">
          Une erreur inattendue s'est produite. Veuillez réessayer.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-sm text-indigo-600 hover:underline"
        >
          Retour
        </button>
      </div>
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mémo — lecture seule</h1>
          <p className="text-sm text-gray-500 mt-1">
            Consultation d'une note personnelle de l'élève
          </p>
        </div>

        {isLoading && (
          <p className="text-gray-400 text-sm">Chargement du mémo…</p>
        )}

        {!isLoading && errorStatus !== null && renderError()}

        {!isLoading && memo !== null && (
          <div className="bg-white border border-gray-200 rounded-xl px-6 py-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{memo.title}</h2>
              <p className="text-xs text-gray-400 mt-1">
                Créé le {new Date(memo.createdAt).toLocaleDateString('fr-FR')}
                {memo.updatedAt && (
                  <> — modifié le {new Date(memo.updatedAt).toLocaleDateString('fr-FR')}</>
                )}
              </p>
            </div>

            <hr className="border-gray-100" />

            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {memo.content}
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate(-1)}
                className="text-sm text-indigo-600 hover:underline"
              >
                Retour
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
