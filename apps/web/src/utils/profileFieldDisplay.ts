/**
 * Mise en forme des VALEURS de champs de profil pour l'affichage.
 *
 * Complément de `profileFieldLabels.ts` (qui porte les libellés) : ici on décide
 * comment une valeur brute d'API devient un texte lisible. Aucun écran ne
 * réimplémente ces règles — sinon un tableau finirait affiché en JSON sur une
 * page et en liste sur une autre.
 *
 * Trois interdits, repris de la règle UX du projet : jamais de JSON brut, jamais
 * de date ISO affichée telle quelle, jamais d'identifiant technique présenté
 * comme un libellé métier.
 */

import { formatIsoCalendarDate, formatLocalDateTime } from './dateFormat'

/** Champs porteurs d'une date calendaire (`YYYY-MM-DD`). */
const CALENDAR_DATE_FIELD_NAMES = ['birthDate']

/** Champs porteurs d'un horodatage complet. */
const TIMESTAMP_FIELD_NAMES = ['filledAt', 'createdAt', 'updatedAt']

/** Valeur affichée quand un champ existe mais n'a pas de contenu exploitable. */
export const EMPTY_VALUE_PLACEHOLDER = 'Non renseigné'

/** La valeur est-elle vide au sens de l'affichage (à masquer plutôt qu'à montrer) ? */
export function isEmptyFieldValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * Rend une valeur de champ lisible en français.
 *
 * @param fieldName nom technique du champ (sert à choisir le format de date)
 * @param value valeur brute telle que renvoyée par profile-service
 */
export function formatProfileFieldValue(fieldName: string, value: unknown): string {
  if (isEmptyFieldValue(value)) return EMPTY_VALUE_PLACEHOLDER

  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string' || typeof entry === 'number')
      .map((entry) => String(entry))
      .join(', ')
  }

  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'

  if (typeof value === 'string') {
    if (CALENDAR_DATE_FIELD_NAMES.includes(fieldName)) return formatIsoCalendarDate(value)
    if (TIMESTAMP_FIELD_NAMES.includes(fieldName)) return formatLocalDateTime(value)
    return value
  }

  if (typeof value === 'number') return String(value)

  // Objet imbriqué inattendu : ne jamais afficher de JSON à l'utilisateur.
  return EMPTY_VALUE_PLACEHOLDER
}
