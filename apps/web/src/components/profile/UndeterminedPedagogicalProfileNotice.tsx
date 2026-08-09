/**
 * UndeterminedPedagogicalProfileNotice — le seul cas où aucun formulaire
 * pédagogique n'est proposé.
 *
 * Ni le serveur (`pedagogicalType: null`) ni les données enregistrées ne disent
 * s'il s'agit d'un profil élève ou formateur, et le rôle du titulaire n'est pas
 * connu du lecteur : proposer un formulaire au hasard écrirait dans la mauvaise
 * table. C'est une impasse assumée, pas un profil vide — d'où un texte qui
 * explique et oriente, plutôt qu'un « non renseigné » muet.
 *
 * Partagé par la fiche et l'écran de modification : deux formulations
 * différentes du même blocage laisseraient croire à deux problèmes distincts.
 */

import React from 'react'

export function UndeterminedPedagogicalProfileNotice() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
      <p>
        Le profil pédagogique de cette personne n'a jamais été renseigné : sa forme (élève ou
        formateur) ne peut pas être déterminée depuis cet écran.
      </p>
      <p className="mt-2">
        Demandez à la personne concernée de le compléter depuis son propre profil.
      </p>
    </div>
  )
}
