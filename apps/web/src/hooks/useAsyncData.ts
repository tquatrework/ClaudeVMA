import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { getErrorMessage } from '../utils/apiError'

export interface UseAsyncDataResult<T> {
  data: T | undefined
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export interface UseAsyncDataOptions {
  /** Message affiché si l'erreur ne peut pas être traduite plus précisément (voir `getErrorMessage`). */
  fallbackErrorMessage?: string
}

/**
 * useAsyncData — hook bas niveau et transverse (pas de logique métier) pour charger une donnée
 * asynchrone, typiquement un appel `src/api/*`, avec protection anti-réponse-obsolète.
 *
 * Les hooks métier de `src/hooks/<domaine>/` s'appuient dessus au lieu de réimplémenter
 * individuellement le cycle loading/error/ignore-flag/refetch à chaque fois.
 *
 * Protection anti-réponse-obsolète : si `deps` change (ou si le composant est démonté) avant
 * la résolution de la promesse en cours, son résultat est ignoré via un flag "ignore" posé dans
 * le cleanup de l'effet — l'état n'est jamais mis à jour à partir d'une requête dépassée par une
 * requête plus récente.
 *
 * @param fetchFn fonction retournant la promesse à résoudre. Rappelée à chaque changement de
 *   `deps` ou appel de `refetch`. Elle est lue via une ref à chaque exécution de l'effet, donc
 *   l'appelant n'a pas besoin de la mémoïser avec `useCallback` pour éviter des rechargements
 *   en boucle — seules les valeurs listées dans `deps` déclenchent un rechargement.
 * @param deps dépendances déclenchant un rechargement, à la manière de `useEffect`.
 * @param options.fallbackErrorMessage message de secours propre au contexte d'appel.
 */
export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  deps: DependencyList,
  options: UseAsyncDataOptions = {},
): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refetchToken, setRefetchToken] = useState(0)

  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const fallbackErrorMessageRef = useRef(options.fallbackErrorMessage)
  fallbackErrorMessageRef.current = options.fallbackErrorMessage

  useEffect(() => {
    let isIgnored = false

    setIsLoading(true)
    setError(null)

    fetchFnRef
      .current()
      .then((result) => {
        if (isIgnored) return
        setData(result)
      })
      .catch((caughtError: unknown) => {
        if (isIgnored) return
        setError(getErrorMessage(caughtError, fallbackErrorMessageRef.current))
      })
      .finally(() => {
        if (isIgnored) return
        setIsLoading(false)
      })

    return () => {
      isIgnored = true
    }
    // deps est fourni par l'appelant, à la manière de useEffect — refetchToken permet en plus
    // de déclencher un rechargement explicite via `refetch()` sans changer les dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refetchToken])

  const refetch = useCallback(() => {
    setRefetchToken((previous) => previous + 1)
  }, [])

  return { data, isLoading, error, refetch }
}
