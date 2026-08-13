import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))

/**
 * Chargeur minimal de `.env.e2e` (format `CLE=valeur`, une par ligne,
 * commentaires `#` ignorés). Volontairement sans dépendance : la suite e2e
 * est un dispositif minimal, ajouter `dotenv` pour ça serait disproportionné.
 *
 * `.env.e2e` est gitignoré (`.env*` dans le `.gitignore` racine) : les
 * identifiants du compte RP de test n'y sont jamais committés. Voir
 * `.env.e2e.example` pour la forme attendue.
 */
function loadDotEnvE2e(): void {
  const path = resolve(currentDir, '../../.env.e2e')
  if (!existsSync(path)) {
    return
  }
  const content = readFileSync(path, 'utf-8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }
    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadDotEnvE2e()

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variable d'environnement e2e manquante : ${name}. ` +
        `Voir apps/web/.env.e2e.example et apps/web/e2e/README.md.`,
    )
  }
  return value
}

export const e2eEnv = {
  apiBaseUrl: process.env.E2E_API_BASE_URL ?? 'https://claudevma.visioprof.fr/api/v1',
  appBaseUrl: process.env.E2E_APP_BASE_URL ?? 'https://claudevma.visioprof.fr',
  get rpLoginIdentifier(): string {
    return requireEnv('E2E_RP_LOGIN_IDENTIFIER')
  },
  get rpPassword(): string {
    return requireEnv('E2E_RP_PASSWORD')
  },
}
