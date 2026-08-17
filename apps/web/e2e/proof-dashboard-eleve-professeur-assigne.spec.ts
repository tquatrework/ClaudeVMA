import { test, expect } from '@playwright/test'

/**
 * Preuve à l'écran des 4 points du dashboard élève une fois un professeur assigné
 * (besoin du 2026-08-17, `.claude/CURRENT-GOAL.md`), jouée contre la pile réelle.
 *
 * L'élève, le formateur, sa photo et la relation élève↔formateur ont tous été créés
 * via les routes API réelles (inscription, envoi d'avatar, `POST /relations/teacher-student`
 * par le RP de test `trsflow.rp.0811`) avant ce test — voir la sortie de session pour le
 * détail des appels. Rien n'est injecté en base.
 */

const STUDENT_LOGIN_IDENTIFIER = 'dashproof.eleve.1786977219'
const STUDENT_PASSWORD = 'Visio!2026Flow'
const TEACHER_FULL_NAME = 'Antoine Dashprof'

test('dashboard élève avec professeur assigné : les 4 points demandés', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(STUDENT_LOGIN_IDENTIFIER)
  await page.getByPlaceholder('••••••••').fill(STUDENT_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page).toHaveURL(/\/dashboard/)

  // Point 1 — tuile « Mon professeur » : prénom + nom du professeur assigné.
  await expect(page.getByText(TEACHER_FULL_NAME)).toBeVisible()

  // Point 3 — « Demander un professeur » a disparu de la tuile « Mon professeur ».
  await expect(page.getByText('Vous n\'avez pas pour l\'instant de professeur attitré')).toBeHidden()
  await expect(page.getByRole('link', { name: 'Demander un professeur' })).toBeHidden()

  // Point 4 — « Changer de professeur » mène à /teacher-requests.
  const changeLink = page.getByRole('link', { name: 'Changer de professeur' })
  await expect(changeLink).toBeVisible()
  await expect(changeLink).toHaveAttribute('href', '/teacher-requests')

  // Point 2 — tuile « Prochain cours » vide : texte demandé + bouton désactivé, pas de
  // fausse route de contact.
  await expect(page.getByText('Vous n\'avez pas de prochain cours')).toBeVisible()
  const contactButton = page.getByRole('button', { name: 'Contacter mon professeur' })
  await expect(contactButton).toBeVisible()
  await expect(contactButton).toBeDisabled()

  await page.screenshot({
    path: 'test-results/proof-dashboard-eleve-professeur-assigne.png',
    fullPage: true,
  })
})
