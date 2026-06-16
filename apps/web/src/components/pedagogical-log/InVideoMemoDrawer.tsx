/**
 * InVideoMemoDrawer — drawer latéral pour accéder au mémo pendant une vidéosession.
 * S'ouvre depuis un bouton "Mémo" dans VideoPage.
 * Accessible uniquement aux élèves (règle métier mémo).
 * Les formateurs voient un message readonly.
 */

import React from 'react'
import { useAuth } from '../../hooks/useAuth'
import StudentMemoPanel from './StudentMemoPanel'

interface InVideoMemoDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function InVideoMemoDrawer({ isOpen, onClose }: InVideoMemoDrawerProps) {
  const { hasRole } = useAuth()

  const isEleve = hasRole('eleve')

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col"
        role="complementary"
        aria-label="Mémo élève"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-indigo-50">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Mon mémo</h2>
            <p className="text-xs text-gray-500">Pendant la session</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Fermer le mémo"
          >
            ✕
          </button>
        </div>

        {/* Drawer content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isEleve ? (
            <StudentMemoPanel />
          ) : (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm font-medium text-gray-600">Mémo non disponible</p>
              <p className="text-xs mt-1">
                Le mémo est un espace personnel réservé à l'élève.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
