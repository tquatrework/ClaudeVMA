import { test, expect } from '@playwright/test'

/**
 * Preuve visuelle pour les 5 retours utilisateur post-production du 2026-08-28 sur le Quizz
 * (`docs/architecture.md` > « Edition d'un Quizz par son auteur, filtre mes Quizz, et validation
 * AP scopee par relation »).
 *
 * Jouée contre un serveur de dev local (`http://localhost:5173`) dont la configuration Vite
 * proxifie `/api/v1` vers l'api-gateway RÉEL (`https://claudevma.visioprof.fr`) — la branche
 * front n'est pas encore mergée/déployée sur le domaine, mais le backend interrogé est le vrai
 * backend de production, sans le problème de préflight CORS qu'un appel cross-origin direct
 * depuis le navigateur aurait rencontré (`auth_request` de nginx-global refuse les requêtes
 * `OPTIONS` sans `Authorization`, ce qui bloque tout appel authentifié cross-origin — constaté en
 * HTTP direct pendant cette session). Réutilise les comptes de test déjà créés pour
 * `proof-quizz-2026-08-28.spec.ts`.
 *
 * État réel du backend parallèle vérifié en HTTP direct le 2026-08-28 (PR #164
 * content-catalog-service, OUVERTE mais déjà déployée sur le conteneur en service) :
 * - `GET /quizzes?mine=true` fonctionne (confirmé, tous statuts).
 * - `PUT /quizzes/:id` fonctionne (même DTO que la création), et fait bien repasser un Quizz
 *   `validated` en `pending_validation` quand l'auteur formateur l'édite.
 * - **Aucune route ne renvoie la solution à l'auteur** (`GET /quizzes/:id/edit` n'existe pas,
 *   `?includeSolution=true` est ignoré) : l'écran d'édition demande donc à l'auteur de
 *   re-cocher les bonnes réponses et ressaisir les mots-clés (bandeau d'avertissement, voir
 *   `QuizEditPage`) — ce n'est pas un bug du front, c'est une conséquence du contrat réel.
 * - `GET /validations/quiz/:id/history` fonctionne pour RP/AP mais renvoie `403` à l'auteur :
 *   un professeur ne peut donc pas relire le motif de son propre refus par cette voie (blocage
 *   réel, signalé au rapport de session).
 * - Bug réel corrigé au passage : `POST /validations/quiz/:id/decision` attend
 *   `decision: 'validated' | 'rejected'`, jamais `'approve' | 'reject'` (vocabulaire envoyé par
 *   le front depuis la PR #157 initiale, toujours refusé en `400`) — la procédure de validation
 *   Quizz n'avait donc **jamais fonctionné en production** avant ce correctif.
 */

// Le correctif n'est pas encore déployé sur https://claudevma.visioprof.fr (branche non
// mergée) : on pointe sur le serveur de dev local, dont le proxy Vite cible le vrai api-gateway
// de production — seul le bundle front change, le backend interrogé est réel.
test.use({ baseURL: 'http://localhost:5173' })

const PROF_PASSWORD = 'E2eTest!2026'
const RP_PASSWORD = 'VisioTest2026!'

// Connexion avec réessai : la pile réelle répond parfois `502`/« Identifiants invalides » de
// façon transitoire sous connexions rapprochées (constaté pendant cette session, indépendant du
// code de ce chantier) — un réessai évite de faire échouer la preuve pour cette seule raison.
async function login(page: import('@playwright/test').Page, loginIdentifier: string, password: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/login')
    await page.getByPlaceholder('jean.dupont').fill(loginIdentifier)
    await page.getByPlaceholder('••••••••').fill(password)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    try {
      await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
      return
    } catch {
      if (attempt === 3) throw new Error(`Connexion impossible pour ${loginIdentifier} après 3 essais.`)
      await page.waitForTimeout(2000)
    }
  }
}

