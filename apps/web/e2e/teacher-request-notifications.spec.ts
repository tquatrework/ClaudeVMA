import { test, expect } from '@playwright/test'
import {
  createTestStudentWithParent,
  createTestTeacher,
  login,
  loginAsRp,
  validateTeacher,
  createTeacherRequest,
  sendTeacherProposals,
  acceptProposal,
  validateTeacherRequest,
  getUnreadCount,
  listNotifications,
  markNotificationRead,
  waitForUnreadNotification,
} from './support/api'

/**
 * Preuve à la pile réelle du flow « demande de professeur » bout en bout et de son système de
 * notifications transversal (arbitrage du 2026-08-14, `docs/architecture.md`).
 *
 * Étapes attendues (point 8 de l'arbitrage) :
 *   1. Élève crée une demande            -> TeacherRequestCreated -> notif rôle RP
 *   2. RP envoie une proposition          -> TeacherProposalSent   -> notif au formateur
 *   3. Formateur accepte                  -> TeacherProposalAccepted -> notif rôle RP
 *   4. RP valide (crée l'affectation)     -> TeacherAssigned -> notif formateur + élève + parent
 *
 * Comptes réels créés à chaque exécution via les routes d'inscription publiques (élève + parent
 * financeur dans le même appel, formateur), plus le compte RP de test déjà existant sur la pile
 * (`trsflow.rp.0811`, créé le 2026-08-11 pour un relevé antérieur — voir
 * `.claude/reports/teacher-request-service-flow-2026-08-11.md` — et revérifié fonctionnel le
 * 2026-08-17 avant ce test).
 *
 * Assertions volontairement `expect.soft()` sur les vérifications de notification : le but de ce
 * test est d'obtenir une preuve complète, étape par étape, même quand une étape intermédiaire
 * échoue — un `expect` dur y stopperait le test au premier échec et masquerait l'état des étapes
 * suivantes. Le test reste rouge si au moins un `expect.soft` a échoué (comportement Playwright
 * par défaut), mais chaque étape est réellement rejouée et journalisée.
 */

const STUDENT_FIRST_NAME = 'Camille'
const STUDENT_LAST_NAME = 'Notiftest'
const PARENT_FIRST_NAME = 'Paula'
const PARENT_LAST_NAME = 'Notiftest'
const TEACHER_FIRST_NAME = 'Julien'
const TEACHER_LAST_NAME = 'Notifprof'
const PASSWORD = 'E2eTest!2026'

