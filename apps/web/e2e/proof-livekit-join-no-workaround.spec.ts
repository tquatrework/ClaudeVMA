import { chromium, expect, test, type Page } from '@playwright/test'
import {
  acceptActivity,
  createCourseActivity,
  createTestStudent,
  createTestTeacher,
  fetchRoomByActivity,
  login,
  waitForVideoRoom,
} from './support/api'
import { createTeacherStudentRelationViaInternalRoute } from './support/internalRelation'

/**
 * Rejeu de `proof-livekit-join-confirmed-course.spec.ts` — consigne de session du 2026-08-19,
 * "suite directe" du point 4 du chantier « calendrier de disponibilités lié à la visio ».
 *
 * Deux bugs avaient été trouvés lors de la première tentative :
 *   1. Une salle fraîchement créée est `status: "waiting"` — aucun bouton "Rejoindre" ne
 *      s'affichait (VideoJoinPage.tsx ne gérait que active/scheduled/ended), verrou circulaire
 *      contourné à l'époque par un appel API direct à `/video/rooms/:id/join`.
 *   2. Les tuiles de participants LiveKit affichaient l'UUID technique brut au lieu d'un nom
 *      (AccessToken sans `name`).
 *
 * D'après la consigne de reprise, les deux ont été corrigés et déployés :
 *   1. `VideoRoomStatus` inclut désormais `'waiting'`, traité comme `'active'` par
 *      VideoJoinPage.tsx/VideoPage.tsx pour l'affichage du bouton "Rejoindre".
 *   2. L'`AccessToken` LiveKit porte un `name` (prénom+nom résolu via profile-service).
 *
 * Ce fichier rejoue EXACTEMENT le même scénario, mais SANS AUCUN CONTOURNEMENT : les deux
 * participants doivent voir un bouton "Rejoindre" cliquable dès l'arrivée sur l'écran, même
 * si la salle est encore `waiting`. Le seul appel API direct restant sert à préparer les
 * données (relation élève↔formateur, création+acceptation du cours) — jamais à interagir avec
 * l'écran vidéo à la place de l'utilisateur.
 */

const PASSWORD = 'E2eTest!2026'

/** UUID v4 générique — sert à repérer un identifiant technique affiché par erreur à l'écran. */
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** Même garde-fou que les autres specs de ce chantier contre le rate-limit de /auth/login. */
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

