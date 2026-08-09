# Proposition — contenu des profils administratifs et pédagogiques

> **Statut : proposition soumise à validation.** Rien n'est implémenté. Document produit le
> 2026-08-09 à partir de l'existant réel (schéma en base + contrat Swagger de `profile-service`)
> et des quatre entités de la version précédente fournies par l'utilisateur.

---

## 1. Le point à trancher en premier

La consigne posait : « profile = profil administratif, ordonnance = profil pédagogique ».
**Cette correspondance ne tient pas**, et c'est le principal enseignement de la comparaison.

`StudentProfile` de l'ancienne version contient `niveau`, `difficultes`, `contexte`,
`objectifs` : ce sont des données **pédagogiques** au sens de VisioMath, et elles existent déjà
dans `student_pedagogical_profiles`. Les basculer dans le profil administratif reviendrait à
mélanger identité et pédagogie, et à casser les règles de droit déjà arbitrées.

Ce que `ordonnance` désigne réellement, son champ `rempli_par` le dit : un document **rédigé par
un tiers** — le responsable pédagogique — **sur** l'utilisateur. Ce n'est pas « le profil
pédagogique », c'est une **prescription**. Elle a un auteur différent, des droits d'écriture
différents, et une durée de vie différente.

**Proposition : trois blocs, pas deux.**

| Bloc | Contenu | Qui écrit |
|---|---|---|
| Profil administratif | identité, contact, adresse | le titulaire |
| Profil pédagogique | ce que le titulaire déclare sur lui-même | le titulaire |
| **Ordonnance pédagogique** *(nouveau)* | ce que le RP prescrit / évalue sur le titulaire | le RP, jamais le titulaire |

C'est la décision structurante de cette proposition. Tout le reste en découle.

---

## 2. Ce qui ne doit pas entrer dans `profile-service`

Trois familles de champs de l'ancienne version relèvent d'autres services. Les accepter ici
recréerait la duplication de propriété déjà tranchée pour `firstName`/`lastName`/`phone`.

| Champs de l'ancienne version | Service propriétaire | Pourquoi |
|---|---|---|
| `companyName`, `siret`, `companyType`, `subjectToVat`, `iban`, `bic`, `amountToInvoice` | `finance-credit-service` | Données de facturation et de rémunération. La table `financial_profiles` existe déjà, avec `payment_method` et `payment_reference`. `amountToInvoice` est un solde : l'architecture interdit de calculer un solde ailleurs qu'en finance. |
| `cvUrl` | `archive-document-service` | Une URL de fichier en dur dans un profil contourne le service qui possède les documents. `profile-service` ne garde qu'une **référence**. |
| `teacherSearch` | `teacher-request-service` | « En recherche de professeur » est l'**état d'une demande**, pas une case du profil. Deux sources de vérité produiraient des divergences. |

---

## 3. Profil administratif

**Commun à tous les rôles.** Table `administrative_profiles`.

Existant, à conserver tel quel :

`firstName`, `lastName`, `birthDate`, `phone`, `addressLine1`, `addressLine2`, `postalCode`,
`city`, `country`, `department`, `avatarUrl`, `passions`

**Aucun ajout proposé** — et il me manque un élément pour trancher : l'entité `UserProfile`
de l'ancienne version, référencée par les quatre fichiers fournis mais **non transmise**. C'est
elle qui portait l'équivalent du profil administratif. Si tu me l'envoies, je complète ce bloc ;
en l'état je ne peux pas savoir ce qui manque, et je préfère le dire plutôt que d'inventer.

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

## 6. Ordonnance pédagogique — le bloc nouveau

Écrite **par le responsable pédagogique**, jamais par le titulaire. Deux tables.

### Élève — `student_pedagogical_prescriptions`

| Champ | Origine |
|---|---|
| `generalAssessment` | `consideration_generale` |
| `recommendedPace` | `preco_rythme` |
| `recommendedTeacherProfile` | `preco_type_formateur` |
| `recommendedPath` | `preco_parcours` |
| `recommendedActivities` | `preco_activites` |
| `filledBy` + `filledAt` | `rempli_par` |

