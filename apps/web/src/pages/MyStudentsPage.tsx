/**
 * MyStudentsPage — « Mes élèves » (`/my-students`)
 *
 * Un seul appel, `GET /relations/my-contacts`, qui renvoie pour l'utilisateur
 * authentifié les personnes reliées avec leur prénom, leur nom et la nature du lien,
 * tous rôles confondus.
 *
 * Corrige un défaut silencieux (2026-08-11) : la page appelait
 * `fetchLinkedStudents(user.id)` → `GET /relations/finance-owner-student/:id`, c'est-à-dire
 * la table **financeur↔élève**. Les élèves d'un formateur vivent ailleurs : un formateur
 * recevait `200 []` — une liste **vide**, jamais un refus, et sans le moindre message.
 * Ce n'était pas un problème de droit, mais d'appel.
 *
 * La page liste les personnes que l'utilisateur **accompagne** : ses élèves s'il est
 * formateur, parent ou coordinateur, et les formateurs qu'il anime s'il est AP. Les
 * liens qui vont dans l'autre sens (mon professeur, mon parent) relèvent de Contacts.
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useMyContacts } from '../hooks/relations/useMyContacts'
import { describeRelations, isStudentLikeContact, isSupervisedContact } from '../utils/relationAccess'
import { MemoReadOnlyModal } from '../components/pedagogical-log/MemoReadOnlyModal'

export default function MyStudentsPage() {
  const { hasRole } = useAuth()
  const { contacts, isLoading, error } = useMyContacts()

  const supervisedContacts = contacts.filter(isSupervisedContact)
  const isParentFinanceur = hasRole('parent_financeur')

  // Un AP consultant cette page y voit les formateurs qu'il anime, jamais des
  // élèves (relation `animator_of_teacher` uniquement) — libellé adapté pour
  // ne pas afficher « Mes élèves » à un rôle qui n'en a pas. Route et donnée
  // partagées avec les autres rôles (aucune nouvelle page, aucun nouvel
  // appel) : seul l'habillage change. Ajouté le 2026-08-27, en réponse à la
  // demande d'entrée « Mes professeurs » pour l'AP.
  const isAnimateurPedagogique = hasRole('animateur_pedagogique')
  const pageTitle = isAnimateurPedagogique ? 'Mes professeurs' : 'Mes élèves'
  const pageSubtitle = isAnimateurPedagogique
    ? 'Formateurs que vous animez et dont vous suivez le parcours.'
    : 'Personnes que vous accompagnez et dont vous suivez le parcours.'

  // Pas de navigation : la page reste affichée derrière la modale — état
  // local de l'élève actuellement consulté (`null` = aucune modale ouverte).
  const [memoModalContact, setMemoModalContact] = useState<{
    userId: string
    displayName: string
  } | null>(null)

  return (
    <Layout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{pageTitle}</h1>
        <p className="text-sm text-gray-500 mb-6">{pageSubtitle}</p>

        {isLoading && <p className="text-sm text-gray-400">Chargement…</p>}

        {!isLoading && error && <p className="text-sm text-red-600">{error}</p>}

        {!isLoading && !error && supervisedContacts.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-gray-500 text-sm mb-4">
              Aucune personne rattachée à votre compte pour le moment.
            </p>
            {isParentFinanceur && (
              <Link
                to="/parent-link-requests"
                className="inline-block bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Rattacher un élève
              </Link>
            )}
          </div>
        )}

        {!isLoading && !error && supervisedContacts.length > 0 && (
          <ul className="space-y-3">
            {supervisedContacts.map((contact) => (
              <li
                key={contact.userId}
                className="bg-white border border-gray-200 rounded-xl p-5"
              >
                <p className="text-base font-semibold text-gray-800">{contact.displayName}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {describeRelations(contact.relations).join(', ')}
                </p>

                <div className="flex flex-wrap gap-2 mt-3">
                  <Link
                    to={`/profiles/${contact.userId}`}
                    className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Profil
                  </Link>
                  <Link
                    to={`/archives/${contact.userId}`}
                    className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Stats / Archives
                  </Link>
                  <Link
                    to={`/calendar?studentId=${contact.userId}`}
                    className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Calendrier
                  </Link>
                  <Link
                    to={`/pedagogical-log?studentId=${contact.userId}`}
                    className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Cahier de texte
                  </Link>
                  {isStudentLikeContact(contact) && (
                    <button
                      type="button"
                      onClick={() =>
                        setMemoModalContact({ userId: contact.userId, displayName: contact.displayName })
                      }
                      className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      Mémos
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {memoModalContact && (
          <MemoReadOnlyModal
            studentId={memoModalContact.userId}
            title={`Mémo de ${memoModalContact.displayName}`}
            onClose={() => setMemoModalContact(null)}
          />
        )}
      </div>
    </Layout>
  )
}
