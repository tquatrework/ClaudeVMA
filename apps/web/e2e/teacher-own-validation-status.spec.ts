import { test, expect } from '@playwright/test'
import { createTestTeacher } from './support/api'

/**
 * Preuve à l'écran de l'arbitrage du 2026-08-13 (`docs/architecture.md` >
 * « Visibilité du statut de validation, côté formateur ») : un formateur
 * fraîchement inscrit — dossier `pending` côté profile-service — voit
 * désormais son propre statut, alors qu'il n'était jusqu'ici affiché nulle
 * part dans son parcours (seul `TeacherValidationPanel`, réservé au RP/TI,
 * l'affichait).
 *
 * Un compte formateur créé par `POST /accounts/teachers` (routes publiques
 * réelles, aucun mock) est `pending` dès la création (`docs/routes.md` >
 * « Validation des formateurs »). Ce scénario ne nécessite donc aucun compte
 * RP/TI : il prouve l'état `pending`/`in_review`, affiché « En attente de
 * validation ». L'état `rejected` (« Refusé — année AAAA ») nécessite qu'un
 * RP ou TI fasse transiter le dossier — hors de portée d'un compte de test
 * auto-inscrit, non couvert ici (voir le rapport de session pour le détail).
 */

const TEACHER_FIRST_NAME = 'Nadia'
const TEACHER_LAST_NAME = 'Lefebvre'

test('un formateur fraîchement inscrit voit son propre statut « en attente de validation »', async ({
  page,
}) => {
  const uniqueSuffix = Date.now().toString()
  const teacher = await createTestTeacher(uniqueSuffix, TEACHER_FIRST_NAME, TEACHER_LAST_NAME)

  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(teacher.loginIdentifier)
  await page.getByPlaceholder('••••••••').fill('E2eTest!2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page).toHaveURL(/\/dashboard/)

  // Bannière posée dans Layout.tsx, visible sur toutes les pages du formateur.
  await expect(
    page.getByText('Votre dossier formateur est en attente de validation par notre équipe pédagogique.'),
  ).toBeVisible()
})
