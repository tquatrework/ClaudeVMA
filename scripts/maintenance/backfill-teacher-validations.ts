/**
 * backfill-teacher-validations.ts
 * ---
 * REPRISE DE STOCK des formateurs inscrits avant le 2026-08-12, qui n'ont aucun
 * enregistrement de validation dans profile-service et sont donc INVISIBLES du
 * responsable pédagogique : jamais vus, donc jamais validés, donc jamais
 * proposables. Cul-de-sac silencieux.
 *
 * Arbitrage du 2026-08-12 (`docs/architecture.md` > « Validation des nouveaux
 * formateurs, et plan de travail du RP »), point 3 : « les formateurs déjà
 * inscrits doivent être rattrapés par une migration. Sans elle, la correction
 * ne vaut que pour les inscriptions futures et le stock reste invisible. »
 *
 * POURQUOI UN SCRIPT ET NON UNE MIGRATION SQL — le point mérite d'être lu avant
 * de « corriger » ce choix. `profile-service` ne connaît pas les rôles :
 * identity-access-service en est l'unique propriétaire (arbitrage du
 * 2026-08-07), et `profile-service` a interdiction de les persister. Aucune
 * table locale ne permet donc de dire qui est formateur. On pourrait être tenté
 * de prendre `teacher_pedagogical_profiles` pour marqueur : mesuré contre la
 * pile le 2026-08-12, elle contient 5 lignes pour 17 formateurs, et les deux
 * seuls formateurs `validated` n'y figurent même pas. Une migration SQL ne
 * pourrait que deviner — et créerait des enregistrements de validation pour des
 * élèves et des parents. La liste est donc demandée à son propriétaire.
 *
 * IDEMPOTENT ET NON DESTRUCTEUR. Un formateur déjà `validated` ou `rejected`
 * est laissé strictement intact : la garantie est portée par le serveur
 * (`InternalService.ensureTeacherValidations`), pas par ce script. Le rejouer
 * autant de fois qu'on veut ne change rien après le premier passage.
 *
 * Variables d'environnement requises :
 *   IDENTITY_SERVICE_URL  — URL de base de identity-access-service
 *   PROFILE_SERVICE_URL   — URL de base de profile-service
 *   INTERNAL_SECRET       — clé partagée des routes internes (x-internal-secret)
 *
 * Usage :
 *   npx ts-node --transpile-only scripts/maintenance/backfill-teacher-validations.ts
 *   npx ts-node --transpile-only scripts/maintenance/backfill-teacher-validations.ts --dry-run
 */

import * as https from 'https';
import * as http from 'http';

const isDryRun = process.argv.includes('--dry-run');

const identityServiceUrl = process.env.IDENTITY_SERVICE_URL ?? 'http://localhost:3001';
const profileServiceUrl = process.env.PROFILE_SERVICE_URL ?? 'http://localhost:3002';
const internalSecret = process.env.INTERNAL_SECRET ?? '';

/**
 * Même plafond que celui déclaré côté serveur
 * (`ENSURE_TEACHER_VALIDATIONS_MAX_BATCH`). Le découpage est fait ici plutôt que
 * de laisser le serveur rogner : un plafond qui coupe en silence ferait croire
 * que tout le stock a été repris.
 */
const MAX_BATCH_SIZE = 200;

interface TeacherAccount {
  userId: string;
  loginIdentifier: string;
  role: string;
  email: string;
}

interface EnsureValidationsResponse {
  created: string[];
  alreadyPresent: string[];
}

function buildInternalHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (internalSecret) {
    headers['x-internal-secret'] = internalSecret;
  }
  return headers;
}

function httpRequest(
  urlString: string,
  options: { method: string; headers: Record<string, string>; body?: string },
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlString);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const request = requestModule.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method,
        headers: options.headers,
      },
      (response) => {
        let responseBody = '';
        response.on('data', (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        response.on('end', () => {
          resolve({ statusCode: response.statusCode ?? 0, body: responseBody });
        });
      },
    );

    request.on('error', reject);
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

/**
 * Liste les comptes de rôle formateur auprès de leur PROPRIÉTAIRE.
 * `GET /internal/accounts?role=formateur` → `[{userId, loginIdentifier, role, email}]`
 */
async function fetchTeacherAccounts(): Promise<TeacherAccount[]> {
  const targetUrl = `${identityServiceUrl}/internal/accounts?role=formateur`;
  console.log(`[backfill-validations] GET ${targetUrl}`);

  const response = await httpRequest(targetUrl, {
    method: 'GET',
    headers: buildInternalHeaders(),
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `identity-access-service a répondu HTTP ${response.statusCode} : ${response.body}`,
    );
  }

  const accounts: TeacherAccount[] = JSON.parse(response.body);
  console.log(`[backfill-validations] ${accounts.length} compte(s) de rôle formateur.`);
  return accounts;
}

/**
 * Demande à profile-service de créer les enregistrements manquants. C'est LUI
 * qui décide de ne pas toucher un statut existant — la règle appartient au
 * service propriétaire, jamais au script qui l'appelle.
 */
async function ensureValidations(teacherIds: string[]): Promise<EnsureValidationsResponse> {
  const targetUrl = `${profileServiceUrl}/internal/teachers/ensure-validations`;

  const response = await httpRequest(targetUrl, {
    method: 'POST',
    headers: buildInternalHeaders(),
    body: JSON.stringify({ teacherIds }),
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `profile-service a répondu HTTP ${response.statusCode} : ${response.body}`,
    );
  }

  return JSON.parse(response.body);
}

async function main(): Promise<void> {
  if (!internalSecret) {
    throw new Error(
      'INTERNAL_SECRET est absent. Les routes internes le refuseront : ' +
        'renseignez-le avant de lancer la reprise.',
    );
  }

  const accounts = await fetchTeacherAccounts();
  const teacherIds = accounts.map((account) => account.userId);

  if (teacherIds.length === 0) {
    console.log('[backfill-validations] Aucun formateur : rien à reprendre.');
    return;
  }

  if (isDryRun) {
    console.log(
      `[dry-run] ${teacherIds.length} formateur(s) seraient soumis à ` +
        `POST /internal/teachers/ensure-validations (par lots de ${MAX_BATCH_SIZE}). ` +
        'Aucun statut existant ne serait modifié.',
    );
    accounts.forEach((account) => {
      console.log(`[dry-run]   ${account.loginIdentifier} (${account.userId})`);
    });
    return;
  }

  const allCreated: string[] = [];
  const allAlreadyPresent: string[] = [];

  for (let offset = 0; offset < teacherIds.length; offset += MAX_BATCH_SIZE) {
    const batch = teacherIds.slice(offset, offset + MAX_BATCH_SIZE);
    const result = await ensureValidations(batch);
    allCreated.push(...result.created);
    allAlreadyPresent.push(...result.alreadyPresent);
  }

  const loginIdentifierByUserId = new Map(
    accounts.map((account) => [account.userId, account.loginIdentifier]),
  );

  console.log('');
  console.log('[backfill-validations] --- Résultat ---');
  console.log(`  Formateurs examinés          : ${teacherIds.length}`);
  console.log(`  Enregistrements créés        : ${allCreated.length}`);
  console.log(`  Déjà présents (intacts)      : ${allAlreadyPresent.length}`);
  allCreated.forEach((userId) => {
    console.log(`    créé → ${loginIdentifierByUserId.get(userId) ?? '?'} (${userId})`);
  });
}

main().catch((error: Error) => {
  console.error(`[backfill-validations] ÉCHEC : ${error.message}`);
  process.exit(1);
});
