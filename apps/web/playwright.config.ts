import { defineConfig, devices } from '@playwright/test'

/**
 * Configuration Playwright — suite e2e jouée contre la pile RÉELLE.
 *
 * Volontairement minimale : ce projet tourne sur une machine distante,
 * l'utilisateur n'a jamais accès à `localhost`. Il n'y a donc ni serveur de
 * dev local à démarrer (`webServer`), ni mock réseau — chaque test parle à
 * `https://claudevma.visioprof.fr` via api-gateway, exactement comme un
 * utilisateur réel. Voir `apps/web/e2e/README.md` pour le pourquoi et les
 * précautions (comptes de test créés à chaque exécution).
 *
 * Un seul projet navigateur (Chromium) pour démarrer : pas de matrice
 * multi-navigateurs tant que le dispositif n'a pas fait ses preuves.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://claudevma.visioprof.fr',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
