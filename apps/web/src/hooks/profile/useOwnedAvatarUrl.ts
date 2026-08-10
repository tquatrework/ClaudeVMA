/**
 * useOwnedAvatarUrl — `avatarUrl` appartient à l'écran, pas au champ photo.
 *
 * Correction de trajectoire du 2026-08-10. `ProfileAvatarField` gardait dans son
 * propre état l'URL renvoyée par le serveur après un envoi, alors que cette
 * donnée est un champ du profil, détenu par la page. Le champ vivant dans un
 * onglet, tout démontage l'effaçait et l'écran repartait de l'`avatarUrl`
 * d'avant l'écriture. On avait d'abord répondu en relisant le profil à chaque
 * clic d'onglet : c'était traiter une erreur d'appartenance d'état par du
 * réseau.
 *
 * Ce hook pose la règle au bon endroit : la page détient la valeur, le champ la
 * reçoit en propriété et signale la nouvelle — **celle que le serveur vient de
 * renvoyer**, sans second aller-retour.
 *
 * Deux sources se rencontrent ici, d'où la synchronisation :
 *
 * - le **serveur**, à chaque chargement de la page. Un nouveau chargement fait
 *   autorité et écrase la valeur courante ;
 * - l'**utilisateur**, quand il envoie ou supprime sa photo. La valeur locale
 *   tient jusqu'au prochain chargement.
 *
 * La resynchronisation se fait pendant le rendu, sur l'identité de l'objet
 * chargé — et non sur l'URL elle-même, qui peut valoir `null` avant comme après
 * un changement d'utilisateur. C'est le motif documenté par React pour ajuster
 * un état lorsqu'une propriété change : synchrone, sans rendu intermédiaire
 * affiché, là où un `useEffect` laisserait passer une image périmée.
 */

import { useRef, useState } from 'react'

/**
 * @param loadedData objet de données renvoyé par le chargement de la page. Seule
 *   son **identité** est lue : une nouvelle instance signifie « le serveur vient
 *   de répondre », et la valeur locale est alors abandonnée.
 * @param loadedAvatarUrl `avatarUrl` porté par ce chargement, `null` si aucune
 *   photo (ou photo non partagée avec le lecteur).
 */
export function useOwnedAvatarUrl(
  loadedData: unknown,
  loadedAvatarUrl: string | null,
): [string | null, (nextAvatarUrl: string | null) => void] {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(loadedAvatarUrl)
  const lastLoadedDataRef = useRef(loadedData)

  if (lastLoadedDataRef.current !== loadedData) {
    lastLoadedDataRef.current = loadedData
    setAvatarUrl(loadedAvatarUrl)
  }

  return [avatarUrl, setAvatarUrl]
}
