# Architecture microservices VisioMath

## Principe de decoupage

La plateforme est decoupee par domaines metier stables plutot que par type d'ecran. Chaque microservice possede ses donnees principales, expose des APIs et publie des evenements metier. Les interfaces web/mobile consomment ces services via une API Gateway ou un Backend-for-Frontend.

## Microservices proposes

Les noms ci-dessous sont canoniques. Ils doivent etre repris tels quels dans les fichiers, le code, les tests et les appels interservices.

1. orchestration-service : coordination interservices, workflows, routage, evenements, idempotence et reprises.
2. identity-access-service : comptes, authentification, consentements RGPD, roles et droits.
3. profile-service : profils administratifs, pedagogiques et relations entre eleves, familles, formateurs, AP et RP.
4. dashboard-notification-service : tableaux de bord, notifications et signaux d'activite utiles par role.
5. communication-service : messagerie entre contacts autorises, messages systeme et incidents TI, prevue des la phase 1.
6. calendar-service : disponibilites, rendez-vous, cours, reunions, rappels et projection d'evenements.
7. teacher-request-service : demandes de professeur, affectations, refus, arrets, suivi PP.
8. video-session-service : creation et suivi des visios pedagogiques.
9. pedagogical-log-service : cahier de texte, memo, carnet personnel et traces pedagogiques.
10. admin-observability-service : activite globale, audit, incidents, masquage temporaire et statistiques.
11. archive-document-service : archives pedagogiques et financieres, pieces justificatives, documents rattaches.
12. legal-document-service : mandats clients, contrats formateurs, signatures et pieces legales.
13. finance-credit-service : profils financiers, credits, paiements familles, remunerations formateurs et exports.
14. content-catalog-service : exercices, evaluations, tutos-videos, validation et moderation pedagogique.
15. learning-activity-service : reponses, corrections, scores, points pedagogiques et activites non pourvues.
16. community-path-service : forums, parcours, badges et progression.

## Pase 1

Les 9 services de phase 1 sont :

orchestration-service
identity-access-service
profile-service
dashboard-notification-service
communication-service
calendar-service
teacher-request-service
video-session-service
pedagogical-log-service

## Priorisation

Phase 1 doit livrer un parcours utilisable :

- inscription et connexion ;
- profils minimaux ;
- demande de professeur ;
- calendrier ;
- visio ;
- cahier de texte ;
- carnet personnel ;
- communication et messagerie ;
- tableau de bord initial.

Phase 2 renforce la gouvernance :

- archives ;
- signatures ;
- interfaces RP, TI et finance ;
- recherche professeur ;
- suivi d'activite et droits etendus.

Phase 3 enrichit l'offre :

- exercices ;
- evaluations ;
- tutos-videos ;
- forums ;
- parcours ;
- badges ;
- corrections et activites non pourvues ;
- enrichissements de communication lies aux activites avancees.

## Services transverses recommandes

- API Gateway / BFF web-mobile.
- Event bus pour les evenements metier.
- Stockage objet pour les documents, videos et pieces justificatives.
- Moteur de recherche/indexation pour contenus, profils formateurs et archives.
- Observabilite technique : logs, traces, metriques, alertes.
- Jobs asynchrones : notifications, exports, rappels, rapprochements financiers.

## Arbitrages rendus

- Communication : la messagerie est prevue des la phase 1.
- Evaluations : une evaluation doit toujours etre creee avec une solution, mais cette solution n'est pas publiee ni accessible directement par l'eleve ; l'eleve peut demander une correction apres coup pour obtenir une note ou une solution comme sur un exercice.
- Forums AP : un AP peut creer et gerer son forum, mais la publication donnant acces aux autres membres doit etre validee par un RP.
- Vue parent : le parent a la vue sur tout ce qui concerne les eleves lies, sauf le carnet personnel reserve a l'eleve.
- Points pedagogiques : le RP et l'administrateur financier ont tous deux les droits complets.
- Modification avec accord utilisateur : les roles internes hors TI doivent obtenir un accord utilisateur trace dans l'application avant modification lorsque cet accord est requis ; le TI peut forcer un changement en cas de blocage.
- Propriete des donnees d'identite (firstName/lastName/phone) : ces champs appartiennent exclusivement a `profile-service`. `identity-access-service` ne les stocke pas et ne les rend pas obligatoires a la creation de compte ; il ne porte que l'authentification, les roles et les consentements. Toute collecte de nom/prenom/telephone (front, workflows d'onboarding) doit alimenter `profile-service`, jamais dupliquer ces champs dans `identity-access-service`. Arbitrage rendu le 2026-08-06, apres plusieurs allers-retours divergents entre le 4 et le 5 aout 2026 sur des branches non fusionnees.
- Auto-inscription directe (routes `/accounts/parents`, `/accounts/students`, `/accounts/teachers` exposees par `identity-access-service`, hors workflow orchestre) : ces DTOs peuvent continuer a accepter firstName/lastName/phone en entree, mais uniquement pour les relayer immediatement a `profile-service` lors de la creation du compte — `identity-access-service` ne les persiste jamais dans sa propre base et ne les expose pas en lecture. Ce relais ponctuel n'est pas une exception a l'arbitrage ci-dessus : `identity-access-service` reste un simple client de passage, `profile-service` reste l'unique proprietaire des donnees. Precision apportee le 2026-08-06.

## Points ouverts a arbitrer
