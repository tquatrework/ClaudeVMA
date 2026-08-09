# Proposition — contenu des profils administratifs et pédagogiques

> **Statut : toutes les questions sont tranchées, l'implémentation n'est pas lancée.**
> Document produit le 2026-08-09 à partir de l'existant réel (schéma en base + contrat Swagger
> de `profile-service`) et des cinq entités de la version précédente fournies par l'utilisateur.
> Décisions consignées au §11.

---

## 1. Structure retenue

**Tranché par l'utilisateur le 2026-08-09** : les champs d'ordonnance appartiennent bien au
**profil pédagogique** de l'élève ou du professeur. Deux blocs, donc, pas trois.

| Bloc | Contenu | Qui écrit |
|---|---|---|
| Profil administratif | identité, contact, adresse | le titulaire |
| Profil pédagogique | ce que le titulaire déclare **et** ce que le RP prescrit | selon la section — voir ci-dessous |

Un point subsiste et doit être préservé dans l'implémentation : dans l'ancienne version,
l'ordonnance porte un champ `rempli_par`. Ces champs ne sont pas rédigés par le titulaire mais
par le responsable pédagogique **sur** lui. Ils vivent dans le même profil, mais ils n'ont pas
le même auteur.

**Conséquence sur l'écriture, et c'est le vrai enjeu** : le profil pédagogique n'est pas
modifiable d'un bloc. Il se compose de deux sections aux droits distincts.

| Section du profil pédagogique | Contenu | Qui écrit |
|---|---|---|
| Déclarative | niveau, matières, objectifs, difficultés, diplômes… | le titulaire |
| Prescription (ex-ordonnance) | préconisations, évaluations, niveau validé | le RP seul |

Techniquement : un seul profil pédagogique par rôle, une seule lecture, mais **deux routes
d'écriture** — `PUT /profiles/{userId}/pedagogical` pour le titulaire, et une route dédiée à la
prescription réservée au RP. Une seule route qui accepterait tout laisserait un élève écrire
ses propres préconisations, ou un formateur ses propres résultats de test.

---

## 2. Ce qui ne doit pas entrer dans `profile-service`

Trois familles de champs de l'ancienne version relèvent d'autres services. Les accepter ici
recréerait la duplication de propriété déjà tranchée pour `firstName`/`lastName`/`phone`.

| Champs de l'ancienne version | Service propriétaire | Pourquoi |
|---|---|---|
| `companyName`, `siret`, `companyType`, `subjectToVat`, `iban`, `bic`, `amountToInvoice` | `finance-credit-service` | **Exclu du périmètre, tranché le 2026-08-09** : tout l'aspect financier sera traité plus tard, dans son propre chantier. La table `financial_profiles` existe déjà. |
| `calendarSlots` | `calendar-service` | Les disponibilités sont du calendrier, pas du profil. |
| `cvUrl` | `archive-document-service` | Une URL de fichier en dur dans un profil contourne le service qui possède les documents. `profile-service` ne garde qu'une **référence**. |
| `teacherSearch` | `teacher-request-service` | « En recherche de professeur » est l'**état d'une demande**, pas une case du profil. Deux sources de vérité produiraient des divergences. |

---

## 3. Profil administratif

**Commun à tous les rôles.** Table `administrative_profiles`.

Existant, à conserver tel quel :

`firstName`, `lastName`, `birthDate`, `phone`, `addressLine1`, `addressLine2`, `postalCode`,
`city`, `country`, `department`, `avatarUrl`, `passions`

**Aucun ajout.** `UserProfile` a été transmise le 2026-08-09 et son dépouillement est net : elle
ne contient que `passions` et `avatar`, qui existent déjà ici sous les noms `passions` et
`avatarUrl`. Le reste de l'entité n'est pas de la donnée administrative :

| Élément de `UserProfile` | Sort |
|---|---|
| `passions`, `avatar` | **Existent déjà** — rien à faire |
| `pseudo`, `availability` | Commentés dans le code d'origine, jamais activés |
| `calendarSlots` | Appartient à `calendar-service` |
| `addTeacherProfilPaymentInfo`, `increaseTeacherAmountToInvoice`, `payTeacherInvoice` | Finance — exclu, voir §2 |
| Relations vers profils et ordonnances | Structure, déjà couverte par le découpage actuel |

Conclusion : **le profil administratif de VisioMath est déjà plus riche que celui de l'ancienne
version.** Celle-ci portait l'identité sur son entité `User`, pas sur `UserProfile`. Il n'y a
donc rien à récupérer, et c'est une bonne nouvelle : un chantier de moins.

Deux remarques sur l'existant :

- `birthDate` a été retiré du formulaire d'inscription le 2026-08-09 parce qu'il n'était stocké
  nulle part. Le champ existe en base et à la modification du profil ; il faut le rebrancher à
  la création, ce qui suppose que `identity-access-service` le relaie à `profile-service`.