### Formateur — `teacher_pedagogical_prescriptions`

| Champ | Origine |
|---|---|
| `maxValidatedLevel` | `niveau_max_valide` |
| `audienceType` | `public_type` |
| `testResults` | `resultats_test` — migré depuis le profil déclaratif |
| `testComments` | `commentaires_test` |
| `filledBy` + `filledAt` | `rempli_par` |

`filledBy` et `filledAt` ne sont pas décoratifs : ils rendent l'ordonnance opposable. On doit
savoir qui a prescrit quoi, et quand.

**Question ouverte, que je ne tranche pas seul** : le titulaire lit-il son ordonnance ?

- Pour l'élève : lui montrer les préconisations le rend acteur de son parcours ; les lui cacher
  permet au RP d'écrire franchement. Les deux se défendent.
- Pour le formateur : `maxValidatedLevel` conditionne les affectations qu'il recevra. Le lui
  cacher serait difficilement tenable.

`internal_profile_notes` existe déjà pour les notes internes libres (avec `author_id` et
`author_role`). L'ordonnance s'en distingue : elle est **structurée**, unique par personne, et
destinée à être exploitée. La note est libre, multiple et conversationnelle. Les deux coexistent.

---

## 7. Droits de lecture et d'écriture

Les règles générales sont déjà arbitrées dans `docs/architecture.md` (2026-08-07) et
s'appliquent sans changement. Ce qui suit précise leur application aux nouveaux blocs.

**Écriture** — jamais sur un champ d'identifiant. Sinon :

| Bloc | Qui peut écrire |
|---|---|
| Profil administratif | le titulaire ; les administrateurs dans leur domaine, sous accord tracé |
| Profil pédagogique | le titulaire uniquement ; le RP pour le domaine pédagogique, sous accord tracé |
| Ordonnance | **le RP seul.** Le titulaire n'écrit jamais. L'AP pour les formateurs qu'il anime, à confirmer. |
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

Socle proposé, visible par défaut des personnes liées : `firstName`, `lastName`, `avatarUrl`,
`level`, `subjects`. Tout le reste — `difficulties`, `context`, `specificNeeds`, adresse,
téléphone, `birthDate` — au choix de l'utilisateur, masqué par défaut.

---

## 9. Ce que ça implique, et dans quel ordre

1. **`profile-service`** — 6 champs à créer, 1 à déplacer, 1 à sortir du DTO, 2 tables
   d'ordonnance, 1 table de visibilité, avec les migrations correspondantes.
2. **`identity-access-service`** — relayer `birthDate` à la création du profil, pour rebrancher
   le champ retiré de l'inscription.
3. **Front** — affichage et édition des trois blocs, avec les droits en lecture et en écriture,
   plus l'écran de visibilité par champ.
4. **`finance-credit-service`** — accueillir les données de facturation formateur, **si** tu
   veux les récupérer de l'ancienne version. Chantier distinct, à ouvrir séparément.

Les points 1 à 3 forment un tout : livrer le back sans le front laisserait des champs invisibles,
livrer le front sans le back produirait des écrans qui mentent.

---

## 10. Ce que j'attends de toi

1. **Valides-tu les trois blocs** plutôt que deux, et donc l'ordonnance comme objet distinct ?
2. **Le titulaire lit-il son ordonnance ?** Réponse possiblement différente pour l'élève et pour
   le formateur.
3. **`UserProfile`** de l'ancienne version : peux-tu me l'envoyer ? Sans elle, je ne peux pas
   dire ce qui manque au profil administratif.
4. **Les données de facturation formateur** (SIRET, IBAN, BIC…) : à reprendre maintenant dans
   `finance-credit-service`, ou plus tard ?
5. **La visibilité par champ** : le socle proposé au point 8 te convient-il ?
