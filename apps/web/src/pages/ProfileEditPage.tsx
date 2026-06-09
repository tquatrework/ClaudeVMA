import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface AdminProfile {
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
}

export default function ProfileEditPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()

  const [form, setForm] = useState<AdminProfile>({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    apiClient
      .get<{ administrativeProfile?: AdminProfile }>(`/profiles/${userId}`)
      .then(({ data }) => {
        if (data.administrativeProfile) {
          setForm({ ...form, ...data.administrativeProfile })
        }
      })
      .catch(() => setError('Impossible de charger le profil'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      await apiClient.put(`/profiles/${userId}/administrative`, form)
      navigate(`/profiles/${userId}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Erreur lors de la sauvegarde'
      setError(msg)
    } finally {
      setIsSaving(false)
    }
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Modifier le profil</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-6">
          {(
            [
              { field: 'firstName', label: 'Prénom' },
              { field: 'lastName', label: 'Nom' },
              { field: 'phone', label: 'Téléphone' },
              { field: 'address', label: 'Adresse' },
            ] as const
          ).map(({ field, label }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="text"
                value={form[field] ?? ''}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
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
      </div>
    </Layout>
  )
}
