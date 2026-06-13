﻿# RapportCodex_bugs
Audit statique realise sur la copie commentee de ClaudeVMA.
Definition utilisee ici :
- Un bug est une anomalie susceptible de casser le demarrage, de produire une mauvaise reponse HTTP, d'exposer ou de bloquer une fonctionnalite, ou de contredire explicitement le comportement attendu.
- Les fragilites de maintenance, choix discutables, conventions heterogenes et risques futurs sont deplaces dans RapportCodex_normes.txt.
- Audit statique uniquement : je n'ai pas execute la suite de tests ni relance les conteneurs depuis cette copie.
## Bugs probables / anomalies fonctionnelles
### BUG-001 - calendar-service expose un ancien controleur /calendar sans authentification
Localisation :
- services/calendar-service/src/app.module.ts:36 importe CalendarModule.
- services/calendar-service/src/calendar/calendar.module.ts:16 declare CalendarController.
- services/calendar-service/src/calendar/calendar.controller.ts:19, 26, 37, 46, 54 exposent POST/GET/PATCH/DELETE sans @UseGuards.
- services/calendar-service/src/calendar/calendar.service.ts:24 retourne toutes les sessions via findAll().
Constat :
Le service contient deux domaines de calendrier : l'ancien `calendar/` et les nouveaux modules `calendars/`, `activities/`, `reminders/`. Le vieux `CalendarController` est encore actif et n'applique ni JwtAuthGuard, ni RolesGuard, ni filtrage par utilisateur.
Impact :
Si une route gateway pointe vers ce controleur, un utilisateur pourrait creer, lire, modifier ou supprimer des sessions sans controle applicatif interne. Meme si le gateway impose un JWT, le service lui-meme ne verifie pas le droit metier et `GET /calendar` peut retourner toutes les sessions.
Action recommandee :
Supprimer ou desactiver ce module si le modele cible est `activities/calendars/reminders`, ou lui appliquer les memes guards et controles de portee que les nouveaux controleurs.
### BUG-002 - GET /activities/:activityId ne verifie pas que l'utilisateur a le droit de lire l'activite
Localisation :
- services/calendar-service/src/activities/activities.controller.ts:84-90.
- services/calendar-service/src/activities/activities.service.ts:110-112 puis 125-128.
Constat :
Le controleur est bien protege par JwtAuthGuard et RolesGuard au niveau classe, mais `getActivity()` appelle `findOne(activityId)` sans transmettre l'utilisateur courant. Le service retourne l'activite par id, sans verifier que l'utilisateur est createur, participant, RP/TI, ou autrement autorise.
Impact :
Un utilisateur authentifie qui connait ou devine un UUID d'activite peut potentiellement lire une activite qui ne le concerne pas.
Action recommandee :
Passer `req.user` a `findOne`, puis verifier la portee de lecture dans le service : participant, createur, role interne autorise, ou relation metier explicite.
### BUG-003 - dashboard-notification-service et video-session-service demarrent probablement sur le mauvais chemin build
Localisation :
- services/dashboard-notification-service/Dockerfile:23 `CMD ["node", "dist/main"]`.
- services/dashboard-notification-service/package.json:9 `start:prod: node dist/main`.
- services/video-session-service/Dockerfile:23 `CMD ["node", "dist/main"]`.
- services/video-session-service/package.json:9 `start:prod: node dist/main`.
Constat :
Les autres services ont ete alignes sur `dist/src/main`. Dans ce projet, l'erreur `Cannot find module '/app/dist/main'` a deja ete observee lorsque le build Nest produit `dist/src/main.js`.
Impact :
Ces deux conteneurs peuvent redemarrer en boucle au lancement si leur sortie de build suit la meme convention que les autres services.
Action recommandee :
Verifier le contenu de `dist` apres `npm run build`. Si `dist/src/main.js` est produit, aligner Dockerfile et `start:prod` sur `node dist/src/main`.
### BUG-004 - frontend : fallback API incomplet quand VITE_API_BASE_URL est une chaine vide
Localisation :
- apps/web/src/api/client.ts:11.
Constat :
`const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'` ne remplace pas une chaine vide. Si Vite recoit `VITE_API_BASE_URL=''`, Axios appelle `/accounts` au lieu de `/api/v1/accounts`.
Impact :
Le front peut contourner involontairement le prefixe API du gateway et produire des 404/405, comme observe lors des tests manuels.
Action recommandee :
Utiliser un fallback qui traite aussi la chaine vide, par exemple `import.meta.env.VITE_API_BASE_URL || '/api/v1'`, ou faire echouer explicitement le build si la variable est vide.
### BUG-005 - orchestration-service : les callbacks webhook sont fail-closed si WEBHOOK_SECRET n'est pas fourni par Docker Compose
Localisation :
- services/orchestration-service/src/common/guards/webhook-secret.guard.ts:20-23.
- docker-compose.yml:92-101 ne fournit pas WEBHOOK_SECRET a orchestration-service.
Constat :
Le guard webhook refuse tout acces si `WEBHOOK_SECRET` est absent. Le `.env.example` du service mentionne la variable, mais le docker-compose racine ne la passe pas au conteneur.
Impact :
Les callbacks externes publies par le gateway peuvent retourner 401/403 cote service, meme si le routage Nginx est correct.
Action recommandee :
Ajouter `WEBHOOK_SECRET: ${WEBHOOK_SECRET:?...}` a orchestration-service dans docker-compose et documenter le header attendu cote provider.
### BUG-006 - services internes actives plus tard : INTERNAL_SECRET manque dans docker-compose pour plusieurs services
Localisation :
- docker-compose.yml:149-159 dashboard-notification-service sans INTERNAL_SECRET.
- docker-compose.yml:169-179 communication-service sans INTERNAL_SECRET.
- docker-compose.yml:223-232 video-session-service sans INTERNAL_SECRET.
- services/dashboard-notification-service/src/common/guards/internal.guard.ts:24-28.
- services/communication-service/src/internal/internal.controller.ts:45-48.
- services/video-session-service/src/internal/internal-secret.guard.ts:27-31.
Constat :
Ces services possedent des routes ou guards internes qui attendent `INTERNAL_SECRET`, mais docker-compose ne fournit pas la variable. Les comportements divergent : dashboard laisse passer si le secret manque, communication/video refusent les appels internes.
Impact :
Quand ces services seront actives dans les workflows, les appels internes pourront soit echouer systematiquement, soit etre trop ouverts selon le service.
Action recommandee :
Ajouter `INTERNAL_SECRET` a tous les services qui exposent des endpoints internes et harmoniser les guards en fail-closed hors developpement.
### BUG-007 - dashboard-notification-service : InternalGuard laisse passer si INTERNAL_SECRET est absent
Localisation :
- services/dashboard-notification-service/src/common/guards/internal.guard.ts:24-28.
Constat :
Si `INTERNAL_SECRET` n'est pas configure, le guard loggue un warning puis retourne `true`.
Impact :
Une route interne protegee par ce guard devient accessible sans secret si la variable d'environnement manque. Ce comportement est acceptable uniquement en developpement local tres controle, pas dans un environnement compose/prod.
Action recommandee :
Faire echouer l'acces quand `INTERNAL_SECRET` est absent, au moins lorsque `NODE_ENV !== 'development'`.
### BUG-008 - teacher-request-service accepte un secret JWT de secours `dev-secret`
Localisation :
- services/teacher-request-service/src/common/jwt.guard.ts:42.
- services/teacher-request-service/src/teacher-request/teacher-request.module.ts:28.
Constat :
Le service utilise `config.get<string>('JWT_SECRET', 'dev-secret')`. Si la variable manque, il verifie les tokens avec un secret connu et faible.
Impact :
En environnement mal configure, le service peut accepter des JWT signes avec `dev-secret`, ou diverger du secret utilise par identity-access-service.
Action recommandee :
Rendre `JWT_SECRET` obligatoire au demarrage et supprimer le fallback `dev-secret`.
### BUG-009 - Texte visible et commentaires corrompus par encodage dans plusieurs fichiers
Localisation indicative :
- apps/web/src/pages/RegisterPage.tsx contient `Compte crÃ©Ã©` / `Erreur lors de la crÃ©ation du compte`.
- apps/web/src/pages/ActivityDetailPage.tsx et CalendarPage.tsx contiennent `ActivitÃ©`.
- gateway/api-gateway/nginx.conf et docker-compose.yml contiennent de nombreux caracteres corrompus dans les commentaires.
Constat :
Des sequences de type `Ã©`, `Ã¢â‚¬â€`, `Ã¢â€â‚¬` indiquent une double interpretation d'encodage.
Impact :
Dans le frontend, c'est un bug utilisateur visible. Dans les fichiers de configuration, c'est surtout une degradation de lisibilite, mais elle a deja provoque des problemes Nginx quand des ornements Unicode etaient mal commentes.
Action recommandee :
Reconvertir les fichiers concernes en UTF-8 propre et remplacer les ornements decoratifs par des commentaires ASCII simples dans Nginx/YAML.
## Points retires de la categorie bug
Les sujets suivants ne sont pas classes ici comme bugs directs, mais comme fragilites ou normes a stabiliser dans RapportCodex_normes.txt :
- routage gateway tres manuel et sensible aux slashs ;
- strategies e2e heterogenes ;
- conventions DB `DATABASE_URL` vs variables separees ;
- duplication des guards JWT entre services ;
- valeurs par defaut faibles dans docker-compose, sauf lorsqu'elles entrainent directement un comportement dangereux dans un service donne.
