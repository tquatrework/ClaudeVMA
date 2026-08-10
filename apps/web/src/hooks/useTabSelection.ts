/**
 * useTabSelection — onglet actif d'un écran, **et relecture des données à chaque
 * activation**.
 *
 * Règle d'application posée le 2026-08-10, générale et non négociable par écran :
 * cliquer sur « Profil administratif » redemande le profil administratif,
 * cliquer sur « Profil pédagogique » redemande le profil pédagogique, et il en
 * ira de même de tout menu du front. Un écran ne doit jamais montrer une donnée
 * dont il ne sait plus si le serveur la confirme encore.
 *
 * **Pas de cache** — arbitrage explicite de l'utilisateur, en connaissance de
 * cause : un cache serait plus fluide mais ajoute une couche de complexité,
 * remise à plus tard. On redemande donc systématiquement, y compris quand la
 * réponse précédente vient d'arriver. Ne pas réintroduire ici de mémoire
 * intermédiaire, même « légère » ou « juste pour éviter un doublon ».
 *
 * Trois pièges, traités ici une fois pour toutes :
 *
 * 1. **Pas de relecture au montage.** L'écran charge déjà ses données en
 *    arrivant ; déclencher aussi l'activation du premier onglet doublerait la
 *    requête. Seul un **clic réel** relit.
 * 2. **Un retour sur un onglet déjà visité relit lui aussi** — c'est exactement
 *    le cas qui échouait : la photo envoyée disparaissait au retour sur
 *    l'onglet, l'écran repartant d'une copie d'avant l'envoi. Re-cliquer
 *    l'onglet **déjà actif** relit également : c'est un clic de l'utilisateur,
 *    souvent celui de quelqu'un qui veut justement rafraîchir.
 * 3. **L'écran ne clignote pas.** La relecture est demandée en arrière-plan ;
 *    c'est à l'écran appelant de garder ses données affichées pendant ce
 *    temps — voir `isInitialLoading` dans les pages de profil — plutôt que de
 *    repasser sur « Chargement… » à chaque clic.
 */

import { useCallback, useRef, useState } from 'react'

export interface UseTabSelectionResult {
  activeTab: string
  /** À brancher sur `onTabChange` de `Tabs` : change d'onglet ET relit. */
  selectTab: (tabId: string) => void
}

/**
 * @param initialTabId onglet affiché à l'arrivée sur l'écran
 * @param onTabActivated relecture des données de l'écran, appelée à **chaque**
 *   clic d'onglet et jamais au montage. Typiquement `refreshProfile`.
 */
export function useTabSelection(
  initialTabId: string,
  onTabActivated?: () => void,
): UseTabSelectionResult {
  const [activeTab, setActiveTab] = useState(initialTabId)

  // Lu par référence : l'appelant n'a pas à mémoïser sa fonction pour que
  // `selectTab` garde une identité stable.
  const onTabActivatedRef = useRef(onTabActivated)
  onTabActivatedRef.current = onTabActivated

  const selectTab = useCallback((tabId: string) => {
    setActiveTab(tabId)
    onTabActivatedRef.current?.()
  }, [])

  return { activeTab, selectTab }
}