test.describe('flow demande de professeur — notifications', () => {
  test('chaque étape du flow notifie le bon destinataire, avec noms en clair et compteur exact', async ({
    page,
  }) => {
    // Plusieurs étapes attendent jusqu'à 20s une notification asynchrone (consommateur Redis) ;
    // le timeout par défaut de 60s de playwright.config.ts est insuffisant pour les 4 étapes
    // combinées plus la partie navigateur.
    test.setTimeout(180_000)

    const uniqueSuffix = Date.now().toString()

    // ── Préparation : comptes réels ──
    const { student, parent } = await createTestStudentWithParent(
      uniqueSuffix,
      STUDENT_FIRST_NAME,
      STUDENT_LAST_NAME,
      PARENT_FIRST_NAME,
      PARENT_LAST_NAME,
    )
    const teacher = await createTestTeacher(uniqueSuffix, TEACHER_FIRST_NAME, TEACHER_LAST_NAME)

    const rpToken = await loginAsRp()
    await validateTeacher(rpToken, teacher.id)

    const studentLoginRes = await login(student.loginIdentifier, PASSWORD)
    expect(studentLoginRes.status, 'connexion élève').toBe(201)
    const studentToken = studentLoginRes.body.access_token

    const teacherLoginRes = await login(teacher.loginIdentifier, PASSWORD)
    expect(teacherLoginRes.status, 'connexion formateur').toBe(201)
    const teacherToken = teacherLoginRes.body.access_token

    const parentLoginRes = await login(parent.loginIdentifier, PASSWORD)
    expect(parentLoginRes.status, 'connexion parent').toBe(201)
    const parentToken = parentLoginRes.body.access_token

    // ══════════════════════════════════════════════════════════════════
    // Étape 1 — l'élève crée une demande -> notif attendue au rôle RP
    // ══════════════════════════════════════════════════════════════════
    let requestId = ''
    await test.step('1. Élève crée une demande de professeur', async () => {
      const rpUnreadBefore = await getUnreadCount(rpToken)

      const createRes = await createTeacherRequest(
        studentToken,
        'Recherche un professeur de mathématiques niveau terminale pour préparer le bac.',
      )
      console.log(`POST /requests -> ${createRes.status} ${JSON.stringify(createRes.body)}`)
      expect(createRes.status, 'création de la demande').toBe(201)
      requestId = createRes.body.id

      const arrivedAfterSeconds = await waitForUnreadNotification(rpToken)
      console.log(
        `RP unread-count avant=${rpUnreadBefore.body.count}, notification TeacherRequestCreated ` +
          `arrivée après ${arrivedAfterSeconds}s (-1 = jamais arrivée dans le délai imparti)`,
      )
      expect
        .soft(
          arrivedAfterSeconds,
          'le RP doit recevoir une notification TeacherRequestCreated (notif par rôle)',
        )
        .toBeGreaterThan(-1)
    })

    // ══════════════════════════════════════════════════════════════════
    // Étape 2 — le RP envoie une proposition -> notif attendue au formateur
    // ══════════════════════════════════════════════════════════════════
    let proposalId = ''
    await test.step('2. RP envoie une proposition au formateur validé', async () => {
      const teacherUnreadBefore = await getUnreadCount(teacherToken)

      const proposalRes = await sendTeacherProposals(
        rpToken,
        requestId,
        [teacher.id],
        'Bonjour, seriez-vous disponible pour accompagner cet élève en mathématiques niveau terminale ?',
      )
      console.log(
        `POST /requests/${requestId}/proposals -> ${proposalRes.status} ${JSON.stringify(proposalRes.body)}`,
      )
      expect(proposalRes.status, 'envoi de la proposition').toBe(201)
      proposalId = proposalRes.body[0].id

      const arrivedAfterSeconds = await waitForUnreadNotification(teacherToken)
      console.log(
        `Formateur unread-count avant=${teacherUnreadBefore.body.count}, notification ` +
          `TeacherProposalSent arrivée après ${arrivedAfterSeconds}s`,
      )
      expect
        .soft(arrivedAfterSeconds, 'le formateur doit recevoir une notification TeacherProposalSent')
        .toBeGreaterThan(-1)

      const teacherNotifs = await listNotifications(teacherToken)
      const proposalNotif = teacherNotifs.body.data.find((n) => n.type === 'teacher_proposal_sent')
      expect.soft(proposalNotif, 'notification teacher_proposal_sent présente').toBeTruthy()
      // Aucun UUID affiché : le nom de l'élève doit être en clair dans les métadonnées.
      if (proposalNotif) {
        expect.soft(proposalNotif.metadata.studentName).toBe(`${STUDENT_FIRST_NAME} ${STUDENT_LAST_NAME}`)
      }
    })

    // ══════════════════════════════════════════════════════════════════
    // Étape 3 — le formateur accepte -> notif attendue au rôle RP
    // ══════════════════════════════════════════════════════════════════
    await test.step('3. Formateur accepte la proposition', async () => {
      const rpUnreadBefore = await getUnreadCount(rpToken)

      const acceptRes = await acceptProposal(teacherToken, proposalId)
      console.log(
        `POST /proposals/${proposalId}/accept -> ${acceptRes.status} ${JSON.stringify(acceptRes.body)}`,
      )
      expect(acceptRes.status, 'acceptation de la proposition').toBe(201)

      const arrivedAfterSeconds = await waitForUnreadNotification(rpToken)
      console.log(
        `RP unread-count avant=${rpUnreadBefore.body.count}, notification TeacherProposalAccepted ` +
          `arrivée après ${arrivedAfterSeconds}s`,
      )
      expect
        .soft(
          arrivedAfterSeconds,
          'le RP doit recevoir une notification TeacherProposalAccepted (notif par rôle)',
        )
        .toBeGreaterThan(-1)
    })

    // ══════════════════════════════════════════════════════════════════
    // Étape 4 — le RP valide -> notif au formateur, à l'élève et au parent financeur
    // ══════════════════════════════════════════════════════════════════
    await test.step("4. RP valide — crée l'affectation", async () => {
      const [teacherBefore, studentBefore, parentBefore] = await Promise.all([
        getUnreadCount(teacherToken),
        getUnreadCount(studentToken),
        getUnreadCount(parentToken),
      ])

      const validateRes = await validateTeacherRequest(rpToken, requestId, proposalId, true)
      console.log(
        `POST /requests/${requestId}/validate -> ${validateRes.status} ${JSON.stringify(validateRes.body)}`,
      )
      expect(validateRes.status, 'validation RP').toBe(201)
      expect.soft(validateRes.body.status).toBe('closed')
      expect.soft(validateRes.body.chosenTeacherId).toBe(teacher.id)

      const [teacherArrived, studentArrived, parentArrived] = await Promise.all([
        waitForUnreadNotification(teacherToken),
        waitForUnreadNotification(studentToken),
        waitForUnreadNotification(parentToken),
      ])
      console.log(
        `TeacherAssigned — formateur: avant=${teacherBefore.body.count} arrivée après ${teacherArrived}s ; ` +
          `élève: avant=${studentBefore.body.count} arrivée après ${studentArrived}s ; ` +
          `parent: avant=${parentBefore.body.count} arrivée après ${parentArrived}s`,
      )
      expect.soft(teacherArrived, 'le formateur doit recevoir TeacherAssigned').toBeGreaterThan(-1)
      expect.soft(studentArrived, "l'élève doit recevoir TeacherAssigned").toBeGreaterThan(-1)
      expect.soft(parentArrived, 'le parent financeur doit recevoir TeacherAssigned').toBeGreaterThan(-1)

      // Vérification du contenu : noms en clair (jamais un UUID affiché), pour au moins un
      // destinataire (l'élève).
      const studentNotifs = await listNotifications(studentToken)
      const assignedNotif = studentNotifs.body.data.find((n) => n.type === 'teacher_assigned')
      expect.soft(assignedNotif, 'notification teacher_assigned côté élève').toBeTruthy()
      if (assignedNotif) {
        expect.soft(assignedNotif.metadata.teacherName).toBe(`${TEACHER_FIRST_NAME} ${TEACHER_LAST_NAME}`)
        expect.soft(assignedNotif.metadata.studentName).toBe(`${STUDENT_FIRST_NAME} ${STUDENT_LAST_NAME}`)
      } else {
        console.log('Impossible de vérifier le contenu : aucune notification teacher_assigned trouvée côté élève.')
      }
    })

    // ══════════════════════════════════════════════════════════════════
    // Preuve à l'écran — la cloche du header, AVANT le marquage lu (badge attendu), pour l'élève
    // qui vient de recevoir TeacherAssigned
    // ══════════════════════════════════════════════════════════════════
    let assignedNotificationId: string | undefined
    await test.step('5. Capture écran AVANT marquage lu', async () => {
      await page.goto('/login')
      await page.getByPlaceholder('jean.dupont').fill(student.loginIdentifier)
      await page.getByPlaceholder('••••••••').fill(PASSWORD)
      await page.getByRole('button', { name: 'Se connecter' }).click()
      await expect(page).toHaveURL(/\/dashboard/)

      const unreadBefore = await getUnreadCount(studentToken)
      console.log(`Compteur backend AVANT marquage lu (capture écran) : ${unreadBefore.body.count}`)

      await page.screenshot({
        path: 'test-results/notification-bell-before-read.png',
        fullPage: false,
      })

      // La cloche est rendue tantôt en `<Link>` (desktop), tantôt en `<button>` (rail mobile de
      // `MobileRailDrawer`) selon la largeur de viewport : ciblée par `aria-label` plutôt que par
      // rôle, pour couvrir les deux rendus.
      // L'aria-label est dynamique (« Notifications » sans non-lues, « Notifications, N non lues »
      // sinon) : ciblé par préfixe plutôt que par égalité stricte.
      const bellLink = page.locator('[aria-label^="Notifications"]')
      await expect.soft(bellLink, 'cloche visible dans le header').toBeVisible()

      // Preuve attendue par l'arbitrage du 2026-08-14 (point 10) : un compteur de non-lues
      // visible près de la cloche, reflétant les notifications réelles créées ci-dessus.
      if (unreadBefore.body.count > 0) {
        await expect
          .soft(
            bellLink.getByText(String(unreadBefore.body.count)),
            'badge de compteur non-lu visible sur la cloche AVANT lecture',
          )
          .toBeVisible({ timeout: 5000 })
          .catch((error) => console.log('Badge non trouvé sur la cloche (avant) :', error.message))
      }

      await page.goto('/notifications')
      await page.screenshot({ path: 'test-results/notifications-page-before-read.png', fullPage: true })

      const studentNotifs = await listNotifications(studentToken)
      assignedNotificationId = studentNotifs.body.data.find((n) => n.type === 'teacher_assigned')?.id
    })

    // ══════════════════════════════════════════════════════════════════
    // Marquage lu, puis capture écran APRÈS — le badge doit disparaître / décroître
    // ══════════════════════════════════════════════════════════════════
    await test.step('6. Marquage lu puis capture écran APRÈS', async () => {
      if (!assignedNotificationId) {
        console.log('Aucune notification à marquer comme lue — étape ignorée.')
        return
      }
      const unreadBeforeRead = await getUnreadCount(studentToken)
      const readRes = await markNotificationRead(studentToken, assignedNotificationId)
      console.log(`POST /notifications/${assignedNotificationId}/read -> ${readRes.status}`)
      expect.soft(readRes.status, 'marquage lu').toBe(200)
      expect.soft(readRes.body.isRead).toBe(true)
      const unreadAfterRead = await getUnreadCount(studentToken)
      console.log(
        `Élève unread-count avant marquage lu=${unreadBeforeRead.body.count}, ` +
          `après=${unreadAfterRead.body.count}`,
      )
      expect.soft(unreadAfterRead.body.count).toBe(unreadBeforeRead.body.count - 1)

      await page.reload()
      await page.screenshot({
        path: 'test-results/notification-bell-after-read.png',
        fullPage: false,
      })
      await page.goto('/notifications')
      await page.screenshot({ path: 'test-results/notifications-page-after-read.png', fullPage: true })
    })

    // ══════════════════════════════════════════════════════════════════
    // Preuve à l'écran côté RP — les deux notifications par rôle corrigées le 2026-08-17
    // (TeacherRequestCreated, TeacherProposalAccepted). Contexte de navigateur séparé : la page
    // principale reste connectée en élève.
    // ══════════════════════════════════════════════════════════════════
    await test.step('7. Capture écran côté RP (notifications par rôle)', async () => {
      const rpContext = await page.context().browser()!.newContext()
      const rpPage = await rpContext.newPage()
      try {
        await rpPage.goto('/login')
        await rpPage.getByPlaceholder('jean.dupont').fill('trsflow.rp.0811')
        await rpPage.getByPlaceholder('••••••••').fill('Visio!2026Flow')
        await rpPage.getByRole('button', { name: 'Se connecter' }).click()
        await expect(rpPage).toHaveURL(/\/dashboard/)

        const rpUnreadBefore = await getUnreadCount(rpToken)
        console.log(`RP unread-count AVANT capture écran : ${rpUnreadBefore.body.count}`)

        await rpPage.screenshot({
          path: 'test-results/notification-bell-rp-before-read.png',
          fullPage: false,
        })
        await rpPage.goto('/notifications')
        await rpPage.screenshot({
          path: 'test-results/notifications-page-rp-before-read.png',
          fullPage: true,
        })

        const rpNotifs = await listNotifications(rpToken)
        const roleNotifIds = rpNotifs.body.data
          .filter((n) => n.type === 'teacher_request_created' || n.type === 'teacher_proposal_accepted')
          .map((n) => n.id)
        console.log(`Notifications RP par rôle trouvées : ${JSON.stringify(roleNotifIds)}`)
        for (const notifId of roleNotifIds) {
          const readRes = await markNotificationRead(rpToken, notifId)
          console.log(`POST /notifications/${notifId}/read -> ${readRes.status}`)
        }

        const rpUnreadAfter = await getUnreadCount(rpToken)
        console.log(`RP unread-count APRÈS marquage lu : ${rpUnreadAfter.body.count}`)

        await rpPage.reload()
        await rpPage.screenshot({
          path: 'test-results/notification-bell-rp-after-read.png',
          fullPage: false,
        })
        await rpPage.goto('/notifications')
        await rpPage.screenshot({
          path: 'test-results/notifications-page-rp-after-read.png',
          fullPage: true,
        })
      } finally {
        await rpContext.close()
      }
    })
  })
})
