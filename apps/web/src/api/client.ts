/// <reference types="vite/client" />
import axios from 'axios'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Un corps `FormData` ne doit **jamais** partir avec un `Content-Type` JSON.
 *
 * L'en-tête par défaut posé ci-dessus s'applique sinon à toutes les requêtes, y
 * compris aux envois de fichier. Or `transformRequest` d'axios fait
 * `return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data` :
 * quand le `Content-Type` annonce du JSON, le `FormData` est **converti en JSON**
 * et le fichier est perdu à l'émission — le serveur ne reçoit aucune partie
 * multipart et répond « Aucun fichier reçu ».
 *
 * On retire donc l'en-tête ici, une fois pour toutes, plutôt que de compter sur
 * chaque appelant à y penser : le prochain envoi de fichier (CV formateur,
 * pièce justificative) part correctement sans rien avoir à déclarer.
 *
 * On ne pose surtout pas `multipart/form-data` en remplacement : sans le
 * `boundary`, que seul l'émetteur connaît, le corps serait illisible côté
 * serveur. En l'absence d'en-tête, le navigateur pose lui-même
 * `multipart/form-data; boundary=…`.
 *
 * Les requêtes JSON ne sont pas touchées : la condition ne porte que sur les
 * corps `FormData`.
 */
function isFormDataBody(body: unknown): boolean {
  return typeof FormData !== 'undefined' && body instanceof FormData
}

function removeContentTypeHeader(headers: unknown): void {
  if (!headers || typeof headers !== 'object') return

  // `config.headers` est une instance `AxiosHeaders` en production (méthode
  // `delete`, insensible à la casse) mais peut être un objet nu dans un test.
  const headerBag = headers as Record<string, unknown> & {
    delete?: (headerName: string) => void
  }

  if (typeof headerBag.delete === 'function') {
    headerBag.delete('Content-Type')
    return
  }

  for (const headerName of Object.keys(headerBag)) {
    if (headerName.toLowerCase() === 'content-type') {
      delete headerBag[headerName]
    }
  }
}

apiClient.interceptors.request.use((config) => {
  if (isFormDataBody(config.data)) {
    removeContentTypeHeader(config.headers)
  }
  return config
})

// Handle 401 — clear session and redirect to login (except on public registration/auth routes)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const publicApiRoutes = ['/accounts/teachers', '/accounts/students', '/accounts/parents', '/accounts', '/auth/login']
    const isPublicRoute = publicApiRoutes.some(
      (path) => error.config?.url?.includes(path)
    )
    if (error.response?.status === 401 && !isPublicRoute) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default apiClient
