/**
 * provision-internal-test-accounts.ts
 * ---
 * PROVISIONING PONCTUEL de 4 comptes de test à rôle interne (technicien_informatique,
 * administrateur_financier, animateur_pedagogique x2), demandé explicitement par
 * l'utilisateur le 2026-08-26 pour tester des écrans administrateur sur la pile
 * réelle (dont un écran TI livré par la PR #135, en attente de validation).
 *
 * POURQUOI CE SCRIPT ET NON POST /accounts / POST /internal/create-account —
 * IAM-FB-002 est une règle métier volontaire, pas un bug à contourner par un appel
 * réseau détourné : AccountsService.createAccount() rejette explicitement tout rôle
 * de INTERNAL_ROLES (animateur_pedagogique, responsable_pedagogique,
 * technicien_informatique, administrateur_financier) avec un 403
 * ForbiddenException("Cannot self-register with an internal role (IAM-FB-002)") —
 * sur les DEUX routes qui réutilisent CreateAccountDto, y compris la route interne
 * POST /internal/create-account consommée par orchestration-service. Aucune route
 * HTTP existante ne permet donc de créer un compte à rôle interne.
 *
 * Un compte de test à rôle interne doit par conséquent être écrit directement dans
 * la base par ce service, en dehors du trajet HTTP normal — même esprit que
 * scripts/maintenance/backfill-teacher-validations.ts (script de maintenance
 * ponctuel, hors trajectoire applicative normale, exécuté depuis l'intérieur du
 * service), à la différence que celui-ci passe par TypeORM/repository plutôt que
 * par des routes HTTP internes, faute d'une route dédiée à la création d'un rôle
 * interne (et il n'en existe volontairement aucune, IAM-FB-002 étant une garde
 * assumée).
 *
 * Ce script réplique EXACTEMENT ce que fait AccountsService.createAccount(), MOINS
 * le refus IAM-FB-002 :
 *   1. Un compte `users` (identique à ce que créerait POST /accounts), avec le rôle
 *      demandé, mot de passe haché avec les mêmes paramètres bcrypt (12 rounds).
 *   2. Les consentements RGPD + CGU enregistrés par le même mécanisme que
 *      POST /consents (table consent_records, append-only, action GRANTED,
 *      DEFAULT_CONSENT_VERSION) — pour que le compte ressorte `active` (IAM-FB-003)
 *      immédiatement, sans passer par une signature manuelle après coup.
 *   3. Un appel à POST /internal/create-administrative-profile sur profile-service
 *      (X-Internal-Secret), exactement comme le fait
 *      AccountsService.persistAdministrativeProfile pour les 3 routes
 *      d'auto-inscription — condition documentée dans docs/architecture.md :
 *      "toute personne disposant d'un compte a un profil administratif, créé à
 *      l'inscription ; son absence est une incohérence de données (500)".
 *
 * IDEMPOTENT ET NON DESTRUCTEUR : un compte déjà existant (même email OU même
 * loginIdentifier) est laissé strictement intact et signalé "already_existing" —
 * rejouable sans risque.
 *
 * OUTIL PONCTUEL DE PROVISIONING — pas une route HTTP permanente, pas une
 * modification des règles IAM-FB-002. Réservé à un environnement de démo/test.
 *
 * Variables d'environnement (déjà positionnées par docker-compose dans le
 * conteneur identity-access-service) :
 *   DATABASE_URL            — requis
 *   INTERNAL_SECRET         — requis (appel sortant vers profile-service)
 *   PROFILE_SERVICE_URL     — optionnel, défaut http://profile-service:3002
 *   PROVISION_TEST_PASSWORD — optionnel, mot de passe commun aux 4 comptes
 *
 * Usage (depuis l'intérieur du conteneur identity-access-service) :
 *   npx ts-node --transpile-only scripts/maintenance/provision-internal-test-accounts.ts
 *   npx ts-node --transpile-only scripts/maintenance/provision-internal-test-accounts.ts --dry-run
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';
import { LoginSession } from '../../src/auth/entities/login-session.entity';
import { PasswordResetToken } from '../../src/auth/entities/password-reset-token.entity';
import { EmailVerificationToken } from '../../src/auth/entities/email-verification-token.entity';
import { IdentifierRecoveryToken } from '../../src/auth/entities/identifier-recovery-token.entity';
import { AuditLog } from '../../src/accounts/entities/audit-log.entity';
import {
  ConsentRecord,
  ConsentType,
  ConsentAction,
  DEFAULT_CONSENT_VERSION,
} from '../../src/consents/entities/consent-record.entity';
import { DelegatedAccessRequest } from '../../src/delegations/entities/delegated-access-request.entity';

const isDryRun = process.argv.includes('--dry-run');

const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL ?? 'http://profile-service:3002';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? '';
const TEST_PASSWORD = process.env.PROVISION_TEST_PASSWORD ?? 'VisioTest2026!';
const BCRYPT_ROUNDS = 12; // identique à AccountsService.createAccount

interface AccountToProvision {
  loginIdentifier: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

const ACCOUNTS_TO_PROVISION: AccountToProvision[] = [
  {
    loginIdentifier: 'technicien.informatique',
    email: 'technicien.informatique@test.fr',
    role: UserRole.TECHNICIEN_INFORMATIQUE,
    firstName: 'Technicien',
    lastName: 'Informatique',
  },
  {
    loginIdentifier: 'admin.financier',
    email: 'admin.financier@test.fr',
    role: UserRole.ADMINISTRATEUR_FINANCIER,
    firstName: 'Admin',
    lastName: 'Financier',
  },
  {
    loginIdentifier: 'animateurpeda.lycee',
    email: 'animateurpeda.lycee@test.fr',
    role: UserRole.ANIMATEUR_PEDAGOGIQUE,
    firstName: 'Animateur',
    lastName: 'Lycee',
  },
  {
    loginIdentifier: 'animateurpeda.sup',
    email: 'animateurpeda.sup@test.fr',
    role: UserRole.ANIMATEUR_PEDAGOGIQUE,
    firstName: 'Animateur',
    lastName: 'Sup',
  },
];

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    LoginSession,
    PasswordResetToken,
    EmailVerificationToken,
    IdentifierRecoveryToken,
    AuditLog,
    ConsentRecord,
    DelegatedAccessRequest,
  ],
  synchronize: false,
  logging: false,
});

/**
 * Même appel sortant que AccountsService.persistAdministrativeProfile, en dehors
 * de toute transaction locale (ce script n'a pas de compte à faire rollback : en
 * cas d'échec, le compte users reste en base et devra être rattrapé au prochain
 * lancement — le script est idempotent, il ne re-créera pas le compte, mais
 * relancera l'appel profile-service pour ce même userId si on le rejoue avec la
 * même logique de détection ci-dessous).
 */
