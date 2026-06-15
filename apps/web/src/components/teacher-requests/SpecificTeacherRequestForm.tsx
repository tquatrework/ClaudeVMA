/**
 * SpecificTeacherRequestForm
 *
 * Formulaire de création d'une demande professeur spécifique.
 * Utilisé par élève et parent_financeur.
 * Appelle POST /api/v1/teacher-requests.
 */
import React, { useState } from 'react'
import apiClient from '../../api/client'

interface TeacherRequestPayload {
  description: string
  studentId?: string
  level?: string
  subjects?: string[]
  preferredDays?: string[]
}

interface TeacherRequestCreated {
  id: string
  status: string
  createdAt: string
  description: string
  studentId?: string
}

const AVAILABLE_SUBJECTS = [
  'Algèbre',
  'Géométrie',
  'Analyse',
  'Probabilités',
  'Statistiques',
  'Arithmétique',
]

const AVAILABLE_DAYS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
]

interface SpecificTeacherRequestFormProps {
  /** Pré-rempli si l'utilisateur est un parent soumettant pour un élève lié */
  defaultStudentId?: string
  /** Si true, affiche le champ ID élève */
  showStudentIdField?: boolean
  onSuccess: (createdRequest: TeacherRequestCreated) => void
  onCancel: () => void
}

export default function SpecificTeacherRequestForm({
  defaultStudentId = '',
  showStudentIdField = false,
  onSuccess,
  onCancel,
}: SpecificTeacherRequestFormProps) {
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState(defaultStudentId)
  const [level, setLevel] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((previous) =>
      previous.includes(subject)
        ? previous.filter((subj) => subj !== subject)
        : [...previous, subject],
    )
  }

  const toggleDay = (day: string) => {
    setSelectedDays((previous) =>
      previous.includes(day)
        ? previous.filter((existingDay) => existingDay !== day)
        : [...previous, day],
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!description.trim()) return

    setIsSubmitting(true)
    setErrorMessage(null)

    const payload: TeacherRequestPayload = { description: description.trim() }
    if (studentId.trim()) payload.studentId = studentId.trim()
    if (level.trim()) payload.level = level.trim()
    if (selectedSubjects.length > 0) payload.subjects = selectedSubjects
    if (selectedDays.length > 0) payload.preferredDays = selectedDays

    try {
      const { data } = await apiClient.post<TeacherRequestCreated>('/teacher-requests', payload)
      onSuccess(data)
    } catch (error: unknown) {
      const apiMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la création de la demande'
      setErrorMessage(apiMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm"
    >
      <h2 className="text-base font-semibold text-gray-800">
        Nouvelle demande de professeur
      </h2>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-600 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {showStudentIdField && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ID de l'élève <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <input
            type="text"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="UUID de l'élève concerné"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Niveau <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <input
          type="text"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          placeholder="ex. 3ème, Terminale S, BTS…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Matières concernées <span className="text-gray-400 font-normal">(optionnel)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_SUBJECTS.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => toggleSubject(subject)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                selectedSubjects.includes(subject)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {subject}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Disponibilités souhaitées <span className="text-gray-400 font-normal">(optionnel)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                selectedDays.includes(day)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Décrivez le besoin pédagogique, les objectifs, les contraintes particulières…"
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting || !description.trim()}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Envoi…' : 'Soumettre la demande'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
