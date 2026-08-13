import { test, expect } from '@playwright/test'
import { createTestStudent, createTestTeacher, loginAsRp, linkTeacherToStudent } from './support/api'
import { e2eEnv } from './support/env'

/**
 * Preuve à l'écran du flow « le RP met fin à une relation élève↔formateur »
 * (arbitrage du 2026-08-12, `docs/architecture.md`), jouée contre la pile
 * réelle — aucune requête n'est simulée.
 *
 * Reprend le scénario déjà validé en HTTP dans
 * `.claude/reports/preuve-fin-relation-eleve-professeur-2026-08-13.md`, cette
 * fois piloté depuis le navigateur : connexion RP, fiche de l'élève,
 * `LinkedTeachersPanel`, bouton « Mettre fin », confirmation dans
 * `TerminateTeacherRelationDialog`, disparition du formateur de l'écran.
 *
 * L'élève et le formateur sont des comptes créés à chaque exécution via les
 * routes d'inscription réelles (jamais de fixture injectée en base) — voir
 * `e2e/support/api.ts`. Le compte RP, lui, ne peut pas s'auto-inscrire
 * (rôle non ouvert à l'auto-inscription, IAM-FB-002) : il doit déjà exister,
 * voir `apps/web/e2e/README.md`.
 */

const STUDENT_FIRST_NAME = 'Camille'
const STUDENT_LAST_NAME = 'Berthier'
const TEACHER_FIRST_NAME = 'Julien'
const TEACHER_LAST_NAME = 'Mercier'

test('le RP met fin à une relation élève ↔ formateur depuis la fiche élève', async ({ page }) => {
  // ── Préparation : comptes réels + relation active, via les routes API réelles ──
  const uniqueSuffix = Date.now().toString()
  const student = await createTestStudent(uniqueSuffix, STUDENT_FIRST_NAME, STUDENT_LAST_NAME)
  const teacher = await createTestTeacher(uniqueSuffix, TEACHER_FIRST_NAME, TEACHER_LAST_NAME)
  const rpToken = await loginAsRp()
  await linkTeacherToStudent(rpToken, teacher.id, student.id)

  const teacherFullName = `${TEACHER_FIRST_NAME} ${TEACHER_LAST_NAME}`

  // ── Connexion RP à l'écran ──
  await page.goto('/login')
  // `LoginPage` n'associe pas `<label>` et `<input>` par `for`/`id` : on cible
  // les champs par leur `placeholder`, seul repère fiable disponible ici.
  await page.getByPlaceholder('jean.dupont').fill(e2eEnv.rpLoginIdentifier)
  await page.getByPlaceholder('••••••••').fill(e2eEnv.rpPassword)
  await page.getByRole('button', { name: 'Se connecter' }).click()

  // La connexion redirige un RP vers /dashboard (voir LoginPage.resolveRoleLandingPage).
  await expect(page).toHaveURL(/\/dashboard/)

  // ── Fiche de l'élève : le formateur est présent ──
  await page.goto(`/profiles/${student.id}`)
  await expect(page.getByRole('heading', { name: 'Formateurs liés' })).toBeVisible()
  await expect(page.getByRole('link', { name: teacherFullName })).toBeVisible()

  // ── Clic sur « Mettre fin » (bouton de ligne, nomme le formateur) ──
  await page.getByRole('button', { name: `Mettre fin ${teacherFullName}` }).click()

  // ── Confirmation dans TerminateTeacherRelationDialog ──
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(`Mettre fin à la relation avec ${teacherFullName} ?`)).toBeVisible()
  await dialog.getByRole('button', { name: 'Mettre fin', exact: true }).click()

  // ── Le formateur disparaît du panneau, sans rechargement de page ──
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('link', { name: teacherFullName })).toBeHidden()
  await expect(page.getByText('Aucun formateur lié')).toBeVisible()
})
