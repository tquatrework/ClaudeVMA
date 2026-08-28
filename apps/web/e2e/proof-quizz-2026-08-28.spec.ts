import { test, expect } from '@playwright/test'

/**
 * Preuve visuelle a la pile reelle (https://claudevma.visioprof.fr) de l'interface Quizz
 * nouvellement branchee (remplace l'etat « a venir » de QuizzPage).
 *
 * IMPORTANT — lire avant d'interpreter les captures : au moment de cette preuve, api-gateway
 * n'expose encore AUCUNE route pour `/api/v1/quizzes`, `/api/v1/validations` ni
 * `/api/v1/quiz-attempts` (aucun `location` dans gateway/api-gateway/nginx.conf), et
 * `content-catalog-service` renvoie un 500 sur `GET /quizzes/pending-validation` sans
 * `page`/`limit` explicites (corrige cote front, mais la route elle-meme reste fragile).
 * Ces captures montrent donc l'interface REELLEMENT deployee gerant l'echec reseau
 * proprement (bandeau d'erreur francais, jamais un ecran vide ni un succes silencieux) —
 * ce n'est PAS une preuve du scenario "recherche/creation/passage" complet, qui reste
 * bloque par cette lacune d'infrastructure, hors perimetre de ce chantier front.
 *
 * Le contrat cote service a ete verifie directement contre les conteneurs
 * (`content-catalog-service`, `learning-activity-service`), sans passer par api-gateway :
 * creation d'un quizz par un RP (auto-valide), recherche par tag, demarrage d'une tentative,
 * soumission notee (score 6/6 sur un quizz a 3 questions), historique — voir le rapport de
 * session pour le detail des requetes/reponses HTTP citees.
 */

const PASSWORD = 'E2eTest!2026'

async function login(page: import('@playwright/test').Page, loginIdentifier: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(loginIdentifier)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}

test('élève — écran Quizz (catalogue + recherche), interface réelle déployée', async ({ page }) => {
  await login(page, 'e2e.quizstud.1787932490', PASSWORD)
  await page.goto('/content/quizz')
  await expect(page.getByRole('heading', { name: 'Quizz' })).toBeVisible()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/proof-quizz-01-catalogue-eleve.png', fullPage: true })
})

test('professeur — formulaire de création complet, interface réelle déployée', async ({ page }) => {
  await login(page, 'e2e.quizprof.1787932490', PASSWORD)
  await page.goto('/content/quizz')
  await page.getByRole('button', { name: 'Nouveau Quizz' }).click()
  await page.getByLabel(/Titre/).fill('Quiz créé par un professeur — preuve visuelle')
  await page.getByLabel('Description').fill('Formulaire complet : questions, options, barème, pénalité.')

  await page.getByLabel(/Énoncé/).fill('Ceci est vrai ?')
  const optionInputs = page.locator('input[placeholder="Texte de l\'option"]')
  await optionInputs.nth(0).fill('Faux')
  await optionInputs.nth(1).fill('Vrai')
  await page.locator('input[type="radio"]').nth(1).check()

  await page.getByRole('checkbox', { name: /Pénalité globale/ }).check()
  await page.getByLabel('Points de pénalité').fill('1')

  await page.screenshot({ path: 'test-results/proof-quizz-02-formulaire-creation.png', fullPage: true })

  await page.getByRole('button', { name: 'Créer le Quizz' }).click()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/proof-quizz-03-apres-soumission.png', fullPage: true })
})

test('RP — file de validation, onglet Quizz intégré au mécanisme déjà en place', async ({ page }) => {
  // Constat fait en écrivant cette preuve, sans lien avec le Quizz : gateway/api-gateway/nginx.conf
  // n'a jamais eu de `location` pour `/api/v1/evaluations` ni `/api/v1/tutorials` (seul
  // `/api/v1/exercises` existe pour content-catalog-service, en plus de `/api/v1/content` et
  // `/api/v1/assessments`) — `ContentValidationQueuePage` échouait donc déjà avant ce chantier
  // pour RP/AP. Le chargement du Quizz a été isolé du reste (voir `handleDecideQuiz` /
  // `fetchPendingQuizzes` dans `ContentValidationQueuePage.tsx`) pour ne pas ajouter une
  // quatrième cause d'échec au même Promise.all, mais ce pré-existant empêche cette capture de
  // montrer l'onglet Quizz effectivement peuplé — capturée telle quelle, sans le masquer.
  await login(page, 'rptest.proof.1787904014', 'VisioTest2026!')
  await page.goto('/content/validation')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/proof-quizz-04-validation-rp.png', fullPage: true })
})
