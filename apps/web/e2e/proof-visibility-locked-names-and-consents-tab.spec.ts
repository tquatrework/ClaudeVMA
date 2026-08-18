import { test, expect } from '@playwright/test'
import { createTestStudent } from './support/api'
import { e2eEnv } from './support/env'

/**
 * Preuve à l'écran de deux changements front livrés sur `fix/front-visibilite-defauts-role`
 * (commits `37a94d3` « reafficher prenom/nom verrouilles sur /visibilite » et `101aaa1`
 * « consentements RGPD/CGU visibles dans l'onglet Confidentialite du profil »), jouée contre
 * la pile réelle (`https://claudevma.visioprof.fr`), avec un compte créé via la vraie route
 * d'inscription (`POST /accounts/students`, consentements RGPD+CGU fournis à l'inscription).
 *
 * 1. `/profiles/:userId/visibility` : Prénom et Nom réapparaissent dans la liste des champs,
 *    grisés/verrouillés sur « Tous les membres », sans aucun sélecteur actif, avec la légende
 *    « Toujours visible, non modifiable ».
 * 2. Page de profil, onglet « Confidentialité » (sur son propre profil) : les 3 consentements
 *    (rgpd, cgu, marketing) s'affichent en haut avec leur état courant, et la tuile
 *    précédemment nommée « Confidentialité » est renommée « Détails » et se trouve en dessous.
 *    Le bouton de retrait n'apparaît que pour `marketing` (accordé explicitement dans ce test
 *    via `POST /consents`, pour rendre le bouton observable), jamais pour `rgpd`/`cgu`.
 */

const STUDENT_FIRST_NAME = 'Manon'
const STUDENT_LAST_NAME = 'Lefebvre'
const PASSWORD = 'E2eTest!2026'

async function loginViaScreen(
  page: import('@playwright/test').Page,
  loginIdentifier: string,
): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(loginIdentifier)
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

/** Récupère un token API pour l'élève de test (hors écran, pour préparer l'état). */
async function loginViaApi(loginIdentifier: string): Promise<string> {
  const response = await fetch(`${e2eEnv.apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginIdentifier, password: PASSWORD }),
  })
  if (!response.ok) {
    throw new Error(`POST /auth/login -> ${response.status} ${await response.text()}`)
  }
  const body = (await response.json()) as { access_token: string }
  return body.access_token
}

/** Accorde le consentement marketing (optionnel), pour rendre le bouton « Retirer » observable. */
async function grantMarketingConsent(token: string): Promise<void> {
  const response = await fetch(`${e2eEnv.apiBaseUrl}/consents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ consentType: 'marketing' }),
  })
  if (!response.ok) {
    throw new Error(`POST /consents -> ${response.status} ${await response.text()}`)
  }
}

