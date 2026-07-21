/**
 * TeacherPedagogicalStep — étape 2 (profil pédagogique) du wizard d'inscription formateur.
 * Extrait de TeacherRegistrationPage (lot 10 — normalisation, découpage > 300 lignes).
 * Rendu identique à l'origine.
 */

import React from 'react'

export interface TeacherPedagogicalFormData {
  teachingSubjects: string
  educationLevel: string
  bio: string
}

interface TeacherPedagogicalStepProps {
  pedagogicalData: TeacherPedagogicalFormData
  onChange: (field: keyof TeacherPedagogicalFormData, value: string) => void
  onSubmit: (event: React.FormEvent) => void
  onBack: () => void
}

export function TeacherPedagogicalStep({
  pedagogicalData,
  onChange,
  onSubmit,
  onBack,
}: TeacherPedagogicalStepProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Profil pédagogique</h2>
      <p className="text-xs text-gray-500">Ces informations aideront le RP à valider votre dossier.</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Matières enseignées
        </label>
        <input
          type="text"
          value={pedagogicalData.teachingSubjects}
          onChange={(e) => onChange('teachingSubjects', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="ex: Mathématiques, Physique…"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Niveau d'enseignement
        </label>
        <select
          value={pedagogicalData.educationLevel}
          onChange={(e) => onChange('educationLevel', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Sélectionner un niveau</option>
          <option value="college">Collège</option>
          <option value="lycee">Lycée</option>
          <option value="bac_plus_2">Bac +2</option>
          <option value="superieur">Supérieur</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Présentation (bio)
        </label>
        <textarea
          value={pedagogicalData.bio}
          onChange={(e) => onChange('bio', e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          placeholder="Décrivez votre expérience et votre approche pédagogique…"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Retour
        </button>
        <button
          type="submit"
          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Suivant
        </button>
      </div>
    </form>
  )
}