test.describe('Chantier calendrier-visio-livekit — rejeu point 4 sans contournement (2026-08-19)', () => {
  test('bouton "Rejoindre" disponible dès l\'arrivée (salle waiting), connexion LiveKit réelle, aucun UUID affiché', async () => {
    test.setTimeout(300_000)

    const uniqueSuffix = Date.now().toString()
    const studentFirstName = 'Camille'
    const studentLastName = `Recheck${uniqueSuffix}`
    const teacherFirstName = 'Morgane'
    const teacherLastName = `Recheckprof${uniqueSuffix}`

    // ══════════════════════════════════════════════════════════════════
    // Préparation : comptes réels + relation TEACHER_OF_STUDENT (même méthode que la session
    // précédente — hors périmètre UI, autorisé pour poser les données de départ uniquement)
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
    start.setUTCHours(16, 30, 0, 0)
    const end = new Date(start)
    end.setUTCHours(17, 30, 0, 0)

    let activityId = ''
    await test.step('1. Formateur propose un cours, élève accepte (API directe)', async () => {
      const createRes = await createCourseActivity(
        teacherToken,
        student.id,
        start.toISOString(),
        end.toISOString(),
        'Cours e2e rejeu LiveKit sans contournement',
      )
      console.log(`POST /activities -> ${createRes.status} ${JSON.stringify(createRes.body)}`)
      expect(createRes.status, "création de l'activité cours").toBe(201)
      activityId = createRes.body.id

      const acceptRes = await acceptActivity(studentToken, activityId)
      console.log(`POST /activities/${activityId}/accept -> ${acceptRes.status} ${JSON.stringify(acceptRes.body)}`)
      expect(acceptRes.status, "acceptation du créneau par l'élève").toBe(201)
      expect(acceptRes.body.status, "statut de l'activité après acceptation").toBe('confirmed')
    })

    // ══════════════════════════════════════════════════════════════════
    // Étape 2 — video-session-service crée automatiquement une salle LiveKit réelle,
    // vérifiée en `waiting` — c'est précisément l'état que le bug 1 ne savait pas afficher
    // ══════════════════════════════════════════════════════════════════
    let roomId = ''
    let observedInitialStatus = ''
    await test.step('2. La salle LiveKit est créée automatiquement (poll GET /video/rooms/by-activity/:id)', async () => {
      const room = await waitForVideoRoom(studentToken, activityId, 30_000, 2_000)
      console.log(`GET /video/rooms/by-activity/${activityId} -> ${JSON.stringify(room)}`)
      expect(room, 'la salle vidéo doit apparaître dans un délai raisonnable').not.toBeNull()
      expect(room!.activityId, 'la salle porte bien activityId, pas calendarSessionId').toBe(activityId)
      roomId = room!.id
      observedInitialStatus = room!.status
      console.log(`Statut initial réel de la salle auto-créée : ${observedInitialStatus}`)
    })

    // ══════════════════════════════════════════════════════════════════
    // Navigateurs : deux contextes séparés, certificat auto-signé LiveKit accepté, caméra/micro
    // factices.
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
      // Étape 3 — chaque participant trouve « Rejoindre le cours » sur son calendrier et clique.
      // AUCUN contournement API : c'est le clic qui doit faire passer waiting → active.
      // ══════════════════════════════════════════════════════════════════
      async function goToVideoJoinFromCalendar(page: Page, loginIdentifier: string): Promise<void> {
        await loginOnScreen(page, loginIdentifier, PASSWORD)
        await page.goto('/calendar')
        await page.getByRole('tab', { name: 'Mes disponibilités' }).click()

        const joinButton = page.getByRole('button', { name: /^Rejoindre le cours/ })
        await expect(
          joinButton,
          'le bouton "Rejoindre le cours" doit être visible sur le bloc confirmé, MÊME quand la ' +
            'salle est encore "waiting" (correctif attendu de la session précédente)',
        ).toBeVisible({ timeout: 15_000 })
        await joinButton.click()
        await expect(page).toHaveURL(/\/video-join\//, { timeout: 15_000 })
      }

      await test.step('3a. Formateur : trouve et clique "Rejoindre le cours" depuis le calendrier (sans contournement)', async () => {
        await goToVideoJoinFromCalendar(teacherPage, teacher.loginIdentifier)
        await teacherPage.screenshot({
          path: 'test-results/livekit-recheck-01-teacher-video-join-page-initial.png',
          fullPage: true,
        })
      })

      await test.step('3b. Élève : trouve et clique "Rejoindre le cours" depuis le calendrier (sans contournement)', async () => {
        await goToVideoJoinFromCalendar(studentPage, student.loginIdentifier)
        await studentPage.screenshot({
          path: 'test-results/livekit-recheck-02-student-video-join-page-initial.png',
          fullPage: true,
        })
      })

      // ══════════════════════════════════════════════════════════════════
      // Étape 4 — le bouton "Rejoindre" doit être visible IMMÉDIATEMENT sur la page video-join,
      // sans aucun appel API hors UI entre-temps. C'est le cœur de ce qui devait être corrigé.
      // ══════════════════════════════════════════════════════════════════
      await test.step('4. Bouton "Rejoindre" visible sans contournement, sur une salle encore waiting', async () => {
        // Re-vérifie côté serveur, uniquement pour journaliser l'état réel au moment du test —
        // ne déclenche AUCUNE action, c'est un GET pur.
        const roomCheck = await fetchRoomByActivity(teacherToken, activityId)
        expect(roomCheck.status, 'GET /video/rooms/by-activity/:id toujours 200').toBe(200)
        console.log(
          `État serveur de la salle juste avant le clic "Rejoindre" (aucune action déclenchée par ` +
            `cette lecture) : ${JSON.stringify(roomCheck.body)}`,
        )

        await expect(
          teacherPage.getByRole('button', { name: 'Rejoindre' }),
          'le bouton "Rejoindre" doit être présent côté formateur SANS contournement API, y ' +
            'compris quand la salle est encore "waiting" côté serveur',
        ).toBeVisible({ timeout: 15_000 })
        await expect(
          studentPage.getByRole('button', { name: 'Rejoindre' }),
          'même exigence côté élève',
        ).toBeVisible({ timeout: 15_000 })
      })

      // ══════════════════════════════════════════════════════════════════
      // Étape 5 — chaque participant clique "Rejoindre" et se connecte réellement à LiveKit.
      // ══════════════════════════════════════════════════════════════════
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
          path: 'test-results/livekit-recheck-03-teacher-after-join-click.png',
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
          path: 'test-results/livekit-recheck-04-student-after-join-click.png',
          fullPage: true,
        })
      })

      console.log(`Connexion locale établie — formateur: ${teacherConnected}, élève: ${studentConnected}`)

      // Après le clic, la salle doit être passée "active" côté serveur — juste une lecture,
      // pour documenter l'effet réel du clic UI (pas un contournement, aucune action déclenchée).
      const roomAfterJoin = await fetchRoomByActivity(teacherToken, activityId)
      console.log(
        `État serveur de la salle après les clics "Rejoindre" (lecture seule) : ` +
          `${JSON.stringify(roomAfterJoin.body)}`,
      )

      if (teacherConnected && studentConnected) {
        // ══════════════════════════════════════════════════════════════════
        // Étape 6 — chaque participant voit l'autre, ET son nom lisible (jamais un UUID).
        // ══════════════════════════════════════════════════════════════════
        await test.step("6. Chaque participant voit l'autre (tuile distante) avec un NOM LISIBLE, jamais un UUID", async () => {
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
            path: 'test-results/livekit-recheck-05-teacher-sees-other-participant.png',
            fullPage: true,
          })
          await studentPage.screenshot({
            path: 'test-results/livekit-recheck-06-student-sees-other-participant.png',
            fullPage: true,
          })

          if (consoleErrors.length > 0) {
            console.log(`Erreurs console capturées pendant la connexion :\n${JSON.stringify(consoleErrors, null, 2)}`)
          }

          expect(teacherResult, 'le formateur doit voir la tuile distante de l\'élève').toBe(true)
          expect(studentResult, 'l\'élève doit voir la tuile distante du formateur').toBe(true)

          // Nom lisible attendu sur chaque tuile : prénom + nom de l'AUTRE participant, JAMAIS
          // un UUID. Le sélecteur cible tout le texte visible dans la zone vidéo — on vérifie à
          // la fois la PRÉSENCE du nom attendu et l'ABSENCE de tout motif UUID.
          const teacherPageText = await teacherPage.locator('body').innerText()
          const studentPageText = await studentPage.locator('body').innerText()

          console.log(`Texte visible page formateur (extrait) : ${teacherPageText.slice(0, 2000)}`)
          console.log(`Texte visible page élève (extrait) : ${studentPageText.slice(0, 2000)}`)

          const teacherPageHasUuid = UUID_REGEX.test(teacherPageText)
          const studentPageHasUuid = UUID_REGEX.test(studentPageText)

          expect(
            teacherPageHasUuid,
            `BUG si vrai : un UUID est visible sur la page formateur pendant la visio — ` +
              `« aucun UUID ne doit être lu ni affiché par un utilisateur » (arbitrage 2026-08-09)`,
          ).toBe(false)
          expect(
            studentPageHasUuid,
            `BUG si vrai : un UUID est visible sur la page élève pendant la visio`,
          ).toBe(false)

          // Nom attendu de l'autre participant sur chaque page (prénom + nom exact).
          const studentDisplayName = `${studentFirstName} ${studentLastName}`
          const teacherDisplayName = `${teacherFirstName} ${teacherLastName}`

          expect(
            teacherPageText.includes(studentDisplayName),
            `le nom lisible de l'élève ("${studentDisplayName}") doit apparaître sur la page du ` +
              `formateur (tuile distante) — texte réel capturé ci-dessus dans les logs`,
          ).toBe(true)
          expect(
            studentPageText.includes(teacherDisplayName),
            `le nom lisible du formateur ("${teacherDisplayName}") doit apparaître sur la page de ` +
              `l'élève (tuile distante) — texte réel capturé ci-dessus dans les logs`,
          ).toBe(true)
        })
      } else {
        console.log(
          'Connexion locale déjà en échec pour au moins un participant — la vérification de ' +
            "visibilité mutuelle et de nom lisible n'est pas tentée (elle présupposerait une " +
            'connexion qui n\'a pas eu lieu).',
        )
        if (consoleErrors.length > 0) {
          console.log(`Erreurs console capturées :\n${JSON.stringify(consoleErrors, null, 2)}`)
        }
        // Échoue explicitement : la consigne exige une vraie connexion de bout en bout, pas
        // seulement l'apparition du bouton.
        expect(teacherConnected, 'le formateur doit se connecter réellement à LiveKit').toBe(true)
        expect(studentConnected, "l'élève doit se connecter réellement à LiveKit").toBe(true)
      }
    } finally {
      await teacherPage.context().close()
      await studentPage.context().close()
      await browser.close()
    }
  })
})