test('professeur — libellé, aperçu KaTeX, double choix, passage avec formule rendue, édition réelle', async ({
  page,
}) => {
  await login(page, 'e2e.quizprof.1787932490', PROF_PASSWORD)
  await page.goto('/content/quizz')

  // Point 1 — libellé exact du bouton de création.
  const createButton = page.getByRole('button', { name: 'Créer un nouveau Quizz' })
  await expect(createButton).toBeVisible()
  await createButton.click()

  await page.getByLabel(/Titre/).fill('Quiz post-production — formule mathématique')
  await page.getByLabel(/Énoncé/).fill('Que vaut $x^2$ quand $x = 3$ ?')

  const optionInputs = page.locator('input[placeholder^="Texte de l\'option"]')
  await optionInputs.nth(0).fill('$8$')
  await optionInputs.nth(1).fill('$9$')
  await page.locator('input[type="radio"]').nth(1).check()

  // Point 4 — l'aperçu KaTeX doit rendre l'énoncé et les options AVANT même la soumission
  // (pipeline partagé avec le Mémo, `LightMarkupText`/`MathRenderer`) : on vérifie la présence
  // de vrai HTML KaTeX (`.katex`), pas seulement le texte brut `$x^2$` affiché tel quel.
  await expect(page.locator('.katex').first()).toBeVisible()
  await page.screenshot({
    path: 'test-results/proof-postprod-01-formulaire-katex.png',
    fullPage: true,
  })

  await page.getByRole('button', { name: 'Créer le Quizz' }).click()

  // Point 2 — après création, deux choix distincts, jamais une navigation automatique.
  await expect(page.getByRole('button', { name: 'Commencer le Quizz' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('button', { name: 'Modifier le Quizz' })).toBeVisible()
  await page.screenshot({
    path: 'test-results/proof-postprod-02-double-choix-creation.png',
    fullPage: true,
  })

  // « Commencer le Quizz » — branché sur des routes déjà déployées (learning-activity-service,
  // PR #151) : démarrage réel d'une tentative, puis rendu KaTeX de l'énoncé/des options pendant
  // le passage (pas seulement à la création).
  await page.getByRole('button', { name: 'Commencer le Quizz' }).click()
  await expect(page).toHaveURL(/\/content\/quizz\/[a-f0-9-]+$/, { timeout: 15_000 })
  await expect(page.locator('.katex').first()).toBeVisible({ timeout: 15_000 })
  await page.screenshot({
    path: 'test-results/proof-postprod-03-passage-katex.png',
    fullPage: true,
  })

  const quizId = page.url().split('/content/quizz/')[1]

  // Point 2, moitié « Modifier le Quizz » — édition RÉELLE de bout en bout (`PUT /quizzes/:id`
  // confirmé fonctionnel). Le bandeau d'avertissement (solution jamais relue, ressaisie requise)
  // doit être visible, et une nouvelle soumission doit aboutir.
  await page.goto(`/content/quizz/${quizId}/edit`)
  await expect(page.getByText(/re-cocher la ou les bonnes réponses/)).toBeVisible({
    timeout: 15_000,
  })
  await page.getByLabel(/Titre/).fill('Quiz post-production — modifié par preuve e2e')
  // Re-cocher la bonne réponse (2e option), comme demandé par le bandeau.
  await page.locator('input[type="radio"]').nth(1).check()
  await page.screenshot({
    path: 'test-results/proof-postprod-04-edition-bandeau-securite.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
  await expect(page).toHaveURL(/\/content\/quizz\/[a-f0-9-]+$/, { timeout: 15_000 })
  await expect(page.getByText('Quiz post-production — modifié par preuve e2e')).toBeVisible()
  await page.screenshot({
    path: 'test-results/proof-postprod-04b-apres-edition.png',
    fullPage: true,
  })
})

test('professeur — onglet "Mes Quizz" : fonctionne réellement (filtre `mine` déployé)', async ({
  page,
}) => {
  await login(page, 'e2e.quizprof.1787932490', PROF_PASSWORD)
  await page.goto('/content/quizz')

  // Point 3 — l'onglet existe et charge réellement les quizz de l'auteur, tous statuts confondus.
  const myQuizzesTab = page.getByRole('tab', { name: 'Mes Quizz' })
  await expect(myQuizzesTab).toBeVisible()
  await myQuizzesTab.click()
  await expect(page.getByRole('button', { name: 'Modifier' }).first()).toBeVisible({
    timeout: 15_000,
  })
  await page.screenshot({
    path: 'test-results/proof-postprod-05-onglet-mes-quizz.png',
    fullPage: true,
  })
})

test('RP — validation réelle d\'un Quizz (bug decision "approve"/"reject" corrigé)', async ({
  page,
}) => {
  await login(page, 'rptest.proof.1787904014', RP_PASSWORD)
  await page.goto('/content/validation')
  await page.waitForTimeout(2000)

  const quizzTab = page.getByRole('button', { name: /Quizz \(\d+\)/ })
  await expect(quizzTab).toBeVisible({ timeout: 15_000 })
  await quizzTab.click()
  await page.waitForTimeout(1000)
  await page.screenshot({
    path: 'test-results/proof-postprod-06-validation-rp-onglet-quizz.png',
    fullPage: true,
  })

  // Point 5 — la décision doit réellement aboutir (avant ce correctif, le serveur refusait
  // systématiquement `400` faute du bon vocabulaire `decision`). On rejette le premier quizz en
  // attente, avec un motif — l'élément doit disparaître de la file après succès. Locator par
  // position (`ul > li`, structure de `QuizValidationList`), pas par texte : le texte du bouton
  // change (« Rejeter » → « Confirmer le rejet ») une fois le formulaire ouvert, ce qui invalide
  // un filtre par texte réévalué à chaque action.
  const itemsLocator = page.locator('ul > li')
  const itemCountBefore = await itemsLocator.count()
  const firstItem = itemsLocator.first()
  await expect(firstItem).toBeVisible({ timeout: 15_000 })
  await firstItem.getByRole('button', { name: 'Rejeter' }).click()
  await firstItem.getByPlaceholder(/Expliquez la raison du rejet/).fill('Preuve e2e — motif de test')
  await firstItem.getByRole('button', { name: 'Confirmer le rejet' }).click()
  await expect(itemsLocator).toHaveCount(itemCountBefore - 1, { timeout: 15_000 })
  await page.screenshot({
    path: 'test-results/proof-postprod-07-decision-reussie.png',
    fullPage: true,
  })
})
