# Preuve — flow « demande de professeur », joué contre la pile réelle

Date : 2026-08-12 · Cible : `https://claudevma.visioprof.fr` · Services reconstruits et redéployés :
`teacher-request-service`, `profile-service`.

Comptes utilisés (créés le 2026-08-11 par les routes réelles, mot de passe `Visio!2026Flow`) :
`trsflow.eleve.0811` (Lea Bertrand), `trsflow.parent.0811`, `trsflow.prof1.0811` (Nadia Lambert),
`trsflow.prof2.0811` (Yanis Roche), `trsflow.rp.0811`.

---

## Étape 1 — l'élève crée sa demande

C'est l'appel qui répondait **`400 Bad Request`** hier.

```
POST /api/v1/teacher-requests
{"description":"Je suis en terminale et je decroche en analyse…"}
→ 201
  id          b3c3de2a-fd0a-48dd-99ce-5476e42c9828
  status      pending
  studentName 'Lea Bertrand'
```

**Le nom de l'élève est résolu** — hier `studentName` valait `null` sur les 16 demandes, faute de
`PROFILE_SERVICE_URL`, et l'écran retombait sur un UUID.

### Un champ inconnu n'est plus absorbé en silence

```
POST /api/v1/teacher-requests  {"description":"test","subject":"Maths","urgency":"haute"}
→ 400
  ["Le champ « subject » n'est pas attendu par cette route.",
   "Le champ « urgency » n'est pas attendu par cette route."]
```

Message **en français**, qui nomme le champ fautif. Hier, `{"subject":"X","urgency":"haute"}`
répondait `201` et `urgency` disparaissait sans un mot.

## Étapes 2 et 3 — le RP voit la demande et propose à deux formateurs

```
GET  /api/v1/teacher-requests                      (RP)  → 200
POST /api/v1/teacher-requests/:id/proposals        (RP)  → 201
{"teacherIds":[Nadia, Yanis], "message":"…",
 "availabilityNote":"Mardi ou jeudi apres 17h",
 "compensationNote":"45 EUR de l heure",
 "responseDeadline":"2026-08-20"}
```

**Envoi groupé et atomique** — hier il fallait un appel par formateur, sans atomicité entre eux.
Les trois champs indicatifs optionnels sont portés par la proposition.

## Étape 4 — les deux formateurs acceptent

```
formateur 1 accepte → 201   proposition=accepted  demande=redirected
formateur 2 accepte → 201   proposition=accepted  demande=redirected
```

**C'est ici que le défaut central est fermé.** Hier, ces deux appels créaient **deux affectations
`active`** sur le même élève et la même demande, et la demande basculait en `assigned` — un
cul-de-sac qui rendait l'arbitrage du RP structurellement inatteignable. Ici la demande **reste
ouverte** et aucun professeur n'est encore désigné : une acceptation n'est qu'une candidature.

## Étape 5 — le RP lit les réponses

```
GET /api/v1/teacher-requests/:id/proposals  (RP)  → 200
  Nadia Lambert   accepted
  Yanis Roche     accepted
```

Cette lecture **n'existait pas** : `404` hier. Le RP n'avait aucun moyen de savoir qui avait
accepté, donc aucun moyen de trancher.

## Étapes 6 à 8 — le RP tranche

```
POST /api/v1/teacher-requests/:id/validate  (RP)  {"proposalId":<Nadia>,"isPrincipalTeacher":true}
→ 201
  status            closed
  chosenTeacherName 'Nadia Lambert'
  closedAt          2026-08-12T10:17:05.104Z
```

### Le lien élève↔professeur est réellement créé, chez son propriétaire

```
formateur retenu   → GET /api/v1/profiles/<eleve>  → 200
formateur écarté   → GET /api/v1/profiles/<eleve>  → 403
```

Le droit de lecture s'ouvre pour le professeur choisi et **reste fermé** pour l'autre. Le lien vit
dans `profile-service`, pas dans une table `assignments` privée.

### Les demandes tombent (étape 8)

```
élève : la demande apparaît 0 fois dans scope=open
RP    : la demande apparaît 0 fois dans scope=open
scope=closed → status closed, professeur 'Nadia Lambert', closedAt renseigné
```

---

## Second scénario — un formateur qui ne répond jamais

L'énoncé exige que les professeurs non retenus soient soldés **« qu'ils aient ou non répondu »**.

Demande `70438856-173f-4dd1-aff6-48ef4d754915` : proposition envoyée à Nadia et Yanis, **Nadia ne
répond pas**, Yanis accepte, le RP valide Yanis en professeur **non** principal.

```
Yanis Roche      accepted        (a répondu : oui)
Nadia Lambert    expired         (a répondu : NON)
```

Deux états distincts et non mensongers : `not_selected` pour qui avait accepté sans être retenu
(premier scénario), `expired` pour qui n'a jamais répondu. Ni l'un ni l'autre n'est confondu avec
`declined`, qui reste réservé au refus explicite du formateur.

## Le trou de droit du parent est fermé

Hier, un parent créait une demande pour **n'importe quel élève** → `201`, indistinguable d'une
demande légitime dans la liste du RP.

```
parent → élève auquel il n'est PAS lié : 404  « Aucun eleve correspondant n'a ete trouve. »
parent → son propre élève              : 201  studentName 'Lea Bertrand'
```

Le refus emprunte le **même message qu'une absence** : on ne révèle pas l'existence de l'élève,
conformément aux masquages arbitrés les 2026-08-10 et 2026-08-11.

## Un formateur ne peut pas répondre à la place d'un autre

```
Yanis tente d'accepter la proposition adressée à Nadia → 404
```

`404` et non `403` : la proposition d'autrui est traitée comme inexistante.

---

## Ce que cette preuve ne couvre pas

- **Aucune notification n'est envoyée** (étape 7). Choix de séquencement assumé, arbitrage 7 du
  2026-08-12 : le flow d'abord, les notifications ensuite. Le flow émet en revanche de vrais
  événements, pour qu'un abonné s'y branche sans le retoucher.
- **Le front n'est pas encore réaligné.** Ces preuves passent par l'API. Le formulaire élève est
  déjà conforme, mais les écrans RP et formateur appellent encore des routes du modèle abandonné.
- Traces laissées sur la pile : 4 demandes de test sur le compte `trsflow.eleve.0811`, deux liens
  élève↔formateur créés (Nadia principal, Yanis secondaire).
