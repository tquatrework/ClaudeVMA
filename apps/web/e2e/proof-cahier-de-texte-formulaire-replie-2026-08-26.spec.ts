import { test, expect, type Page } from '@playwright/test'
import { createTestStudentWithParent, createTestTeacher, login } from './support/api'
import { createTeacherStudentRelationViaInternalRoute } from './support/internalRelation'

/**
 * Preuve à l'écran du correctif « formulaire du cahier de texte replié par défaut »
 * (branche `fix/cahier-de-texte-formulaire-replie`, PR #133), jouée contre la pile réelle
 * (`https://claudevma.visioprof.fr`) — aucune requête n'est simulée.
 *
 * Demande initiale (`.claude/CURRENT-GOAL.md`) : sur `/pedagogical-log` (vue formateur), le
 * formulaire de saisie s'affichait immédiatement au chargement, poussant la liste des entrées
 * hors écran. Le correctif remplace l'affichage immédiat par un bouton « Nouvelle entrée » ; la
 * liste doit être visible par défaut, le formulaire doit s'ouvrir au clic.
 */

const PASSWORD = 'E2eTest!2026'

async function loginOnScreen(page: Page, loginIdentifier: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(loginIdentifier)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
}

test.describe('Cahier de texte — formulaire replié par défaut (2026-08-26)', () => {
  test('liste visible au chargement, bouton "Nouvelle entrée", formulaire au clic', async ({ page }) => {
    test.setTimeout(120_000)

    const uniqueSuffix = Date.now().toString()
    const { student } = await createTestStudentWithParent(
      uniqueSuffix,
      'Léa',
      `CahierRepliEleve${uniqueSuffix}`,
      'Paul',
      `CahierRepliParent${uniqueSuffix}`,
    )
    const teacher = await createTestTeacher(uniqueSuffix, 'Sami', `CahierRepliProf${uniqueSuffix}`)

    const relationResult = createTeacherStudentRelationViaInternalRoute(teacher.id, student.id, true)
    expect([200, 201], 'création de la relation TEACHER_OF_STUDENT').toContain(relationResult.status)

    const teacherToken = (await login(teacher.loginIdentifier, PASSWORD)).body.access_token
    // Deux entrées existantes, pour que la preuve "liste visible sans défilement" soit parlante.
    await fetch('https://claudevma.visioprof.fr/api/v1/students/' + student.id + '/pedagogical-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ date: '2026-08-20', sessionSummary: 'Séance du 20 août', visibility: 'formateur_rp' }),
    })
    await fetch('https://claudevma.visioprof.fr/api/v1/students/' + student.id + '/pedagogical-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ date: '2026-08-22', sessionSummary: 'Séance du 22 août', visibility: 'formateur_rp' }),
    })

    await loginOnScreen(page, teacher.loginIdentifier, PASSWORD)
    await page.goto('/pedagogical-log')

    // 1. Au chargement : la liste est visible, le formulaire est ABSENT du DOM.
    await expect(page.getByText('Séance du 22 août')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Séance du 20 août')).toBeVisible()
    await expect(page.locator('#log-visibility-select'), 'formulaire absent au chargement').toHaveCount(0)

    const newEntryButton = page.getByRole('button', { name: 'Nouvelle entrée' })
    await expect(newEntryButton, 'bouton "Nouvelle entrée" visible').toBeVisible()

    await page.screenshot({
      path: 'test-results/formulaire-replie-01-liste-visible-bouton.png',
      fullPage: true,
    })

    // 2. Clic sur le bouton -> le formulaire apparaît.
    await newEntryButton.click()
    await expect(page.locator('#log-visibility-select'), 'formulaire visible après clic').toBeVisible()
    await expect(newEntryButton, 'bouton disparu une fois le formulaire ouvert').toHaveCount(0)

    await page.screenshot({
      path: 'test-results/formulaire-replie-02-formulaire-ouvert.png',
      fullPage: true,
    })
  })
})
