# identity-access-service — propagation du rôle à profile-service

Date : 2026-08-12
Branche : `feat/validation-nouveaux-professeurs`
Statut : ✅ livré, tests verts, poussé

## Besoin

Un formateur qui s'inscrit n'apparaissait jamais devant le RP : aucun enregistrement de validation
n'était créé, donc jamais validé, donc jamais proposable. `profile-service` crée cet enregistrement
à la création du profil administratif **quand il sait que la personne est un formateur** ; il ne
pouvait pas le savoir, `identity-access-service` étant l'unique propriétaire du rôle
(arbitrage du 2026-08-07, « Propriété du rôle »).

## Ce qui a été fait

`role` est ajouté au corps déjà envoyé à `POST /internal/create-administrative-profile`
(header `X-Internal-Secret` inchangé) :

```json
{ "userId": "…", "firstName": "…", "lastName": "…", "phone": "…", "birthDate": "…",
  "role": "formateur" }
```

Envoyé **pour tous les rôles**, à chaque appel, au même titre que `x-correlation-id`. Valeur
transmise telle qu'elle est stockée (`eleve`, `parent_financeur`, `formateur`, …) : même nom et même
valeur des deux côtés, aucun mapping — contrairement à `phoneNumber` → `phone`.

### Routes qui transmettent désormais le rôle

| Route | Compte concerné | Rôle transmis |
|---|---|---|
| `POST /accounts/teachers` | le formateur | `formateur` |
| `POST /accounts/students` | l'élève | `eleve` |
| `POST /accounts/students` | le parent **créé** dans le même appel (`parentAccountMode: 'new'`) | `parent_financeur` |
| `POST /accounts/parents` | le parent | `parent_financeur` |
| `POST /accounts/parents` | l'élève **créé** dans le même appel (`studentAccountMode: 'new'`) | `eleve` |

Un compte simplement **rattaché** (`mode: 'existing'`) ne déclenche aucun appel — son profil
existant n'est jamais réécrit. Comportement inchangé.

### Routes qui ne transmettent rien, parce qu'elles n'appellent pas profile-service

`POST /accounts` (générique) et `POST /internal/create-account` (consommée par
`orchestration-service`) ne collectent ni nom, ni prénom, ni téléphone, et n'ont jamais appelé
`create-administrative-profile`. Voir le point ouvert plus bas.

## Point de vigilance vérifié

`POST /accounts/teachers` passe par `create-administrative-profile`, **pas** par une route
`create-teacher-profiles` que le nom laisserait supposer. C'est le chemin réellement emprunté qui a
été couvert ; un commentaire dans `accounts.service.ts` l'indique au prochain lecteur.

## Fichiers touchés

- `services/identity-access-service/src/common/clients/profile-service.client.ts`
  — `role?: UserRole` ajouté à `CreateAdministrativeProfileInput`.
- `services/identity-access-service/src/accounts/accounts.service.ts`
  — `persistAdministrativeProfile` prend `role` (**requis**) et le relaie ; 5 points d'appel.
- `services/identity-access-service/test/unit/accounts.service.spec.ts`
  — bloc « role propagation to profile-service » (7 tests) + assertions existantes complétées.
- `services/identity-access-service/test/unit/common/profile-service.client.spec.ts`
  — rôle présent dans le corps sortant, valeur jamais traduite (parcours de tout l'enum).
- `docs/routes.md` — contrat sortant mis à jour.
- `docs/services/identity-access-service.md` — session du 2026-08-12.

## Choix de conception

**Requis côté helper, facultatif côté contrat.** `role` est optionnel dans
`CreateAdministrativeProfileInput` — c'est ce que déclare `profile-service` — mais requis dans
`persistAdministrativeProfile`. Le compilateur interdit ainsi qu'un futur point d'appel l'oublie en
silence : l'oubli reproduirait exactement le défaut corrigé ici.

**Rien de nouveau n'est stocké.** Le rôle est transporté comme contexte de décision. Aucune donnée
supplémentaire n'est persistée, `firstName`/`lastName`/`phone` ne sont pas touchés.

**L'appel reste obligatoire, non best-effort.** Un échec fait échouer la transaction, renvoie `503`
et ne publie aucun `AccountCreated`. Un test le verrouille explicitement, pour qu'un ajout de champ
ne fasse pas glisser l'appel vers du best-effort.

## Vérification

- Suite complète : **371/371 verts**, 20 suites (unitaires + e2e), dont 9 tests ajoutés.
- `nest build` sans erreur.

**Réserve explicite** : ces tests simulent `profile-service` (le client est un stub). Ils prouvent
que le rôle part, **pas** que le RP voit le formateur. La preuve réelle demande une inscription
formateur contre la pile déployée, puis une lecture de
`GET /profiles/teachers/pending-validation`.

## Points ouverts

1. **Le workflow orchestré ne passe pas par ce chemin.** Un formateur créé via
   `POST /internal/create-account` (workflow `teacher-onboarding`) n'obtiendra son enregistrement de
   validation que si `orchestration-service` transmet lui-même le rôle dans **son** appel à
   `create-administrative-profile`. Hors périmètre de ce service — à vérifier côté
   `orchestration-service`.
2. **Déploiement.** Le champ étant facultatif côté receveur, l'ordre ne casse rien ; mais tant que
   la moitié de `profile-service` n'est pas en service, le formateur reste invisible du RP. Les deux
   moitiés sont sur la même branche et gagnent à être déployées ensemble. La migration de rattrapage
   du stock de formateurs déjà inscrits appartient à `profile-service`.
