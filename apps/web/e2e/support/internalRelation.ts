import { execFileSync } from 'node:child_process'

/**
 * Contournement de test légitime pour poser une relation TEACHER_OF_STUDENT sans passer par le
 * flow complet « demande de professeur » (qui exige un compte responsable_pedagogique dont cette
 * session n'a pas les identifiants — voir `README.md`, § « Pourquoi un compte RP doit déjà
 * exister »). Même principe déjà appliqué aux tours précédents de ce chantier (point 2) :
 * `POST /internal/create-teacher-student-relation` sur `profile-service`
 * (`docs/routes.md` § profile-service > API interne inter-services), protégée par
 * `X-Internal-Secret`.
 *
 * **Pourquoi `docker exec` plutôt que de lire `INTERNAL_SECRET` dans un `.env` local** : cette
 * route n'est de toute façon jamais exposée par `api-gateway` (`docs/routes.md` le rappelle
 * explicitement — « Jamais exposée par api-gateway »), donc injoignable en HTTP depuis ce poste
 * même en connaissant le secret. La seule voie réaliste est d'exécuter la requête **depuis le
 * conteneur `profile-service` lui-même**, qui connaît son propre secret via sa propre variable
 * d'environnement (`process.env.INTERNAL_SECRET`, jamais lue ni affichée par ce script — le
 * conteneur ne fait que l'utiliser en interne pour construire l'en-tête `X-Internal-Secret`).
 * Alternative explicitement permise par la consigne de session du 2026-08-19 pour ce chantier.
 */
export interface InternalRelationResult {
  status: number
  body: { teacherId: string; studentId: string; isPrincipalTeacher: boolean } | null
}

export function createTeacherStudentRelationViaInternalRoute(
  teacherId: string,
  studentId: string,
  isPrincipalTeacher = true,
): InternalRelationResult {
  const payload = JSON.stringify({ teacherId, studentId, isPrincipalTeacher })

  // Exécuté ENTIÈREMENT à l'intérieur du conteneur `visiomath_profile` : le secret n'est jamais
  // lu, transmis en argument, ni journalisé par ce process Node hôte — seul le résultat HTTP
  // (status + corps, sans donnée sensible) revient sur stdout.
  const script = `
    const http = require('http');
    const data = ${JSON.stringify(payload)};
    const req = http.request({
      hostname: 'localhost',
      port: process.env.PORT || 3002,
      path: '/internal/create-teacher-student-relation',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'X-Internal-Secret': process.env.INTERNAL_SECRET,
      },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => { process.stdout.write(JSON.stringify({ status: res.statusCode, body: raw })); });
    });
    req.on('error', (err) => { process.stderr.write(String(err && err.message ? err.message : err)); process.exit(1); });
    req.write(data);
    req.end();
  `

  const output = execFileSync('docker', ['exec', 'visiomath_profile', 'node', '-e', script], {
    encoding: 'utf-8',
  })

  const parsed = JSON.parse(output) as { status: number; body: string }
  return {
    status: parsed.status,
    body: parsed.body ? JSON.parse(parsed.body) : null,
  }
}
