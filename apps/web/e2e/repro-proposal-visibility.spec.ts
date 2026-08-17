import { test, expect } from '@playwright/test'
import {
  createTestTeacher,
  loginAsRp,
  validateTeacher,
  createTestStudentWithParent,
  login,
  createTeacherRequest,
  sendTeacherProposals,
} from './support/api'

const PASSWORD = 'E2eTest!2026'

/**
 * Preuve à la pile réelle du correctif « le formateur ne trouve pas où gérer une
 * proposition reçue » (`.claude/CURRENT-GOAL.md`, besoin du 2026-08-17).
 *
 * Constat avant correctif : l'écran `/teacher-requests` existait déjà avec les actions
 * accepter/refuser (rail gauche « Propositions reçues », livré avec le flow PR #100), et une
 * exploration à froid (compte de test jamais connecté) le trouvait sans peine. Le vrai trou
 * était ailleurs : cliquer sur la notification de la cloche ne faisait que la marquer lue,
 * sans emmener l'utilisateur vers l'écran concerné — c'est ce que ce test prouve corrigé.
 */
test('cliquer sur la notification "proposition envoyée" emmène le formateur sur sa boîte de réception', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const uniqueSuffix = Date.now().toString()

  const { student } = await createTestStudentWithParent(
    uniqueSuffix,
    'Camille',
    'Reprotest',
    'Paula',
    'Reprotest',
  )
  const teacher = await createTestTeacher(uniqueSuffix, 'Julien', 'Reprotest')

  const rpToken = await loginAsRp()
  await validateTeacher(rpToken, teacher.id)

  const studentLoginRes = await login(student.loginIdentifier, PASSWORD)
  expect(studentLoginRes.status, 'connexion élève').toBe(201)
  const studentToken = studentLoginRes.body.access_token

  const createRes = await createTeacherRequest(
    studentToken,
    'Recherche un professeur de mathématiques niveau sixième.',
  )
  console.log(`POST /requests -> ${createRes.status} ${JSON.stringify(createRes.body)}`)
  expect(createRes.status, 'création de la demande').toBe(201)
  const requestId = createRes.body.id

  const proposalRes = await sendTeacherProposals(
    rpToken,
    requestId,
    [teacher.id],
    'Bonjour, seriez-vous disponible pour ce cours ?',
  )
  console.log(
    `POST /requests/${requestId}/proposals -> ${proposalRes.status} ${JSON.stringify(proposalRes.body)}`,
  )
  expect(proposalRes.status, 'envoi de la proposition').toBe(201)

  // ── Connexion formateur ──
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(teacher.loginIdentifier)
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  // ── Ouvre la cloche, clique la notification reçue ──
  const bellLink = page.locator('[aria-label^="Notifications"]')
  await expect(bellLink, 'cloche visible dans le header').toBeVisible()
  await bellLink.click()

  // `getByText` seul matche aussi l'aperçu identique dans « Activité récente » du dashboard
  // rendu derrière le menu déroulant : on cible spécifiquement la ligne cliquable de la
  // cloche, rendue comme un `<button>` (voir `NotificationBell.tsx`).
  const notificationRow = page.getByRole('button', {
    name: /Nouvelle proposition de professeur pour Camille Reprotest/,
  })
  await expect(notificationRow, 'notification "proposition envoyée" visible dans le menu').toBeVisible()
  await page.screenshot({ path: 'test-results/proof-1-notification-menu-open.png', fullPage: true })

  await notificationRow.click()

  // ── C'est le cœur de la preuve : le clic doit emmener sur /teacher-requests ──
  await expect(page, 'le clic sur la notification navigue vers /teacher-requests').toHaveURL(
    /\/teacher-requests$/,
    { timeout: 10_000 },
  )
  await page.screenshot({ path: 'test-results/proof-2-teacher-requests-after-click.png', fullPage: true })

  // ── Et sur cet écran, les actions accepter/refuser sont bien présentes ──
  const acceptButton = page.getByRole('button', { name: /Me porter candidat/i })
  await expect(acceptButton, 'bouton "Me porter candidat" visible après navigation').toBeVisible()
  const declineButton = page.getByRole('button', { name: /Décliner/i })
  await expect(declineButton, 'bouton "Décliner" visible après navigation').toBeVisible()

  console.log(
    `Preuve : notification cliquée -> URL ${page.url()} -> boutons accepter/refuser présents pour ${teacher.loginIdentifier}.`,
  )
})
