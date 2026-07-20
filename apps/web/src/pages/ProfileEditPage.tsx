import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfileForm } from '../hooks/profile/useProfileForm'
import Layout from '../components/Layout'
import type { AdministrativeProfileFields, PedagogicalProfileFields } from '../types/profile'

type ActiveTab = 'administrative' | 'pedagogical'

export default function ProfileEditPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const [activeTab, setActiveTab] = useState<ActiveTab>('administrative')

  const {
    administrativeProfile,
    pedagogicalProfile,
    isLoading,
    loadError,
    saveAdministrative,
    isSavingAdministrative,
    administrativeSaveError,
    savePedagogical,
    isSavingPedagogical,
    pedagogicalSaveError,
  } = useProfileForm(userId)

  const [adminForm, setAdminForm] = useState<AdministrativeProfileFields>({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
  })
  const [pedagogicalForm, setPedagogicalForm] = useState<PedagogicalProfileFields>({
    level: '',
    subjects: '',
    goals: '',
    notes: '',
  })
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (administrativeProfile) {
      setAdminForm((previous) => ({ ...previous, ...administrativeProfile }))
    }
    if (pedagogicalProfile) {
      setPedagogicalForm((previous) => ({ ...previous, ...pedagogicalProfile }))
    }
  }, [administrativeProfile, pedagogicalProfile])

  const canEditPedagogical =
    hasRole('eleve', 'formateur') ||
    (hasRole('responsable_pedagogique') && userId !== user?.id) ||
    hasRole('technicien_informatique')

  const isSaving = activeTab === 'administrative' ? isSavingAdministrative : isSavingPedagogical
  const error =
    activeTab === 'administrative'
      ? administrativeSaveError ?? loadError
      : pedagogicalSaveError ?? loadError

  const [isErrorDismissed, setIsErrorDismissed] = useState(false)
  useEffect(() => {
    setIsErrorDismissed(false)
  }, [error])

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage(null)
    const success = await saveAdministrative(adminForm)
    if (success) setSuccessMessage('Profil administratif mis à jour')
  }

  const handlePedagogicalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage(null)
    const success = await savePedagogical(pedagogicalForm)
    if (success) setSuccessMessage('Profil pédagogique mis à jour')
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400">Chargement…</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(`/profiles/${userId}`)}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Retour au profil
          </button>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Modifier le profil</h1>

        {error && !isErrorDismissed && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setIsErrorDismissed(true)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-green-400 hover:text-green-600 ml-3">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('administrative')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'administrative'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Profil administratif
          </button>
          {canEditPedagogical && (
            <button
              onClick={() => setActiveTab('pedagogical')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pedagogical'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Profil pédagogique
            </button>
          )}
        </div>

        {/* Administrative tab */}
        {activeTab === 'administrative' && (
          <form onSubmit={handleAdminSubmit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-6">
            {(
              [
                { field: 'firstName' as const, label: 'Prénom', type: 'text', placeholder: 'Jean' },
                { field: 'lastName' as const, label: 'Nom', type: 'text', placeholder: 'Dupont' },
                { field: 'phone' as const, label: 'Téléphone', type: 'tel', placeholder: '06 12 34 56 78' },
                { field: 'address' as const, label: 'Adresse', type: 'text', placeholder: '12 rue des Mathématiques, 75001 Paris' },
              ]
            ).map(({ field, label, type, placeholder }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={adminForm[field] ?? ''}
                  onChange={(e) => setAdminForm({ ...adminForm, [field]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {isSaving ? 'Sauvegarde…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/profiles/${userId}`)}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 text-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {/* Pedagogical tab */}
        {activeTab === 'pedagogical' && canEditPedagogical && (
          <form onSubmit={handlePedagogicalSubmit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Niveau scolaire
              </label>
              <input
                type="text"
                value={pedagogicalForm.level ?? ''}
                onChange={(e) => setPedagogicalForm({ ...pedagogicalForm, level: e.target.value })}
                placeholder="Ex : Terminale, Licence 2, BTS…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Matières concernées
              </label>
              <input
                type="text"
                value={pedagogicalForm.subjects ?? ''}
                onChange={(e) => setPedagogicalForm({ ...pedagogicalForm, subjects: e.target.value })}
                placeholder="Ex : Mathématiques, Physique-Chimie…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-xs text-gray-400 mt-1">Séparez les matières par une virgule</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Objectifs pédagogiques
              </label>
              <textarea
                value={pedagogicalForm.goals ?? ''}
                onChange={(e) => setPedagogicalForm({ ...pedagogicalForm, goals: e.target.value })}
                placeholder="Ex : Rattraper les lacunes en algèbre, préparer le baccalauréat…"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes supplémentaires
              </label>
              <textarea
                value={pedagogicalForm.notes ?? ''}
                onChange={(e) => setPedagogicalForm({ ...pedagogicalForm, notes: e.target.value })}
                placeholder="Informations complémentaires pour le formateur…"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {isSaving ? 'Sauvegarde…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/profiles/${userId}`)}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 text-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  )
}
