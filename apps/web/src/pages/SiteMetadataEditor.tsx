/**
 * SiteMetadataEditor — Phase 15 (admin-observability-service)
 *
 * Éditeur des paramètres système de VisioMath (TI uniquement). Un seul écran
 * agrège plusieurs domaines, chacun appelant son propre service propriétaire
 * (arbitrage du 2026-08-26, point 8) — pas de nouveau service de
 * configuration transverse :
 *   - métadonnées du site (bandeaux, maintenance, contacts) — `admin-observability-service` ;
 *   - photo de profil (`AvatarUploadSettingsPanel`) — `profile-service` ;
 *   - pièces jointes du cahier de texte (`AttachmentSettingsPanel`) — `pedagogical-log-service`.
 *
 * Routes API consommées pour les métadonnées du site :
 *   PATCH /admin/site-metadata/:id
 */

import React, { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  updateSiteMetadata,
  type SiteMetadata,
  type UpdateSiteMetadataPayload,
} from '../api/adminObservability'
import { AvatarUploadSettingsPanel } from '../components/admin/AvatarUploadSettingsPanel'
import { AttachmentSettingsPanel } from '../components/admin/AttachmentSettingsPanel'

// ID par défaut de la configuration du site (singleton)
const DEFAULT_METADATA_ID = 'site-config'

export default function SiteMetadataEditor() {
  const { hasRole } = useAuth()

  // Champs du formulaire
  const [siteName, setSiteName] = useState('')
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [supportUrl, setSupportUrl] = useState('')
  const [announcementBanner, setAnnouncementBanner] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedMetadata, setSavedMetadata] = useState<SiteMetadata | null>(null)

  const isTi = hasRole('technicien_informatique')

  const handleSaveMetadata = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setSaveError(null)
    setSavedMetadata(null)

    const payload: UpdateSiteMetadataPayload = {}

    if (siteName.trim()) payload.siteName = siteName.trim()
    if (maintenanceMessage.trim()) payload.maintenanceMessage = maintenanceMessage.trim()
    payload.isMaintenanceMode = isMaintenanceMode
    if (contactEmail.trim()) payload.contactEmail = contactEmail.trim()
    if (supportUrl.trim()) payload.supportUrl = supportUrl.trim()
    if (announcementBanner.trim()) payload.announcementBanner = announcementBanner.trim()

    try {
      const updatedMetadata = await updateSiteMetadata(DEFAULT_METADATA_ID, payload)
      setSavedMetadata(updatedMetadata)
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setSaveError('Vous n\'êtes pas autorisé à modifier les métadonnées du site.')
      } else {
        setSaveError('Impossible de sauvegarder les métadonnées. Vérifiez les champs.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (!isTi) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux techniciens informatiques.
        </p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Métadonnées du site</h1>
          <p className="text-gray-500 text-sm mt-1">
            Configurez les paramètres globaux de la plateforme VisioMath.
          </p>
        </div>

        {/* Confirmation de sauvegarde */}
        {savedMetadata && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-700 font-medium">
              Métadonnées sauvegardées avec succès.
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              Dernière mise à jour : {new Date(savedMetadata.updatedAt).toLocaleString('fr-FR')}
            </p>
          </div>
        )}

        {/* Formulaire */}
        <form
          onSubmit={handleSaveMetadata}
          className="bg-white border border-gray-200 rounded-xl p-6 space-y-5"
        >
          <h2 className="text-base font-semibold text-gray-800">Paramètres généraux</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="site-name" className="block text-sm text-gray-700 mb-1">
                Nom du site
              </label>
              <input
                id="site-name"
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="ex: VisioMath"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isSaving}
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm text-gray-700 mb-1">
                Email de contact
              </label>
              <input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="ex: support@visiomaths.fr"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isSaving}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="support-url" className="block text-sm text-gray-700 mb-1">
                URL de support
              </label>
              <input
                id="support-url"
                type="url"
                value={supportUrl}
                onChange={(e) => setSupportUrl(e.target.value)}
                placeholder="https://support.visiomaths.fr"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isSaving}
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          <h2 className="text-base font-semibold text-gray-800">Bannière d'annonce</h2>

          <div>
            <label htmlFor="announcement-banner" className="block text-sm text-gray-700 mb-1">
              Texte de la bannière (laisser vide pour désactiver)
            </label>
            <textarea
              id="announcement-banner"
              rows={2}
              value={announcementBanner}
              onChange={(e) => setAnnouncementBanner(e.target.value)}
              placeholder="ex: Maintenance prévue le 20 juin de 2h à 4h du matin."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              disabled={isSaving}
            />
          </div>

          <hr className="border-gray-100" />

          <h2 className="text-base font-semibold text-gray-800">Mode maintenance</h2>

          <div className="flex items-center gap-3">
            <input
              id="maintenance-mode"
              type="checkbox"
              checked={isMaintenanceMode}
              onChange={(e) => setIsMaintenanceMode(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              disabled={isSaving}
            />
            <label htmlFor="maintenance-mode" className="text-sm text-gray-700">
              Activer le mode maintenance
            </label>
          </div>

          {isMaintenanceMode && (
            <div>
              <label htmlFor="maintenance-message" className="block text-sm text-gray-700 mb-1">
                Message de maintenance
              </label>
              <textarea
                id="maintenance-message"
                rows={2}
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder="ex: Le site est en maintenance. Retour prévu à 4h."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                disabled={isSaving}
              />
            </div>
          )}

          {saveError && <p className="text-red-600 text-sm">{saveError}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </form>

        <AvatarUploadSettingsPanel />
        <AttachmentSettingsPanel />
      </div>
    </Layout>
  )
}
