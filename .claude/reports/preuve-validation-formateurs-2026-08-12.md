# Preuve — validation des nouveaux formateurs, chaîne complète

Date : 2026-08-12 · Cible : `https://claudevma.visioprof.fr`
Services déployés ensemble : `identity-access-service`, `profile-service`.

## Le défaut de départ

Un formateur créé par la route réelle était lu `pending` individuellement mais **absent** de la
file de validation du RP. Il n'était donc jamais validé, jamais proposable. Cul-de-sac silencieux.

## La chaîne, jouée de bout en bout

```
1. POST /accounts/teachers  (inscription réelle)   -> userId 43a8437b-…

2. GET /profiles/teachers/pending-validation (RP)
   total en attente : 18
   le nouveau y est : True   -> Theo Chainon | depuis 2026-08-12T15:47:22.503Z

3. PATCH /profiles/:id/validation  in_review  -> 200
   PATCH /profiles/:id/validation  validated  -> 200
   (deux temps : un RP ne peut pas sauter l'étape, seul un TI le peut)

4. GET /profiles/teachers/validated (RP)
   annuaire : 3 professeurs
   le nouveau y est : True

5. GET /profiles/teachers/pending-validation (RP)
   encore en attente : False | total file : 17
```

Le formateur traverse donc tout le cycle : inscription → file du RP → validation → annuaire des
proposables → sortie de la file.

## Ce qui a été corrigé

- **`profile-service`** crée l'enregistrement de validation à l'inscription, comme le profil
  administratif. Reprise de stock : 16 formateurs rendus visibles, les 2 déjà `validated` laissés
  intacts.
- **`identity-access-service`** transmet le `role` dans son appel à
  `create-administrative-profile`, sur **cinq** points d'appel (dont les comptes créés en
  parallèle). Sans lui, `profile-service` ne pouvait pas savoir qui était formateur.
- Trouvaille : `POST /accounts/teachers` passe par `create-administrative-profile`, **pas** par
  `create-teacher-profiles`. Corriger là où le nom l'appelait aurait donné du code mort avec des
  tests verts.
- Message de refus de saut d'étape traduit en français.

## Restes connus

- **`orchestration-service` ne transmet pas le rôle** dans le workflow `teacher-onboarding` : un
  formateur créé par ce chemin resterait invisible. Non traité.
- La reprise de stock est un **script**, pas une migration : `profile-service` ne connaît pas les
  rôles. À rejouer si des formateurs sont créés par un chemin non corrigé.
