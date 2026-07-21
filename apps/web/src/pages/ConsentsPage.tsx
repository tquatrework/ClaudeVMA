import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useConsents } from '../hooks/accounts/useConsents'
import type { ConsentType } from '../types/accounts'
import Layout from '../components/Layout'

const REQUIRED_TYPES: readonly ConsentType[] = ['rgpd', 'cgu']

export default function ConsentsPage() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [marketing, setMarketing] = useState(false)
  const {
    signedTypes: signed,
    isLoading,
    loadError,
    sign,
    isSaving,
    signError,
  } = useConsents()

  const error = loadError ?? signError
  const allRequiredSigned = REQUIRED_TYPES.every((t) => signed.includes(t))

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-500">Chargement…</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Consentements RGPD / CGU</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {REQUIRED_TYPES.map((type) => {
            const isSigned = signed.includes(type)
            return (
              <div
                key={type}
                className={`p-4 border rounded-xl flex items-center justify-between ${
                  isSigned ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div>
                  <p className="font-medium text-gray-800 uppercase text-sm">{type}</p>
                  <p className="text-xs text-gray-500">
                    {type === 'rgpd'
                      ? 'Protection des données personnelles'
                      : "Conditions générales d'utilisation"}
                  </p>
                </div>
                {isSigned ? (
                  <span className="text-green-600 text-sm font-medium">Signé</span>
                ) : (
                  <button
                    disabled={isSaving}
                    onClick={() => sign(type)}
                    className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Signer
                  </button>
                )}
              </div>
            )
          })}

          {/* Optional marketing consent */}
          <div className="p-4 border border-gray-200 bg-white rounded-xl flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800 text-sm">Marketing (optionnel)</p>
              <p className="text-xs text-gray-500">Recevoir des communications commerciales</p>
            </div>
            {signed.includes('marketing') ? (
              <span className="text-green-600 text-sm font-medium">Signé</span>
            ) : (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="rounded"
                />
                Accepter
              </label>
            )}
          </div>
        </div>

        {allRequiredSigned && (
          <div className="mt-6">
            <p className="text-green-700 text-sm mb-3">
              Consentements obligatoires signés. Votre compte est actif.
            </p>
            {marketing && !signed.includes('marketing') && (
              <button
                onClick={() => sign('marketing')}
                className="mr-3 text-sm text-indigo-600 hover:underline"
              >
                Signer le consentement marketing
              </button>
            )}
            <button
              onClick={async () => {
                await refreshUser()
                navigate('/dashboard')
              }}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 text-sm"
            >
              Accéder à mon espace
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