async function createAdministrativeProfile(input: {
  userId: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}): Promise<void> {
  if (isDryRun) {
    console.log(
      `[dry-run] Appellerait POST /internal/create-administrative-profile pour ${input.userId} (role=${input.role})`,
    );
    return;
  }

  const response = await fetch(`${PROFILE_SERVICE_URL}/internal/create-administrative-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': INTERNAL_SECRET,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `profile-service a répondu HTTP ${response.status} pour userId=${input.userId} : ${responseBody}`,
    );
  }
}

async function main(): Promise<void> {
  if (!INTERNAL_SECRET) {
    throw new Error(
      "INTERNAL_SECRET est absent : requis pour l'appel sortant vers profile-service " +
        '(POST /internal/create-administrative-profile).',
    );
  }

  console.log('='.repeat(70));
  console.log('Provisioning de comptes de test à rôle interne — VisioMath');
  if (isDryRun) console.log('*** DRY-RUN — aucune écriture ne sera faite ***');
  console.log('='.repeat(70));

  await AppDataSource.initialize();
  const userRepo = AppDataSource.getRepository(User);
  const consentRepo = AppDataSource.getRepository(ConsentRecord);

  const results: Array<{
    account: AccountToProvision;
    status: 'created' | 'already_existing';
    userId?: string;
  }> = [];

  try {
    for (const account of ACCOUNTS_TO_PROVISION) {
      const existingAccount = await userRepo.findOne({
        where: [{ email: account.email }, { loginIdentifier: account.loginIdentifier }],
      });

      if (existingAccount) {
        console.log(
          `[skip] ${account.loginIdentifier} existe déjà ` +
            `(userId=${existingAccount.id}, role=${existingAccount.role}) — laissé intact.`,
        );
        results.push({ account, status: 'already_existing', userId: existingAccount.id });
        continue;
      }

      if (isDryRun) {
        console.log(
          `[dry-run] Créerait ${account.loginIdentifier} (${account.email}, role=${account.role})`,
        );
        results.push({ account, status: 'created' });
        continue;
      }

      const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
      const newUser = userRepo.create({
        loginIdentifier: account.loginIdentifier,
        email: account.email,
        passwordHash,
        role: account.role,
        validationStatus: ValidationStatus.PENDING,
        consentSigned: false,
      });
      const savedUser = await userRepo.save(newUser);

      // Consentements RGPD + CGU — même journal append-only que POST /consents
      // (ConsentRecordingService.recordConsent), pour que le compte passe active
      // (IAM-FB-003) sans étape manuelle supplémentaire.
      for (const consentType of [ConsentType.RGPD, ConsentType.CGU]) {
        await consentRepo.save(
          consentRepo.create({
            userId: savedUser.id,
            consentType,
            action: ConsentAction.GRANTED,
            version: DEFAULT_CONSENT_VERSION,
            ipAddress: null,
          }),
        );
      }
      savedUser.consentSigned = true;
      savedUser.validationStatus = ValidationStatus.ACTIVE;
      await userRepo.save(savedUser);

      await createAdministrativeProfile({
        userId: savedUser.id,
        firstName: account.firstName,
        lastName: account.lastName,
        role: account.role,
      });

      console.log(
        `[created] ${account.loginIdentifier} → userId=${savedUser.id}, role=${account.role}, status=active`,
      );
      results.push({ account, status: 'created', userId: savedUser.id });
    }
  } finally {
    await AppDataSource.destroy();
  }

  console.log('');
  console.log('--- Résultat ---');
  for (const result of results) {
    console.log(
      `  ${result.account.loginIdentifier.padEnd(28)} : ${result.status}${
        result.userId ? ` (${result.userId})` : ''
      }`,
    );
  }
}

main().catch((error: Error) => {
  console.error(`[provision-internal-test-accounts] ÉCHEC : ${error.message}`);
  process.exit(1);
});