- `passions` est un champ libre. À conserver : il sert au lien humain, pas à l'administratif
  au sens strict, mais il n'a pas de meilleur foyer.

---

## 4. Profil pédagogique élève

Déclaré **par l'élève**. Table `student_pedagogical_profiles`.

| Champ | État | Origine | Remarque |
|---|---|---|---|
| `level` | existe | `niveau` | Niveau scolaire courant |
| `subjects` | existe | — | Matières concernées |
| `goals` | existe | `objectifs` | Ce que l'élève veut atteindre |
| `specificNeeds` | existe | — | Aménagements : DYS, PAP, PPS |
| **`difficulties`** | **à créer** | `difficultes` | Ce sur quoi l'élève bute |
| **`context`** | **à créer** | `contexte` | Situation scolaire et familiale utile au suivi |

`difficulties` mérite une mention particulière : la table `profile_visibility_preferences`
contient **déjà** un booléen `hide_difficulties_from_contacts`. Autrement dit, il existe
aujourd'hui un réglage de visibilité pour un champ qui n'existe pas. C'est un vestige, et il
confirme que ce champ était prévu.

Distinction à tenir entre `difficulties` et `specificNeeds` : le premier décrit une difficulté
d'apprentissage, le second un aménagement reconnu. Les confondre reviendrait à traiter un
trouble comme une simple faiblesse.

---

## 5. Profil pédagogique formateur

Déclaré **par le formateur**. Table `teacher_pedagogical_profiles`.

| Champ | État | Origine | Remarque |
|---|---|---|---|
| `levels` | existe | — | Niveaux enseignés |
| `subjects` | existe | — | Matières enseignées |
| `experience` | existe | `experience` | Parcours |
| **`diplomas`** | **à créer** | `diplomes` | Titres et certifications déclarés |
| **`specialties`** | **à créer** | `specialites` | Distinct de `subjects` : « préparation Grand Oral », « remise à niveau » |
| **`particularities`** | **à créer** | `particularites` | Modalités, contraintes, publics particuliers |
| **`cvDocumentId`** | **à créer** | `cvUrl` | **Référence** vers `archive-document-service`, pas une URL |
| `testResults` | **à déplacer** | — | Voir ci-dessous |
| `isAnimateurPedagogique` | **à sortir** | — | Voir ci-dessous |

Deux corrections de droits, qui sont des défauts réels de l'existant :

- **`testResults` est aujourd'hui dans le bloc déclaré par le formateur.** Un formateur peut
  donc écrire lui-même ses propres résultats de test. Ces résultats sont une évaluation menée
  par le RP : leur place est dans l'ordonnance formateur.
- **`isAnimateurPedagogique` n'est pas une donnée déclarative mais un droit.** Il est attribué
  par le RP via `POST /profiles/{teacherId}/ap-status`. Le laisser dans le DTO de mise à jour du
  profil expose une promotion de rôle à une route d'auto-édition.

---

## 6. Section prescription du profil pédagogique

Les champs d'ordonnance, intégrés au profil pédagogique de chaque rôle comme tu l'as tranché.
Ils restent **écrits par le responsable pédagogique seul**, via une route dédiée.

Stockage proposé : dans la même table que la section déclarative de chaque rôle, pas dans une
table séparée — c'est bien un seul profil. La séparation des droits est portée par les routes,
pas par le schéma.

### Élève — ajouts à `student_pedagogical_profiles`

| Champ | Origine |
|---|---|
| `generalAssessment` | `consideration_generale` |
| `recommendedPace` | `preco_rythme` |
| `recommendedTeacherProfile` | `preco_type_formateur` |
| `recommendedPath` | `preco_parcours` |
| `recommendedActivities` | `preco_activites` |
| `filledBy` + `filledAt` | `rempli_par` |

### Formateur — ajouts à `teacher_pedagogical_profiles`

| Champ | Origine |
|---|---|
| `maxValidatedLevel` | `niveau_max_valide` |
| `audienceType` | `public_type` |
| `testResults` | `resultats_test` — migré depuis le profil déclaratif |
| `testComments` | `commentaires_test` |
| `filledBy` + `filledAt` | `rempli_par` |

`filledBy` et `filledAt` ne sont pas décoratifs : ils rendent l'ordonnance opposable. On doit
savoir qui a prescrit quoi, et quand.

**Tranché le 2026-08-09 : oui, le titulaire lit sa prescription**, élève comme formateur, sauf
contre-indication ultérieure.

Deux conséquences à tenir à l'implémentation :
- la prescription est **lisible par son titulaire et non modifiable par lui** — c'est le premier
  endroit de l'application où lecture et écriture divergent aussi nettement sur un même bloc ;
- le RP écrit en sachant que l'intéressé lira. Si un besoin d'écrire hors du regard du titulaire
  apparaît, `internal_profile_notes` existe déjà pour ça et reste le bon endroit.

`internal_profile_notes` existe déjà pour les notes internes libres (avec `author_id` et
`author_role`). La prescription s'en distingue : elle est **structurée**, unique par personne, et
destinée à être exploitée. La note est libre, multiple et conversationnelle. Les deux coexistent.

