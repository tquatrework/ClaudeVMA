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
 * La mécanique de détention (valeur locale, resynchronisation sur l'identité de
 * l'objet chargé) est **commune à tous les champs de profil** depuis la
 * généralisation du 2026-08-10 : elle vit dans `useOwnedValue`, ce hook n'en est
 * plus que la lecture nommée pour la photo.
 */

import { useOwnedValue } from '../useOwnedValue'

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
  return useOwnedValue<string | null>(loadedData, loadedAvatarUrl)
}