test.describe('Défauts de visibilité champ par champ et onglet Confidentialité (2026-08-18)', () => {
  test('prénom/nom réapparaissent verrouillés sur /profiles/:userId/visibility', async ({
    page,
  }) => {
    const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const student = await createTestStudent(uniqueSuffix, STUDENT_FIRST_NAME, STUDENT_LAST_NAME)

    await loginViaScreen(page, student.loginIdentifier)
    await page.goto(`/profiles/${student.id}/visibility`)

    await expect(page.getByRole('heading', { name: 'Confidentialité' })).toBeVisible()
    // Le catalogue serveur est bien arrivé (au moins un bloc administratif rendu).
    await expect(page.getByText('Informations administratives')).toBeVisible()

    // Prénom et Nom sont de retour dans la liste, chacun avec sa légende de verrouillage
    // et son public verrouillé sur « Tous les membres » — pas de sélecteur radio actif.
    const firstNameRow = page
      .locator('li')
      .filter({ has: page.getByText('Prénom', { exact: true }) })
    const lastNameRow = page
      .locator('li')
      .filter({ has: page.getByText('Nom', { exact: true }) })

    await expect(firstNameRow).toBeVisible()
    await expect(firstNameRow.getByText('Toujours visible, non modifiable')).toBeVisible()
    await expect(firstNameRow.getByText('Tous les membres', { exact: true })).toBeVisible()
    await expect(firstNameRow.locator('input[type="radio"]')).toHaveCount(0)

    await expect(lastNameRow).toBeVisible()
    await expect(lastNameRow.getByText('Toujours visible, non modifiable')).toBeVisible()
    await expect(lastNameRow.getByText('Tous les membres', { exact: true })).toBeVisible()
    await expect(lastNameRow.locator('input[type="radio"]')).toHaveCount(0)

    // Aucun champ réglable de l'écran ne porte le nom `firstName`/`lastName` en radio.
    await expect(page.locator('input[name="visibility-firstName"]')).toHaveCount(0)
    await expect(page.locator('input[name="visibility-lastName"]')).toHaveCount(0)

    await page.screenshot({
      path: 'test-results/proof-visibility-locked-firstname-lastname.png',
      fullPage: true,
    })
  })

  test('onglet Confidentialité : consentements en haut, tuile « Détails » en dessous, retrait réservé à marketing', async ({
    page,
  }) => {
    const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const student = await createTestStudent(
      `${uniqueSuffix}b`,
      STUDENT_FIRST_NAME,
      STUDENT_LAST_NAME,
    )

    // Accorde marketing hors écran, pour que le bouton de retrait soit observable sur ce
    // consentement optionnel — rgpd et cgu sont déjà accordés depuis l'inscription.
    const apiToken = await loginViaApi(student.loginIdentifier)
    await grantMarketingConsent(apiToken)

    await loginViaScreen(page, student.loginIdentifier)
    await page.goto(`/profiles/${student.id}`)

    await page.getByRole('tab', { name: 'Confidentialité' }).click()
    await expect(page.getByRole('tabpanel', { name: 'Confidentialité' })).toBeVisible()

    // Section consentements en tête de l'onglet.
    await expect(page.getByText('Consentements RGPD / CGU')).toBeVisible()
    await expect(
      page.getByText('Protection des données personnelles (RGPD)', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("Conditions générales d'utilisation (CGU)", { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Communications commerciales', { exact: true })).toBeVisible()

    // Tuile « Détails » (ex-« Confidentialité »), présente et en dessous des consentements.
    const detailsHeading = page.getByRole('heading', { name: 'Détails' })
    await expect(detailsHeading).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Confidentialité', exact: true })).toHaveCount(
      0,
    )

    const consentsHeading = page.getByRole('heading', { name: 'Consentements RGPD / CGU' })
    const consentsBoundingBox = await consentsHeading.boundingBox()
    const detailsBoundingBox = await detailsHeading.boundingBox()
    expect(consentsBoundingBox).not.toBeNull()
    expect(detailsBoundingBox).not.toBeNull()
    // Les consentements sont affichés au-dessus (coordonnée Y plus petite) de la tuile « Détails ».
    expect(consentsBoundingBox!.y).toBeLessThan(detailsBoundingBox!.y)

    // Retrait réservé au consentement optionnel `marketing` — jamais rgpd/cgu (obligatoires).
    const rgpdRow = page
      .locator('article')
      .filter({ hasText: 'Protection des données personnelles (RGPD)' })
    const cguRow = page
      .locator('article')
      .filter({ hasText: "Conditions générales d'utilisation (CGU)" })
    const marketingRow = page
      .locator('article')
      .filter({ hasText: 'Communications commerciales' })

    await expect(rgpdRow.getByRole('button', { name: 'Retirer' })).toHaveCount(0)
    await expect(cguRow.getByRole('button', { name: 'Retirer' })).toHaveCount(0)
    await expect(rgpdRow.getByText('Non retirable')).toBeVisible()
    await expect(cguRow.getByText('Non retirable')).toBeVisible()

    await expect(marketingRow.getByRole('button', { name: 'Retirer' })).toBeVisible()
    await expect(marketingRow.getByText('Non retirable')).toHaveCount(0)

    await page.screenshot({
      path: 'test-results/proof-profile-confidentiality-tab.png',
      fullPage: true,
    })
  })
})