---

## 7. Droits de lecture et d'écriture

Les règles générales sont déjà arbitrées dans `docs/architecture.md` (2026-08-07) et
s'appliquent sans changement. Ce qui suit précise leur application aux nouveaux blocs.

**Écriture** — jamais sur un champ d'identifiant. Sinon :

| Bloc ou section | Qui peut écrire |
|---|---|
| Profil administratif | le titulaire ; les administrateurs dans leur domaine, sous accord tracé |
| Profil pédagogique — section déclarative | le titulaire ; le RP pour le domaine pédagogique, sous accord tracé |
| Profil pédagogique — section prescription | **le RP seul**, par une route dédiée. Le titulaire n'écrit jamais. L'AP pour les formateurs qu'il anime, à confirmer. |
| `isAnimateurPedagogique` | le RP seul, par sa route dédiée — retiré du DTO de profil |

**Lecture** — pilotée par les relations métier, pas par la seule identité : le titulaire, les
personnes liées (parent↔élève, formateur↔élève, RP, AP sur les formateurs qu'il anime), et les
administrateurs. Rappel : le parent voit tout ce qui concerne ses élèves **sauf le carnet
personnel**.

---

## 8. Visibilité champ par champ

L'arbitrage du 2026-08-07 dit : au-delà d'un socle partagé par défaut, c'est l'utilisateur qui
décide de ce qu'il partage, et le détail devait être spécifié « en même temps que le contenu
complet des profils ». C'est maintenant.

L'existant est ad hoc : `profile_visibility_preferences` porte deux booléens nommés en dur
(`hide_difficulties_from_contacts`, `restrict_comments_to_principal_teacher`). Chaque nouveau
champ masquable ajouterait une colonne — le modèle ne tient pas.

**Proposition** : une table `profile_field_visibility` — `userId`, `fieldName`, `audience` —
où `audience` vaut `self` | `linked` | `all`. Un champ absent prend la visibilité par défaut de
son bloc. Les deux booléens existants deviennent deux lignes, sans perte.

Socle **validé le 2026-08-09**, visible par défaut des personnes liées : `firstName`,
`lastName`, `avatarUrl`, `level`, `subjects`. Tout le reste — `difficulties`, `context`,
`specificNeeds`, adresse, téléphone, `birthDate` — au choix de l'utilisateur, masqué par défaut.

---

## 9. Langue : anglais dans le code, français à l'écran

**Règle posée le 2026-08-09.** Les noms de champs, de variables et de clés d'API restent en
anglais — c'est déjà la règle du projet, et l'alignement front/back en dépend. En revanche,
**tout ce que l'utilisateur lit est en français** : libellés de champs, intitulés de sections,
messages d'erreur, états.

Concrètement, `recommendedTeacherProfile` s'affiche « Type de formateur préconisé », `difficulties`
« Difficultés rencontrées », `maxValidatedLevel` « Niveau maximum validé ». La correspondance est
portée par le front, dans un point unique, pas éparpillée au fil des composants — sinon le même
champ finira par porter deux libellés selon l'écran.

---

## 10. Ce que ça implique, et dans quel ordre

1. **`profile-service`** — 6 champs déclaratifs à créer, 1 à déplacer, 1 à sortir du DTO,
   9 champs de prescription à ajouter aux deux tables pédagogiques, une route d'écriture
   réservée au RP, 1 table de visibilité, avec les migrations correspondantes.
2. **`identity-access-service`** — relayer `birthDate` à la création du profil, pour rebrancher
   le champ retiré de l'inscription.
3. **Front** — affichage et édition des trois blocs, avec les droits en lecture et en écriture,
   plus l'écran de visibilité par champ.
4. **`finance-credit-service`** — accueillir les données de facturation formateur, **si** tu
   veux les récupérer de l'ancienne version. Chantier distinct, à ouvrir séparément.

Les points 1 à 3 forment un tout : livrer le back sans le front laisserait des champs invisibles,
livrer le front sans le back produirait des écrans qui mentent.

---

## 11. Décisions prises

Toutes tranchées le 2026-08-09.

| Question | Décision |
|---|---|
| Trois blocs ou deux ? | **Deux.** Les champs d'ordonnance rejoignent le profil pédagogique, avec deux routes d'écriture pour préserver les droits. |
| Le titulaire lit-il sa prescription ? | **Oui**, élève comme formateur, sauf contre-indication ultérieure. Lecture oui, écriture non. |
| `UserProfile` de l'ancienne version | Transmise et dépouillée : **rien à récupérer**, l'administratif actuel est déjà plus riche. |
| Données financières | **Hors périmètre**, chantier séparé et ultérieur. |
| Socle de visibilité par défaut | **Validé** tel que proposé au §8. |
| Langue | Anglais dans le code, **français à l'écran**. |

Il ne reste plus de question ouverte. La proposition est complète et prête à être implémentée
dès accord.
