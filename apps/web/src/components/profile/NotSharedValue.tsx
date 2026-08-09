/**
 * NotSharedValue — valeur d'un champ que le titulaire ne partage pas avec le
 * lecteur courant.
 *
 * Rendu **volontairement distinct** d'un champ vide : un champ non renseigné
 * n'est pas listé du tout, un champ non partagé apparaît avec son libellé et
 * cette pastille. C'est la présence de la ligne qui porte l'information — sans
 * elle, le lecteur conclurait à tort que la personne n'a rien saisi.
 *
 * Pas de rouge ni de cadenas barré : un réglage de confidentialité n'est ni une
 * erreur ni un refus adressé au lecteur.
 */

import React from 'react'
import { NOT_SHARED_PLACEHOLDER } from '../../utils/profileVisibility'

export function NotSharedValue() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
      <span aria-hidden="true" className="text-slate-400">
        &#9679;
      </span>
      {NOT_SHARED_PLACEHOLDER}
    </span>
  )
}
