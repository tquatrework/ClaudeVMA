/**
 * backfill-profiles.ts
 * ---
 * Détecte les comptes existants sans profil dans profile-service et crée un
 * profil minimal pour chacun via les endpoints internes.
 *
 * Variables d'environnement requises :
 *   IDENTITY_SERVICE_URL  — URL de base de identity-access-service (ex: http://localhost:3001)
 *   PROFILE_SERVICE_URL   — URL de base de profile-service         (ex: http://localhost:3002)
 *   INTERNAL_SECRET       — Clé partagée pour les routes internes  (x-internal-secret header)
 *
 * Usage :
 *   npx ts-node --transpile-only scripts/backfill-profiles.ts
 *   npx ts-node --transpile-only scripts/backfill-profiles.ts --dry-run
 */

import * as https from 'https';
import * as http from 'http';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const isDryRun = process.argv.includes('--dry-run');

const identityServiceUrl = process.env.IDENTITY_SERVICE_URL ?? 'http://localhost:3001';
const profileServiceUrl  = process.env.PROFILE_SERVICE_URL  ?? 'http://localhost:3002';
const internalSecret     = process.env.INTERNAL_SECRET      ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountRecord {
  userId: string;
  role: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface BackfillResult {
  totalAccountsProcessed: number;
  profilesAlreadyExisting: number;
  profilesCreated: number;
  profileCreationErrors: number;
  errorDetails: Array<{ userId: string; errorMessage: string }>;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function buildInternalHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
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

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method,
      headers: options.headers,
    };

    const request = requestModule.request(requestOptions, (response) => {
      let responseBody = '';
      response.on('data', (chunk: Buffer) => { responseBody += chunk.toString(); });
      response.on('end', () => {
        resolve({ statusCode: response.statusCode ?? 0, body: responseBody });
      });
    });

    request.on('error', reject);

    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

// ---------------------------------------------------------------------------
// Business logic
// ---------------------------------------------------------------------------

/**
 * Récupère la liste de tous les comptes depuis identity-access-service.
 * Endpoint attendu : GET /internal/accounts → AccountRecord[]
 */
async function fetchAllAccounts(): Promise<AccountRecord[]> {
  const targetUrl = `${identityServiceUrl}/internal/accounts`;
  console.log(`[backfill] Fetching accounts from ${targetUrl}`);

  if (isDryRun) {
    console.log('[dry-run] Would call GET /internal/accounts — returning mock data for syntax check');
    return [
      { userId: '87482274-1ef2-412a-827b-75fc48c28370', role: 'ELEVE', email: 'eleve@example.com', firstName: 'Alice', lastName: 'Martin', phone: '+33600000001' },
      { userId: 'bba9e321-4f12-4c8a-b6d3-000000000001', role: 'FORMATEUR', email: 'formateur@example.com', firstName: 'Jean', lastName: 'Professeur', phone: undefined },
      { userId: 'cca9e321-4f12-4c8a-b6d3-000000000002', role: 'PARENT_FINANCEUR', email: 'parent@example.com', firstName: 'Marie', lastName: 'Dupont', phone: '+33600000003' },
    ];
  }

  const response = await httpRequest(targetUrl, {
    method: 'GET',
    headers: buildInternalHeaders(),
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `identity-access-service responded with HTTP ${response.statusCode}: ${response.body}`,
    );
  }

  const accountList: AccountRecord[] = JSON.parse(response.body);
  console.log(`[backfill] Retrieved ${accountList.length} account(s)`);
  return accountList;
}

/**
 * Vérifie si un profil existe pour l'userId donné.
 * Retourne true si le profil existe (HTTP 200), false si absent (HTTP 404).
 * Lève une erreur pour tout autre code de statut inattendu.
 *
 * Note : GET /profiles/:userId nécessite un JWT valide en production.
 * En environnement de backfill, on utilise la route interne via INTERNAL_SECRET.
 */
async function profileExists(userId: string): Promise<boolean> {
  const targetUrl = `${profileServiceUrl}/profiles/${userId}`;

  if (isDryRun) {
    // En dry-run, tous les mock users n'ont pas encore de profil (simule le backfill complet)
    const mockUserIdsWithoutProfile = [
      '87482274-1ef2-412a-827b-75fc48c28370',
      'bba9e321-4f12-4c8a-b6d3-000000000001',
      'cca9e321-4f12-4c8a-b6d3-000000000002',
    ];
    const isProfileMissing = mockUserIdsWithoutProfile.includes(userId);
    console.log(`[dry-run] Would check GET /profiles/${userId} → simulated ${isProfileMissing ? '404 (absent)' : '200 (exists)'}`);
    return !isProfileMissing;
  }

  const response = await httpRequest(targetUrl, {
    method: 'GET',
    headers: buildInternalHeaders(),
  });

  if (response.statusCode === 200) return true;
  if (response.statusCode === 404) return false;

  throw new Error(
    `Unexpected HTTP ${response.statusCode} when checking profile for userId=${userId}: ${response.body}`,
  );
}

/**
 * Crée les profils nécessaires selon le rôle du compte :
 *   - ELEVE    → POST /internal/create-student-profiles  (admin + student peda)
 *   - FORMATEUR → POST /internal/create-teacher-profiles  (admin + teacher peda)
 *   - autres   → POST /internal/create-administrative-profile (admin uniquement)
 *
 * Tous les endpoints sont idempotents côté service.
 */
async function createProfilesForAccount(account: AccountRecord): Promise<void> {
  const isStudentRole = account.role === 'ELEVE';
  const isTeacherRole = account.role === 'FORMATEUR';

  let targetPath: string;
  if (isStudentRole) {
    targetPath = '/internal/create-student-profiles';
  } else if (isTeacherRole) {
    targetPath = '/internal/create-teacher-profiles';
  } else {
    targetPath = '/internal/create-administrative-profile';
  }

  const targetUrl = `${profileServiceUrl}${targetPath}`;

  const payloadBody: Record<string, string | undefined> = {
    userId: account.userId,
    firstName: account.firstName ?? undefined,
    lastName: account.lastName ?? undefined,
    email: account.email,
    phone: account.phone ?? undefined,
  };
  // Supprimer les clés explicitement undefined pour ne pas polluer le payload JSON
  for (const key of Object.keys(payloadBody)) {
    if (payloadBody[key] === undefined) {
      delete payloadBody[key];
    }
  }

  const requestPayload = JSON.stringify(payloadBody);

  if (isDryRun) {
    console.log(
      `[dry-run] Would POST ${targetPath} with payload=${requestPayload} (role=${account.role})`,
    );
    return;
  }

  const response = await httpRequest(targetUrl, {
    method: 'POST',
    headers: buildInternalHeaders(),
    body: requestPayload,
  });

  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(
      `HTTP ${response.statusCode} when creating profiles for userId=${account.userId} (role=${account.role}) via ${targetPath}: ${response.body}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runBackfill(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Profile backfill script — VisioMath profile-service');
  if (isDryRun) console.log('*** DRY-RUN MODE — no changes will be made ***');
  console.log('='.repeat(60));
  console.log(`identity-access-service URL : ${identityServiceUrl}`);
  console.log(`profile-service URL         : ${profileServiceUrl}`);
  console.log(`INTERNAL_SECRET configured  : ${internalSecret ? 'yes' : 'no (endpoints unprotected)'}`);
  console.log('');

  const result: BackfillResult = {
    totalAccountsProcessed: 0,
    profilesAlreadyExisting: 0,
    profilesCreated: 0,
    profileCreationErrors: 0,
    errorDetails: [],
  };

  const allAccounts = await fetchAllAccounts();
  result.totalAccountsProcessed = allAccounts.length;

  for (const account of allAccounts) {
    console.log(`\n[backfill] Processing userId=${account.userId} (role=${account.role}, email=${account.email})`);

    try {
      const hasExistingProfile = await profileExists(account.userId);

      if (hasExistingProfile) {
        console.log(`  → Profile already exists, skipping`);
        result.profilesAlreadyExisting++;
        continue;
      }

      console.log(`  → Profile absent — creating profiles for role=${account.role}`);
      await createProfilesForAccount(account);
      console.log(`  → Profiles created successfully`);
      result.profilesCreated++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  → ERROR for userId=${account.userId}: ${errorMessage}`);
      result.profileCreationErrors++;
      result.errorDetails.push({ userId: account.userId, errorMessage });
    }
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('BACKFILL REPORT');
  console.log('='.repeat(60));
  console.log(`Total accounts processed    : ${result.totalAccountsProcessed}`);
  console.log(`Profiles already existing   : ${result.profilesAlreadyExisting}`);
  console.log(`Profiles created            : ${result.profilesCreated}`);
  console.log(`Creation errors             : ${result.profileCreationErrors}`);

  if (result.errorDetails.length > 0) {
    console.log('\nError details:');
    for (const errorDetail of result.errorDetails) {
      console.log(`  - userId=${errorDetail.userId}: ${errorDetail.errorMessage}`);
    }
  }

  console.log('='.repeat(60));

  if (result.profileCreationErrors > 0) {
    process.exit(1);
  }
}

runBackfill().catch((fatalError: unknown) => {
  const errorMessage = fatalError instanceof Error ? fatalError.message : String(fatalError);
  console.error(`[backfill] Fatal error: ${errorMessage}`);
  process.exit(1);
});
