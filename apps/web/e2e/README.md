# Suite e2e (Playwright) — jouée contre la pile réelle

## Pourquoi une suite séparée

`npm test` (Vitest) simule tout le réseau : `apiClient` y est intercepté, aucune requête ne
quitte jamais le process de test. Cette suite `e2e` fait l'inverse — **aucun mock** — et parle
directement à `https://claudevma.visioprof.fr`, la seule adresse accessible pour ce projet (la
machine est distante, il n'y a pas de `localhost`, pas de serveur de dev à démarrer ici).

Une suite verte de `npm test` ne prouve donc jamais qu'un geste écran fonctionne réellement
contre les microservices déployés — seule cette suite `e2e` le fait, en citant une réponse HTTP
ou un état d'écran réel.

## Lancer la suite

```bash
cd apps/web
cp e2e/env.e2e.example .env.e2e   # une fois, puis renseigner E2E_RP_LOGIN_IDENTIFIER / E2E_RP_PASSWORD
npm run test:e2e
```

`.env.e2e` est gitignoré (`.env*` dans le `.gitignore` racine) : les identifiants du compte RP
de test n'y sont jamais committés.

## Pourquoi un compte RP doit déjà exister

Le scénario actuel a besoin d'un compte `responsable_pedagogique`. Ce rôle n'est **pas**
auto-inscriptible (`IAM-FB-002`, `docs/routes.md`) : la suite ne peut donc pas le créer elle-même
comme elle le fait pour l'élève et le formateur du scénario (`POST /accounts/students` /
`POST /accounts/teachers`, routes publiques réelles, jouées à chaque exécution). Un compte RP
réel doit exister au préalable sur la pile visée et être renseigné dans `.env.e2e`.

## Ce que chaque exécution laisse derrière elle

Chaque lancement crée un **nouvel** élève et un **nouveau** formateur (identifiants suffixés par
un horodatage), les lie via `POST /relations/teacher-student`, puis — pour le scénario actuel —
termine cette relation depuis l'écran. Ce sont de vrais comptes sur `identity-access-service` et
`profile-service`, pas des fixtures injectées en base :

- les comptes élève/formateur créés restent en base indéfiniment (pas de suppression de compte
  côté produit) ;
- la relation terminée reste en base, journalisée `endedAt`/`endedBy` (comportement voulu, jamais
  une ligne supprimée — voir `docs/architecture.md`).

**Ne pas lancer cette suite en boucle dans une CI sans avoir réfléchi à cette accumulation** —
aucun mécanisme de nettoyage n'existe aujourd'hui. Pour l'instant cette suite est un dispositif de
preuve manuelle, pas un job automatisé.

## Limite de débit sur `/auth/login`

`api-gateway` limite le débit de `/auth/login` (zone `auth`, nginx `limit_req`). Un enchaînement
rapide de plusieurs exécutions de cette suite (chacune fait au moins deux connexions : la
préparation API et la connexion à l'écran) peut déclencher un `502` temporaire. Ce n'est pas un
échec du test ni de l'application — attendre quelques secondes et relancer suffit.

## Un seul test pour l'instant

`rp-terminate-teacher-relation.spec.ts` est la première preuve du dispositif : le RP se connecte,
ouvre la fiche d'un élève ayant un formateur lié, clique sur « Mettre fin », confirme, et vérifie
que le formateur disparaît de l'écran. Il ne couvre volontairement qu'un seul flow — étendre la
suite à d'autres parcours est un choix à faire consciemment, pas un ajout mécanique.
