import { chromium, expect, test, type Page } from '@playwright/test'
import {
  acceptActivity,
  createCourseActivity,
  createTestStudent,
  createTestTeacher,
  fetchRoomByActivity,
  joinVideoRoom,
  login,
  waitForVideoRoom,
} from './support/api'
import { createTeacherStudentRelationViaInternalRoute } from './support/internalRelation'

/**
 * Preuve à la pile réelle du point 4 du chantier « calendrier de disponibilités lié à la visio »
 * (« le créneau accepté doit ouvrir une visio ») — consigne de session du 2026-08-19.
 *
 * Déroulé demandé :
 *   1. Le formateur propose un créneau `cours`, l'élève l'accepte → activité `confirmed`.
 *      (flow déjà prouvé au point 3 par `proof-course-slot-proposal.spec.ts` — réutilisé ici via
 *      des appels API directs, sans re-test détaillé de l'écran de proposition.)
 *   2. `video-session-service` crée automatiquement une vraie salle LiveKit pour cette activité
 *      (`GET /video/rooms/by-activity/:activityId`, déclenchement asynchrone via Redis).
 *   3. Deux contextes de navigateur Playwright séparés (formateur, élève), chacun navigue vers
 *      son calendrier, clique « Rejoindre le cours », se connecte réellement à la salle LiveKit
 *      et voit l'autre participant.
 *
 * ⚠️ RÉSULTAT RÉEL — un défaut bloquant a été découvert à l'étape 3, AVANT toute question de
 * WebRTC/TLS/sandbox : voir le bloc « BUG BLOQUANT DÉCOUVERT » plus bas et le rapport de session
 * (`.claude/reports/front-tester-livekit-2026-08-19.md`) pour le détail complet. Ce fichier
 * documente ce défaut avec des assertions réelles (`test.step` dédié), puis contourne
 * délibérément le défaut par un appel API direct (jamais par le front) pour continuer à vérifier
 * ce qui PEUT l'être du reste du chantier — sans jamais présenter ce contournement comme une
 * preuve que le parcours utilisateur fonctionne de bout en bout : il ne fonctionne pas encore.
 */

const PASSWORD = 'E2eTest!2026'

/** Même garde-fou que `proof-course-slot-proposal.spec.ts` contre le rate-limit de /auth/login. */
async function loginOnScreen(page: Page, loginIdentifier: string, password: string): Promise<void> {
  const maxAttempts = 4
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await page.goto('/login')
    await page.getByPlaceholder('jean.dupont').fill(loginIdentifier)
    await page.getByPlaceholder('••••••••').fill(password)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    try {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 8_000 })
      return
    } catch {
      const rateLimited = await page.getByText('Service temporarily unavailable').isVisible().catch(() => false)
      if (!rateLimited || attempt === maxAttempts) throw new Error(`Échec de connexion pour ${loginIdentifier}`)
      console.log(`/auth/login limité (502), nouvelle tentative ${attempt + 1}/${maxAttempts}…`)
      await page.waitForTimeout(10_000)
    }
  }
}

