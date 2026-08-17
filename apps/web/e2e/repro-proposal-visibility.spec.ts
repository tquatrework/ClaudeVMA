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

test('reproduction — le formateur retrouve-t-il sa proposition en attente ?', async ({ page }) => {
  test.setTimeout(120_000)
  const uniqueSuffix = Date.now().toString()

  const { student } = await createTestStudentWithParent(
    uniqueSuffix, 'Camille', 'Reprotest', 'Paula', 'Reprotest',
  )
  const teacher = await createTestTeacher(uniqueSuffix, 'Julien', 'Reprotest')

  const rpToken = await loginAsRp()
  await validateTeacher(rpToken, teacher.id)

  const studentLoginRes = await login(student.loginIdentifier, PASSWORD)
  expect(studentLoginRes.status).toBe(201)
  const studentToken = studentLoginRes.body.access_token

  const createRes = await createTeacherRequest(
    studentToken,
    'Recherche un professeur de mathématiques niveau sixième.',
  )
  console.log(`POST /requests -> ${createRes.status} ${JSON.stringify(createRes.body)}`)
  expect(createRes.status).toBe(201)
  const requestId = createRes.body.id

  const proposalRes = await sendTeacherProposals(
    rpToken, requestId, [teacher.id],
    'Bonjour, seriez-vous disponible pour ce cours ?',
  )
  console.log(`POST /requests/${requestId}/proposals -> ${proposalRes.status} ${JSON.stringify(proposalRes.body)}`)
  expect(proposalRes.status).toBe(201)

  console.log(`Compte formateur de test : ${teacher.loginIdentifier} / ${PASSWORD}`)

  // ── Connexion formateur, exploration écran ──
  await page.goto('/login')
  await page.getByPlaceholder('jean.dupont').fill(teacher.loginIdentifier)
  await page.getByPlaceholder('••••••••').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await page.screenshot({ path: 'test-results/repro-1-dashboard.png', fullPage: true })

  // Cloche notifications
  const bellLink = page.locator('[aria-label^="Notifications"]')
  console.log('cloche visible ?', await bellLink.isVisible().catch(() => false))
  if (await bellLink.isVisible().catch(() => false)) {
    await bellLink.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/repro-2-notif-menu.png', fullPage: true })
    const bodyText = await page.textContent('body')
    console.log('Texte visible après clic cloche (extrait) :', bodyText?.slice(0, 2000))
  }

  await page.goto('/notifications')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/repro-3-notifications-page.png', fullPage: true })

  const proposalNotifText = page.getByText(/proposition|professeur/i).first()
  console.log('notif proposal visible sur /notifications ?', await proposalNotifText.isVisible().catch(() => false))

  // Rail gauche — chercher "Propositions reçues"
  await page.goto('/dashboard')
  await page.waitForTimeout(500)
  const railLink = page.getByText('Propositions reçues')
  console.log('lien rail "Propositions reçues" visible sur dashboard ?', await railLink.isVisible().catch(() => false))
  await page.screenshot({ path: 'test-results/repro-4-dashboard-rail.png', fullPage: true })

  // Aller directement sur /teacher-requests
  await page.goto('/teacher-requests')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'test-results/repro-5-teacher-requests-page.png', fullPage: true })
  const acceptButton = page.getByRole('button', { name: /candidat/i })
  console.log('bouton "Me porter candidat" visible sur /teacher-requests ?', await acceptButton.isVisible().catch(() => false))
})
