/**
 * NotebookAccessSettingsPanel — section « Accès au carnet personnel » de
 * l'écran « Paramètres système » (TI uniquement).
 *
 * Appelle `pedagogical-log-service` (`GET`/`PATCH
 * /pedagogical-logs/settings/notebook-access`) — domaine distinct des autres
 * sections de cet écran, même précédent que `AttachmentSettingsPanel`
 * (arbitrage du 2026-08-26, point 8).
 *
 * Deux axes indépendants (arbitrage du 2026-08-28) :
 * - `adminAccess` : sélecteur à trois valeurs, `Non` (défaut) / `RP` /
 *   `Tous les administrateurs`.
 * - `parentAccessToOwnChild` : case à cocher indépendante, « Parents sur son
 *   enfant ».
 *
 * `PATCH` est une **mise à jour partielle** : seuls les champs réellement
 * modifiés par rapport aux réglages chargés sont envoyés.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useAdminNotebookAccessSettings } from '../../hooks/admin/useAdminNotebookAccessSettings'
import type {
  NotebookAdminAccess,
  UpdateNotebookAccessSettingsPayload,
} from '../../api/pedagogicalLogNotebookAccess'
import { ErrorMessage } from '../ui/ErrorMessage'

const ADMIN_ACCESS_LABELS: Record<NotebookAdminAccess, string> = {
  none: 'Non',
  rp: 'RP',
  all_admins: 'Tous les administrateurs',
}

export function NotebookAccessSettingsPanel() {
  const { settings, isLoading, loadError, save, isSaving, saveError } =
    useAdminNotebookAccessSettings()

  const [adminAccess, setAdminAccess] = useState<NotebookAdminAccess>('none')
  const [parentAccessToOwnChild, setParentAccessToOwnChild] = useState(false)
  const hasInitializedInputs = useRef(false)

  useEffect(() => {
    if (settings && !hasInitializedInputs.current) {
      setAdminAccess(settings.adminAccess)
      setParentAccessToOwnChild(settings.parentAccessToOwnChild)
      hasInitializedInputs.current = true
    }
  }, [settings])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!settings) return

    // Mise à jour partielle : seuls les champs réellement modifiés partent au serveur.
    const payload: UpdateNotebookAccessSettingsPayload = {}
    if (adminAccess !== settings.adminAccess) payload.adminAccess = adminAccess
    if (parentAccessToOwnChild !== settings.parentAccessToOwnChild) {
      payload.parentAccessToOwnChild = parentAccessToOwnChild
    }

    if (Object.keys(payload).length === 0) return
    await save(payload)
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Accès au carnet personnel</h2>
        <p className="text-sm text-gray-500 mt-1">
          Ouvrir, à titre exceptionnel, une lecture seule du carnet personnel d'autrui
          (`pedagogical-log-service`). Désactivé par défaut sur les deux axes.
        </p>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Chargement…</p>}
      {loadError && <ErrorMessage message={loadError} />}

      {!isLoading && !loadError && settings && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-600">
            Réglages actuels :{' '}
            <strong>{ADMIN_ACCESS_LABELS[settings.adminAccess]}</strong> (administratif),{' '}
            <strong>
              {settings.parentAccessToOwnChild ? 'Activé' : 'Désactivé'}
            </strong>{' '}
            (parental)
            {settings.updatedAt && (
              <span className="text-gray-400">
                {' '}— mis à jour le {new Date(settings.updatedAt).toLocaleString('fr-FR')}
              </span>
            )}
          </p>

          <div>
            <label htmlFor="notebook-access-admin" className="block text-sm text-gray-700 mb-1">
              Accès administratif
            </label>
            <select
              id="notebook-access-admin"
              value={adminAccess}
              onChange={(event) => setAdminAccess(event.target.value as NotebookAdminAccess)}
              disabled={isSaving}
              className="w-full sm:w-64 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="none">Non</option>
              <option value="rp">RP</option>
              <option value="all_admins">Tous les administrateurs</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              « RP » ouvre la lecture de tous les carnets personnels au seul rôle Responsable
              pédagogique. « Tous les administrateurs » l'ouvre en plus à l'Administrateur
              financier et au Technicien informatique.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="notebook-access-parent"
              type="checkbox"
              checked={parentAccessToOwnChild}
              onChange={(event) => setParentAccessToOwnChild(event.target.checked)}
              disabled={isSaving}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="notebook-access-parent" className="text-sm text-gray-700">
              Parents sur son enfant
            </label>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            Ouvre à un parent financeur la lecture du carnet personnel du seul élève auquel il est
            rattaché.
          </p>

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