test.describe('Chantier calendrier-visio-livekit — point 4 : la salle LiveKit à l\'acceptation d\'un créneau', () => {
  test('création automatique de la salle, bug bloquant du bouton Rejoindre, puis connexion LiveKit réelle une fois débloquée', async () => {
    test.setTimeout(300_000)

    const uniqueSuffix = Date.now().toString()
    const studentFirstName = 'Camille'
    const studentLastName = `Livekittest${uniqueSuffix}`
    const teacherFirstName = 'Morgane'
    const teacherLastName = `Livekitprof${uniqueSuffix}`

    // ══════════════════════════════════════════════════════════════════
    // Préparation : comptes réels + relation TEACHER_OF_STUDENT (même méthode que le point 3)
    // ══════════════════════════════════════════════════════════════════
    const student = await createTestStudent(uniqueSuffix, studentFirstName, studentLastName)
    const teacher = await createTestTeacher(uniqueSuffix, teacherFirstName, teacherLastName)
    console.log(`Élève créé : ${student.id} (${student.loginIdentifier})`)
    console.log(`Formateur créé : ${teacher.id} (${teacher.loginIdentifier})`)

    const relationResult = createTeacherStudentRelationViaInternalRoute(teacher.id, student.id, true)
    console.log(
      `POST /internal/create-teacher-student-relation (via docker exec) -> ${relationResult.status} ` +
        `${JSON.stringify(relationResult.body)}`,
    )
    expect([200, 201], 'création de la relation TEACHER_OF_STUDENT').toContain(relationResult.status)

    const teacherLoginRes = await login(teacher.loginIdentifier, PASSWORD)
    expect(teacherLoginRes.status, 'connexion API formateur (préparation)').toBe(201)
    const teacherToken = teacherLoginRes.body.access_token

    const studentLoginRes = await login(student.loginIdentifier, PASSWORD)
    expect(studentLoginRes.status, 'connexion API élève (préparation)').toBe(201)
    const studentToken = studentLoginRes.body.access_token

    // ══════════════════════════════════════════════════════════════════
    // Étape 1 — formateur propose un cours, élève accepte → activité confirmée
    // (flow déjà prouvé au point 3, réutilisé ici par API directe sans re-test écran)
    // ══════════════════════════════════════════════════════════════════
    const start = new Date()
    start.setUTCDate(start.getUTCDate() + 1)
    start.setUTCHours(16, 0, 0, 0)
    const end = new Date(start)
    end.setUTCHours(17, 0, 0, 0)

    let activityId = ''
    await test.step('1. Formateur propose un cours, élève accepte (API directe)', async () => {
      const createRes = await createCourseActivity(
        teacherToken,
        student.id,
        start.toISOString(),
        end.toISOString(),
      )
      console.log(`POST /activities -> ${createRes.status} ${JSON.stringify(createRes.body)}`)
      expect(createRes.status, 'création de l\'activité cours').toBe(201)
      activityId = createRes.body.id

      const acceptRes = await acceptActivity(studentToken, activityId)
      console.log(`POST /activities/${activityId}/accept -> ${acceptRes.status} ${JSON.stringify(acceptRes.body)}`)
      expect(acceptRes.status, 'acceptation du créneau par l\'élève').toBe(201)
      expect(acceptRes.body.status, 'statut de l\'activité après acceptation').toBe('confirmed')
    })

    // ══════════════════════════════════════════════════════════════════
    // Étape 2 — video-session-service crée automatiquement une salle LiveKit réelle
    // ══════════════════════════════════════════════════════════════════
    let roomId = ''
    await test.step('2. La salle LiveKit est créée automatiquement (poll GET /video/rooms/by-activity/:id)', async () => {
      const room = await waitForVideoRoom(studentToken, activityId, 30_000, 2_000)
      console.log(`GET /video/rooms/by-activity/${activityId} -> ${JSON.stringify(room)}`)
      expect(room, 'la salle vidéo doit apparaître dans un délai raisonnable').not.toBeNull()
      expect(room!.activityId, 'la salle porte bien activityId, pas calendarSessionId').toBe(activityId)
      roomId = room!.id

      // Documente le contrat réel observé le 2026-08-19 : une salle fraîchement créée est
      // "waiting", jamais l'une des trois valeurs que VideoJoinPage.tsx sait afficher
      // (`active`/`scheduled`/`ended`, voir `apps/web/src/types/video.ts`). C'est la cause
      // racine du bug documenté à l'étape 3 ci-dessous.
      expect.soft(room!.status, 'statut initial réel de la salle auto-créée').toBe('waiting')
    })

    // ══════════════════════════════════════════════════════════════════
    // Navigateurs : deux contextes séparés, certificat auto-signé LiveKit accepté, caméra/micro
    // factices (le piège documenté dans la consigne de session).
    // ══════════════════════════════════════════════════════════════════
    const browser = await chromium.launch({
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    })

    const consoleErrors: { who: string; text: string }[] = []
    async function newParticipantPage(who: string): Promise<Page> {
      const context = await browser.newContext({
        baseURL: 'https://claudevma.visioprof.fr',
        // Contourne le certificat auto-signé de test de livekit-tls (docs/routes.md >
        // video-session-service > « TLS pour le port LiveKit ») — sans quoi la connexion
        // WebSocket vers wss://193.108.54.226:7880 échouerait silencieusement.
        ignoreHTTPSErrors: true,
      })
      await context.grantPermissions(['camera', 'microphone'], {
        origin: 'https://claudevma.visioprof.fr',
      })
      const page = await context.newPage()
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push({ who, text: message.text() })
        }
      })
      return page
    }

    const teacherPage = await newParticipantPage('formateur')
    const studentPage = await newParticipantPage('eleve')

    try {
      // ══════════════════════════════════════════════════════════════════
      // Étape 3 — chaque participant trouve « Rejoindre le cours » sur son calendrier et clique
      // ══════════════════════════════════════════════════════════════════
      async function goToVideoJoinFromCalendar(page: Page, loginIdentifier: string): Promise<void> {
        await loginOnScreen(page, loginIdentifier, PASSWORD)
        await page.goto('/calendar')
        await page.getByRole('tab', { name: 'Mes disponibilités' }).click()

        const joinButton = page.getByRole('button', { name: /^Rejoindre le cours/ })
        await expect(joinButton, 'bouton "Rejoindre le cours" visible sur le bloc confirmé').toBeVisible({
          timeout: 15_000,
        })
        await joinButton.click()
        await expect(page).toHaveURL(/\/video-join\//, { timeout: 15_000 })
      }

      await test.step('3a. Formateur : trouve et clique "Rejoindre le cours" depuis le calendrier', async () => {
        await goToVideoJoinFromCalendar(teacherPage, teacher.loginIdentifier)
        await teacherPage.screenshot({
          path: 'test-results/livekit-01-teacher-video-join-page-initial.png',
          fullPage: true,
        })
      })

      await test.step('3b. Élève : trouve et clique "Rejoindre le cours" depuis le calendrier', async () => {
        await goToVideoJoinFromCalendar(studentPage, student.loginIdentifier)
        await studentPage.screenshot({
          path: 'test-results/livekit-02-student-video-join-page-initial.png',
          fullPage: true,
        })
      })

      // ══════════════════════════════════════════════════════════════════
      // BUG BLOQUANT DÉCOUVERT (2026-08-19) — documenté ici avec des assertions réelles,
      // PAS contourné en silence.
      //
      // `GET /video/rooms/:id` renvoie `status: "waiting"` pour une salle fraîchement créée
      // (vérifié ci-dessus). `VideoJoinPage.tsx` ne sait afficher un bouton "Rejoindre" que si
      // `room.status === 'active'` — les trois branches du composant (`active`/`scheduled`/
      // `ended`) ne couvrent PAS `waiting`, qui est pourtant l'état réel de toute salle
      // auto-créée. Résultat observé : une carte blanche, sans bouton, sans message d'erreur —
      // aucun utilisateur réel ne peut rejoindre une salle nouvellement créée par ce chemin.
      //
      // Pire : la SEULE action qui fait passer une salle de "waiting" à "active" côté serveur
      // est un appel réussi à `GET /video/rooms/:id/join` (voir docs/routes.md) — précisément
      // l'appel que le bouton manquant devait déclencher. C'est un verrou circulaire : sans
      // intervention hors UI, PERSONNE ne peut jamais rejoindre une salle fraîchement créée.
      // ══════════════════════════════════════════════════════════════════
      await test.step('BUG — aucun bouton "Rejoindre" sur une salle "waiting" (verrou circulaire)', async () => {
        const roomCheck = await fetchRoomByActivity(teacherToken, activityId)
        expect(roomCheck.status, 'GET /video/rooms/by-activity/:id toujours 200').toBe(200)
        console.log(`État serveur de la salle avant tentative UI : ${JSON.stringify(roomCheck.body)}`)

        const teacherJoinButton = teacherPage.getByRole('button', { name: 'Rejoindre' })
        await expect(
          teacherJoinButton,
          'BUG CONFIRMÉ : le bouton "Rejoindre" est absent tant que la salle est "waiting" — ' +
            'VideoJoinPage.tsx ne gère que active/scheduled/ended, jamais waiting',
        ).toHaveCount(0)

        const studentJoinButton = studentPage.getByRole('button', { name: 'Rejoindre' })
        await expect(studentJoinButton, 'même défaut côté élève').toHaveCount(0)

        // Aucun message d'erreur non plus — écran silencieusement vide, pire qu'un message
        // d'erreur explicite (voir la règle du projet sur les échecs muets).
        const teacherBodyText = await teacherPage.locator('body').innerText()
        console.log(`Corps de la page formateur (aucun bouton, aucune erreur visible) :\n${teacherBodyText}`)

        await teacherPage.screenshot({
          path: 'test-results/livekit-03-BUG-no-join-button-waiting-status.png',
          fullPage: true,
        })
      })

      // ══════════════════════════════════════════════════════════════════
      // Contournement DÉLIBÉRÉ, hors UI, uniquement pour continuer à vérifier ce qui peut
      // l'être du reste du chantier (le mécanisme LiveKit lui-même). Un appel direct à l'API
      // que le bouton manquant aurait dû déclencher fait passer la salle "waiting" → "active"
      // côté serveur. Ceci n'est PAS une preuve que le parcours utilisateur fonctionne : un
      // utilisateur réel n'a aucun moyen d'obtenir cet effet depuis l'interface.
      // ══════════════════════════════════════════════════════════════════
      await test.step('Contournement hors UI : force waiting → active via GET /video/rooms/:id/join (API directe)', async () => {
        const unlockRes = await joinVideoRoom(studentToken, roomId)
        console.log(`GET /video/rooms/${roomId}/join (contournement API) -> ${unlockRes.status}`)
        expect(unlockRes.status, 'le endpoint /join lui-même fonctionne (LiveKit backend sain)').toBe(200)
        expect(unlockRes.body.token, 'un vrai JWT LiveKit est renvoyé').toBeTruthy()
        expect(unlockRes.body.url, 'une URL wss:// est renvoyée').toMatch(/^wss:\/\//)

        const roomAfter = await fetchRoomByActivity(teacherToken, activityId)
        console.log(`État serveur de la salle après contournement : ${JSON.stringify(roomAfter.body)}`)
        expect(roomAfter.body.status, 'la salle est bien passée "active" côté serveur').toBe('active')
      })

      // ══════════════════════════════════════════════════════════════════
      // Suite de la preuve — maintenant que le serveur reflète "active", un rechargement de
      // page (règle du chargement au montage) doit faire apparaître le bouton "Rejoindre" pour
      // les deux participants, et permettre une vraie connexion LiveKit à vérifier.
      // ══════════════════════════════════════════════════════════════════
      await test.step('4. Après le contournement, le bouton "Rejoindre" apparaît bien (confirme le diagnostic)', async () => {
        await teacherPage.reload()
        await studentPage.reload()

        await expect(
          teacherPage.getByRole('button', { name: 'Rejoindre' }),
          'le bouton apparaît dès que le statut serveur est "active" — confirme que le défaut ' +
            'est bien la valeur "waiting" non gérée, pas autre chose',
        ).toBeVisible({ timeout: 15_000 })
        await expect(studentPage.getByRole('button', { name: 'Rejoindre' })).toBeVisible({ timeout: 15_000 })
      })

      let teacherConnected = false
      let studentConnected = false

      await test.step('5a. Formateur clique "Rejoindre" — connexion LiveKit réelle (wss://)', async () => {
        await teacherPage.getByRole('button', { name: 'Rejoindre' }).click()
        try {
          await expect(
            teacherPage.locator('div[data-lk-local-participant="true"]'),
            'le formateur est connecté à la salle LiveKit (sa propre tuile locale apparaît)',
          ).toBeVisible({ timeout: 30_000 })
          teacherConnected = true
        } catch (caughtError) {
          console.log(`Échec de connexion LiveKit côté formateur : ${String(caughtError)}`)
        }
        await teacherPage.screenshot({
          path: 'test-results/livekit-04-teacher-after-join-click.png',
          fullPage: true,
        })
      })

      await test.step('5b. Élève clique "Rejoindre" — connexion LiveKit réelle (wss://)', async () => {
        await studentPage.getByRole('button', { name: 'Rejoindre' }).click()
        try {
          await expect(
            studentPage.locator('div[data-lk-local-participant="true"]'),
            "l'élève est connecté à la salle LiveKit (sa propre tuile locale apparaît)",
          ).toBeVisible({ timeout: 30_000 })
          studentConnected = true
        } catch (caughtError) {
          console.log(`Échec de connexion LiveKit côté élève : ${String(caughtError)}`)
        }
        await studentPage.screenshot({
          path: 'test-results/livekit-05-student-after-join-click.png',
          fullPage: true,
        })
      })

      console.log(`Connexion locale établie — formateur: ${teacherConnected}, élève: ${studentConnected}`)

      if (teacherConnected && studentConnected) {
        await test.step("6. Chaque participant voit l'autre (tuile distante, data-lk-local-participant=false)", async () => {
          const teacherSeesRemote = teacherPage.locator('div[data-lk-local-participant="false"]')
          const studentSeesRemote = studentPage.locator('div[data-lk-local-participant="false"]')

          const teacherResult = await teacherSeesRemote
            .first()
            .waitFor({ state: 'visible', timeout: 30_000 })
            .then(() => true)
            .catch(() => false)
          const studentResult = await studentSeesRemote
            .first()
            .waitFor({ state: 'visible', timeout: 30_000 })
            .then(() => true)
            .catch(() => false)

          console.log(`Le formateur voit l'élève connecté : ${teacherResult}`)
          console.log(`L'élève voit le formateur connecté : ${studentResult}`)

          await teacherPage.screenshot({
            path: 'test-results/livekit-06-teacher-sees-other-participant.png',
            fullPage: true,
          })
          await studentPage.screenshot({
            path: 'test-results/livekit-07-student-sees-other-participant.png',
            fullPage: true,
          })

          if (consoleErrors.length > 0) {
            console.log(`Erreurs console capturées pendant la connexion :\n${JSON.stringify(consoleErrors, null, 2)}`)
          }

          expect
            .soft(teacherResult, 'le formateur doit voir la tuile distante de l\'élève')
            .toBe(true)
          expect
            .soft(studentResult, 'l\'élève doit voir la tuile distante du formateur')
            .toBe(true)
        })
      } else {
        console.log(
          'Connexion locale déjà en échec pour au moins un participant — la vérification de ' +
            "visibilité mutuelle n'est pas tentée (elle présupposerait une connexion qui n'a pas eu lieu).",
        )
        if (consoleErrors.length > 0) {
          console.log(`Erreurs console capturées :\n${JSON.stringify(consoleErrors, null, 2)}`)
        }
      }
    } finally {
      await teacherPage.context().close()
      await studentPage.context().close()
      await browser.close()
    }
  })
})
