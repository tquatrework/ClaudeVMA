import { e2eEnv } from './env'

/**
 * Appels directs à api-gateway pour préparer les données du test — les mêmes
 * routes réelles que celles documentées dans `docs/routes.md`, jouées en
 * dehors du navigateur pour construire un état de départ (élève + formateur
 * + relation active) avant que le test ne pilote l'écran.
 *
 * Aucun mock : ce sont de vrais comptes, créés par les routes d'inscription
 * publiques, comme le ferait un utilisateur.
 */

interface CreatedAccount {
  id: string
  loginIdentifier: string
  email: string
}

async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${e2eEnv.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`POST ${path} -> ${response.status} ${text}`)
  }
  return response.json() as Promise<T>
}

/** Crée un compte élève de test unique, actif dès la création (consentements fournis). */
export async function createTestStudent(
  uniqueSuffix: string,
  firstName: string,
  lastName: string,
): Promise<CreatedAccount> {
  const loginIdentifier = `e2e.eleve.${uniqueSuffix}`
  const result = await postJson<{ student: CreatedAccount }>('/accounts/students', {
    email: `${loginIdentifier}@example.test`,
    password: 'E2eTest!2026',
    firstName,
    lastName,
    loginIdentifier,
    consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
  })
  return result.student
}

/** Crée un compte formateur de test unique, actif dès la création. */
export async function createTestTeacher(
  uniqueSuffix: string,
  firstName: string,
  lastName: string,
): Promise<CreatedAccount> {
  const loginIdentifier = `e2e.prof.${uniqueSuffix}`
  return postJson<CreatedAccount>('/accounts/teachers', {
    email: `${loginIdentifier}@example.test`,
    password: 'E2eTest!2026',
    firstName,
    lastName,
    loginIdentifier,
    consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
  })
}

/** Connexion RP — le rôle n'est pas auto-inscriptible, ce compte doit déjà exister. */
export async function loginAsRp(): Promise<string> {
  const result = await postJson<{ access_token: string }>('/auth/login', {
    loginIdentifier: e2eEnv.rpLoginIdentifier,
    password: e2eEnv.rpPassword,
  })
  return result.access_token
}

/** Lie un formateur à un élève, comme le ferait le RP depuis l'écran de mise en relation. */
export async function linkTeacherToStudent(
  rpToken: string,
  teacherId: string,
  studentId: string,
): Promise<void> {
  await postJson(
    '/relations/teacher-student',
    { teacherId, studentId, isPrincipalTeacher: true },
    rpToken,
  )
}
