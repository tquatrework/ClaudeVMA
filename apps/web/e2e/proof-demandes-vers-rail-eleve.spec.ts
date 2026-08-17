import { test, expect } from '@playwright/test'
import { createTestStudent } from './support/api'

const PASSWORD = 'E2eTest!2026'

/**
 * Preuve à la pile réelle du besoin « déplacer "Demandes" du menu du haut vers le
 * rail gauche élève » (`.claude/CURRENT-GOAL.md`, besoin du 2026-08-17).
 *
 * Vérifie, avec un compte élève créé via la route réelle d'inscription :
 *  1. le menu du haut ne comporte plus l'entrée « Demandes » ;
 *  2. le rail gauche comporte « Demandes professeurs », juste sous « Visio », et
 *     que ce lien pointe bien vers /teacher-requests (la route inchangée).
 */
test('le menu du haut élève ne montre plus "Demandes", le rail gauche affiche "Demandes professeurs" sous "Visio"', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const uniqueSuffix = Date.now().toString()

  const student = await createTestStudent(uniqueSuffix, 'Nadia', 'Menutest')

  // ── Connexion élève ──
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(student.loginIdentifier)
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  // ── Preuve 1 : le menu du haut ne comporte plus "Demandes" ──
  const topNav = page.getByRole('navigation').first()
  await expect(
    topNav.getByRole('link', { name: 'Demandes', exact: true }),
    'le menu du haut élève ne comporte plus de lien "Demandes"',
  ).toHaveCount(0)

  // ── Preuve 2 : le rail gauche comporte "Demandes professeurs" juste sous "Visio" ──
  const rail = page.getByRole('complementary')
  const railLinks = rail.getByRole('link')
  const visioLink = rail.getByRole('link', { name: 'Visio' })
  await expect(visioLink, 'le rail gauche élève comporte toujours "Visio"').toBeVisible()

  const demandesProfLink = rail.getByRole('link', { name: 'Demandes professeurs' })
  await expect(
    demandesProfLink,
    'le rail gauche élève comporte "Demandes professeurs"',
  ).toBeVisible()
  await expect(demandesProfLink).toHaveAttribute('href', '/teacher-requests')

  // Ordre : "Demandes professeurs" doit suivre immédiatement "Visio" dans le rail.
  const allLabels = (await railLinks.allTextContents()).map((label) => label.trim())
  const visioIndex = allLabels.findIndex((label) => label.endsWith('Visio'))
  const demandesIndex = allLabels.findIndex((label) => label.endsWith('Demandes professeurs'))
  expect(visioIndex, '"Visio" trouvé dans le rail').toBeGreaterThanOrEqual(0)
  expect(demandesIndex, '"Demandes professeurs" trouvé dans le rail').toBeGreaterThanOrEqual(0)
  expect(
    demandesIndex,
    '"Demandes professeurs" est positionné juste après "Visio" dans le rail',
  ).toBe(visioIndex + 1)

  await page.screenshot({ path: 'test-results/proof-menu-haut-sans-demandes.png', fullPage: true })

  console.log(
    `Preuve : élève ${student.loginIdentifier} — menu du haut sans "Demandes", ` +
      `rail gauche avec "Demandes professeurs" juste sous "Visio" (→ /teacher-requests).`,
  )
})
