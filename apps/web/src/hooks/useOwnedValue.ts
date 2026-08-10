/**
 * useOwnedValue — une donnée **détenue par l'écran**, alimentée par deux sources.
 *
 * Généralisation du 2026-08-10, extraite de `useOwnedAvatarUrl`. Le défaut
 * corrigé pour la photo n'avait rien de propre à la photo : une donnée d'écran
 * rangée dans l'état d'un composant monté à l'intérieur d'un onglet disparaît
 * avec lui, et l'écran repart de la valeur d'avant l'écriture. On avait d'abord
 * répondu en relisant le serveur à chaque clic d'onglet — du réseau pour
 * compenser une erreur d'appartenance d'état.
 *
 * La règle, valable pour tout champ : la **page** détient la valeur, les
 * composants la reçoivent en propriété et lui signalent la nouvelle — celle que
 * le serveur vient de renvoyer, sans second aller-retour.
 *
 * Deux sources se rencontrent donc ici :
 *
 * - le **serveur au chargement** : une nouvelle réponse fait autorité et écrase
 *   la valeur courante ;
 * - le **serveur à l'écriture**, relayé par l'écran : la valeur enregistrée tient
 *   jusqu'au prochain chargement.
 *
 * La resynchronisation se fait pendant le rendu, sur l'**identité de l'objet
 * chargé** — et non sur la valeur elle-même, qui peut être identique (ou `null`)
 * avant comme après un changement d'utilisateur. C'est le motif documenté par
 * React pour ajuster un état lorsqu'une propriété change : synchrone, sans rendu
 * intermédiaire affiché, là où un `useEffect` laisserait passer une valeur
 * périmée à l'écran.
 */

import { useRef, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * @param loadedData objet renvoyé par le chargement de la page. Seule son
 *   **identité** est lue : une nouvelle instance signifie « le serveur vient de
 *   répondre », et la valeur locale est alors abandonnée.
 * @param loadedValue valeur portée par ce chargement.
 */
export function useOwnedValue<T>(
  loadedData: unknown,
  loadedValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(loadedValue)
  const lastLoadedDataRef = useRef(loadedData)

  if (lastLoadedDataRef.current !== loadedData) {
    lastLoadedDataRef.current = loadedData
    setValue(loadedValue)
  }

  return [value, setValue]
}
