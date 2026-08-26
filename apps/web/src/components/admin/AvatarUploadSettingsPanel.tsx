/**
 * AvatarUploadSettingsPanel — section « Photo de profil » de l'écran
 * « Paramètres système » (TI uniquement).
 *
 * Appelle `profile-service` (`GET /profiles/avatar/constraints`,
 * `PATCH /profiles/avatar/settings`) — domaine distinct des autres sections
 * de cet écran, agrégées ici sans nouveau service transverse (arbitrage du
 * 2026-08-26, point 8).
 *
 * Saisie en kilooctets (Ko, sens SI — 1 Ko = 1000 octets, même convention que
 * `fileSize.ts`) : plus lisible qu'un nombre d'octets brut, tout en restant
 * strictement convertible vers la borne serveur `[10000, 10000000]` octets.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useAdminAvatarSettings } from '../../hooks/admin/useAdminAvatarSettings'
import { formatFileSize } from '../../utils/fileSize'
import { ErrorMessage } from '../ui/ErrorMessage'

const BYTES_PER_KILOBYTE = 1000

export function AvatarUploadSettingsPanel() {
  const { maxUploadBytes, updatedAt, isLoading, loadError, save, isSaving, saveError } =
    useAdminAvatarSettings()

  const [inputKilobytes, setInputKilobytes] = useState('')
  const hasInitializedInput = useRef(false)

  useEffect(() => {
    if (maxUploadBytes !== null && !hasInitializedInput.current) {
      setInputKilobytes(String(Math.round(maxUploadBytes / BYTES_PER_KILOBYTE)))
      hasInitializedInput.current = true
    }
  }, [maxUploadBytes])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsedKilobytes = Number(inputKilobytes)
    if (!Number.isFinite(parsedKilobytes)) return
    await save(Math.round(parsedKilobytes * BYTES_PER_KILOBYTE))
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Photo de profil</h2>
        <p className="text-sm text-gray-500 mt-1">
          Taille maximale acceptée pour l'envoi d'une photo de profil (`profile-service`).
        </p>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Chargement…</p>}
      {loadError && <ErrorMessage message={loadError} />}

      {!isLoading && !loadError && (
        // `noValidate` : sans lui, une valeur hors des bornes `min`/`max` de
        // l'input ci-dessous bloque silencieusement l'événement `submit`
        // (validation HTML5 native) — `handleSubmit` ne serait jamais appelé
        // et le message français serait remplacé par un blocage muet.
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          {maxUploadBytes !== null && (
            <p className="text-sm text-gray-600">
              Valeur actuelle : <strong>{formatFileSize(maxUploadBytes)}</strong>
              {updatedAt && (
                <span className="text-gray-400"> — mis à jour le {new Date(updatedAt).toLocaleString('fr-FR')}</span>
              )}
            </p>
          )}

          <div>
            <label htmlFor="avatar-max-upload-kb" className="block text-sm text-gray-700 mb-1">
              Nouvelle taille maximale (en kilooctets)
            </label>
            <div className="flex items-center gap-2 max-w-xs">
              <input
                id="avatar-max-upload-kb"
                type="number"
                min={10}
                max={10_000}
                step={1}
                value={inputKilobytes}
                onChange={(event) => setInputKilobytes(event.target.value)}
                disabled={isSaving}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-500">Ko</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">Entre 10 Ko et 10 000 Ko (10 Mo).</p>
          </div>

          {saveError && <ErrorMessage message={saveError} />}

          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </form>
      )}
    </section>
  )
}
