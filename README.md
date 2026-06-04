# VisioMath

## Resume general du projet

VisioMath est une plateforme en ligne de soutien scolaire premium specialisee en mathematiques.
Elle doit permettre a des eleves d'etre accompagnes par des formateurs selectionnes.
La plateforme s'adresse aussi aux familles financeuses, aux responsables pedagogiques et aux administrateurs internes.
Elle combine cours en visio, calendrier, cahier de texte, carnet personnel, contenus pedagogiques et suivi de progression.
Le parcours de base commence par la creation de compte, les profils et la validation des utilisateurs.
Les eleves disposent d'un profil administratif, d'un profil pedagogique, d'un tableau de bord et d'un calendrier.
Les parents financent les activites et suivent tout ce qui concerne leurs eleves, sauf le carnet personnel.
Les formateurs disposent de profils, d'archives, d'un calendrier, d'une messagerie et d'un suivi financier.
Le RP conseille les familles, gere les demandes de professeurs et valide les formateurs ou contenus pedagogiques.
L'AP peut animer des formateurs, valider des contenus et creer forums ou parcours soumis aux validations prevues.
Le TI gere les comptes, incidents, droits techniques, masquages temporaires et forcages en cas de blocage.
L'administrateur financier gere les paiements, factures, contrats, credits et regles de valorisation.
Le modele economique repose sur des credits financiers consommes par les activites de la plateforme.
Les formateurs sont remuneres selon les prestations effectuees, facturees et validees.
Les points pedagogiques servent a valoriser l'engagement, les contributions et certains usages.
Les demandes de professeur sont pilotees par le RP, avec recherche selon niveau, disponibilites et points.
Les activites sont planifiees via les calendriers et peuvent donner lieu a des sessions de visio.
Le cahier de texte structure le suivi pedagogique entre eleve, formateur, parent et RP.
Le carnet personnel reste un espace reserve a l'eleve.
Les exercices, evaluations et tutos-videos enrichissent l'offre pedagogique en phase avancee.
Une evaluation doit toujours etre creee avec une solution, mais celle-ci n'est pas publiee directement a l'eleve.
L'eleve peut demander une correction pour obtenir une note ou une solution selon le cas.
Les forums et parcours permettent d'organiser des espaces collectifs et des progressions pedagogiques.
Un forum cree par AP doit etre valide par un RP avant publication aux autres membres.
Les archives pedagogiques, financieres et legales conservent les documents rattaches aux activites.
Les signatures de mandats clients et contrats formateurs sont prevues dans la gouvernance de phase 2.
La messagerie est prevue des la phase 1 entre contacts autorises.
Les modifications exigeant accord utilisateur doivent etre tracees dans l'application.
Le TI peut forcer un changement en cas de blocage, mais ce forçage doit etre audite.
L'architecture retenue decoupe le projet en microservices metier coordonnes par un service d'orchestration.
Les user stories associees servent de base au test driven development et a la verification des regles metier.

## Documentation

- `microservices.md` : descriptifs XML de chaque microservice, utilisables comme briefs de codage ulterieurs.
- `services/*.md` : un fichier XML par microservice, plus `orchestration-service.xml`.
- `architecture.md` : synthese lisible de l'architecture, des phases et des dependances.
- `user-stories-premier-jet.md` : premier jet des user stories par microservice et general, avec marquage `[SPEC]` / `[AJOUT]`.

## Phases retenues

- Phase 1 : socle comptes/profils, demande professeur, tableau de bord initial, calendrier, visio, cahier de texte, carnet personnel, messagerie.
- Phase 2 : gouvernance, archives, signatures, interfaces pedagogique/informatique/financiere, recherche professeur.
- Phase 3 : offre pedagogique enrichie, contenus, corrections, forums, parcours, activites non pourvues, enrichissements de messagerie.
