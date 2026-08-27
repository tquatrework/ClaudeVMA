/**
 * AttachmentSettingsPanel — section « Pièces jointes du cahier de texte » de
 * l'écran « Paramètres système » (TI uniquement).
 *
 * Appelle `pedagogical-log-service` (`GET`/`PATCH
 * /pedagogical-logs/settings/attachments`) — domaine distinct des autres
 * sections de cet écran (arbitrage du 2026-08-26, point 8).
 *
 * `PATCH` est une **mise à jour partielle** : seuls les champs réellement
 * modifiés par rapport aux réglages chargés sont envoyés.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useAdminAttachmentSettings } from '../../hooks/admin/useAdminAttachmentSettings'
import type { UpdateAttachmentSettingsPayload } from '../../api/pedagogicalLogAttachments'
import { formatFileSize } from '../../utils/fileSize'
import { ErrorMessage } from '../ui/ErrorMessage'

const BYTES_PER_KILOBYTE = 1000

function toKilobytesString(bytes: number): string {
  return String(Math.round(bytes / BYTES_PER_KILOBYTE))
}

export function AttachmentSettingsPanel() {
  const { settings, isLoading, loadError, save, isSaving, saveError } = useAdminAttachmentSettings()

  const [isEnabled, setIsEnabled] = useState(true)
  const [maxFileKilobytes, setMaxFileKilobytes] = useState('')
  const [maxTotalKilobytes, setMaxTotalKilobytes] = useState('')
  const hasInitializedInputs = useRef(false)

  useEffect(() => {
    if (settings && !hasInitializedInputs.current) {
      setIsEnabled(settings.attachmentsEnabled)
      setMaxFileKilobytes(toKilobytesString(settings.maxFileBytes))
      setMaxTotalKilobytes(toKilobytesString(settings.maxTotalBytesPerEntry))
      hasInitializedInputs.current = true
    }
  }, [settings])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!settings) return

    const nextMaxFileBytes = Math.round(Number(maxFileKilobytes) * BYTES_PER_KILOBYTE)
    const nextMaxTotalBytes = Math.round(Number(maxTotalKilobytes) * BYTES_PER_KILOBYTE)

    // Mise à jour partielle : seuls les champs réellement modifiés partent au serveur.
    const payload: UpdateAttachmentSettingsPayload = {}
    if (isEnabled !== settings.attachmentsEnabled) payload.attachmentsEnabled = isEnabled
    if (Number.isFinite(nextMaxFileBytes) && nextMaxFileBytes !== settings.maxFileBytes) {
      payload.maxFileBytes = nextMaxFileBytes
    }
    if (Number.isFinite(nextMaxTotalBytes) && nextMaxTotalBytes !== settings.maxTotalBytesPerEntry) {
      payload.maxTotalBytesPerEntry = nextMaxTotalBytes
    }

    if (Object.keys(payload).length === 0) return
    await save(payload)
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Pièces jointes du cahier de texte</h2>
        <p className="text-sm text-gray-500 mt-1">
          Activation et plafonds d'envoi (`pedagogical-log-service`).
        </p>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Chargement…</p>}
      {loadError && <ErrorMessage message={loadError} />}

      {!isLoading && !loadError && settings && (
        // `noValidate` : la validation HTML5 native (`min` sur les champs
        // numériques ci-dessous) bloquerait sinon silencieusement `submit`
        // avant que `handleSubmit` ne s'exécute — voir `AvatarUploadSettingsPanel`.
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <p className="text-sm text-gray-600">
            Réglages actuels :{' '}
            <strong>{formatFileSize(settings.maxFileBytes)} par fichier</strong>,{' '}
            <strong>{formatFileSize(settings.maxTotalBytesPerEntry)} par entrée</strong>
            {settings.updatedAt && (
              <span className="text-gray-400">
                {' '}— mis à jour le {new Date(settings.updatedAt).toLocaleString('fr-FR')}
              </span>
            )}
          </p>

          <div className="flex items-center gap-3">
            <input
              id="attachments-enabled"
              type="checkbox"
              checked={isEnabled}
              onChange={(event) => setIsEnabled(event.target.checked)}
              disabled={isSaving}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="attachments-enabled" className="text-sm text-gray-700">
              Autoriser les pièces jointes sur le cahier de texte
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="attachments-max-file-kb" className="block text-sm text-gray-700 mb-1">
                Plafond par fichier (Ko)
              </label>
              <input
                id="attachments-max-file-kb"
                type="number"
                min={1}
                step={1}
                value={maxFileKilobytes}
                onChange={(event) => setMaxFileKilobytes(event.target.value)}
                disabled={isSaving}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="attachments-max-total-kb" className="block text-sm text-gray-700 mb-1">
                Plafond total par entrée (Ko)
              </label>
              <input
                id="attachments-max-total-kb"
                type="number"
                min={1}
                step={1}
                value={maxTotalKilobytes}
                onChange={(event) => setMaxTotalKilobytes(event.target.value)}
                disabled={isSaving}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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
