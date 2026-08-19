# video-session-service — TLS pour LiveKit (2026-08-19, suite du point 4)

Statut : ✅ certificat auto-signé généré (SAN IP correct), terminaison TLS mise
en place via un conteneur Caddy dédié, connexion `wss://` de bout en bout
**réellement vérifiée** (pas supposée) contre une pile LiveKit + Caddy
jetable. Pile de production non touchée. Reste des étapes manuelles
obligatoires côté `.env`, pare-feu et — surtout — côté navigateur de
l'utilisateur (section 1, à lire en premier).

---

## 0. Contexte

Suite directe de la session précédente (`.claude/reports/video-session-service-2026-08-19.md`) :
LiveKit réel est en place derrière `POST /video/rooms` / `GET /video/rooms/:id/join`,
mais `LIVEKIT_PUBLIC_URL` ne pouvait être que `ws://` faute de TLS sur le port
LiveKit (7880) — inutilisable depuis un front servi en HTTPS
(`https://claudevma.visioprof.fr`), un navigateur bloquant silencieusement une
connexion WebSocket non chiffrée depuis une page HTTPS (contenu mixte).

Décision utilisateur du 2026-08-19 : **certificat auto-signé, explicitement
pour une phase de test.** Assumé, documenté comme tel, pas contourné par
Let's Encrypt ni un proxy supplémentaire.

IP publique fournie : `193.108.54.226`.

---

## 1. ÉTAPES MANUELLES OBLIGATOIRES (à faire par l'utilisateur)

### 1.1 L'étape navigateur — LA PLUS IMPORTANTE, piège silencieux sinon

**Avant** de tenter de rejoindre une visio depuis l'application, ouvrir une
fois, dans le navigateur qui sera utilisé :

```
https://193.108.54.226:7880/
```

Le navigateur affichera un avertissement de sécurité (« Votre connexion n'est
pas privée » ou équivalent selon le navigateur) — c'est normal, le certificat
est auto-signé et n'a aucune autorité de confiance derrière lui. **Accepter
manuellement l'avertissement et continuer.**

**Sans cette étape, la connexion WebSocket `wss://` échouera en silence** au
moment de rejoindre une visio depuis l'application : le navigateur refuse
d'établir une connexion `wss://` vers un hôte dont il n'a jamais accepté le
certificat, et ne remonte généralement aucune erreur exploitable côté
JavaScript (juste une fermeture de connexion). Tout fonctionnera pourtant
correctement côté serveur — c'est le piège d'expérience utilisateur le plus
important de cette phase de test, à refaire à chaque changement de
navigateur/appareil/profil (le certificat n'étant accepté que localement, pas
propagé).

### 1.2 Variables à renseigner dans le `.env` réel (accès refusé par la
politique de sandbox, comme lors de la session précédente)

| Variable | Valeur |
|---|---|
| `LIVEKIT_NODE_IP` | `193.108.54.226` (déjà requis par la session précédente) |
| `LIVEKIT_PUBLIC_URL` | `wss://193.108.54.226:7880` — **en `wss://`, pas `ws://`** (changement de cette session) |

`LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` : toujours à changer en production,
inchangé depuis la session précédente.

### 1.3 Port à ouvrir sur le pare-feu de la machine

| Port | Protocole | Usage |
|---|---|---|
| `7880` | TCP | Désormais servi par le conteneur `livekit-tls` (terminaison TLS), pas directement par `livekit`. Même port qu'avant côté pare-feu — rien de nouveau à ouvrir si déjà fait lors de la session précédente. |

`7881/tcp` et `50000-50019/udp` restent inchangés (déjà documentés).

### 1.4 Déploiement

```
docker compose up -d --build livekit livekit-tls video-session-service
```

Puis, comme documenté par la session précédente : exécuter la migration dans
le conteneur `video-session-service` si ce n'est pas déjà fait
(`npm run migration:run`).

---

## 2. Preuve — connexion `wss://` réelle de bout en bout

**Ce qui a été vérifié** : pas seulement que les conteneurs démarrent, mais
qu'un client se comportant comme un navigateur (après acceptation manuelle du
certificat) établit réellement une session WebSocket LiveKit **à travers le
proxy TLS**, avec un token signé par la même dépendance
(`livekit-server-sdk`) que celle utilisée par `LiveKitService`.

### 2.1 Vérification que `livekit-server` ne termine pas nativement le TLS sur 7880

```
$ docker run --rm livekit/livekit-server:latest --help
...
--turn-cert string     tls cert file for TURN server [$LIVEKIT_TURN_CERT]
--turn-key string      tls key file for TURN server [$LIVEKIT_TURN_KEY]
...
$ docker run --rm livekit/livekit-server:latest help-verbose | grep -i tls
--turn.cert_file string   generated [$LIVEKIT_TURN_CERT_FILE]
--turn.tls_port int       generated (default: 0) [$LIVEKIT_TURN_TLS_PORT]
--turn.external_tls       generated (default: false) [$LIVEKIT_TURN_EXTERNAL_TLS]
```

Confirmé sur l'image réelle 1.13.5 : aucune option TLS pour le port
signalisation/API principal, seulement pour le relais TURN. D'où le conteneur
`livekit-tls` dédié.

### 2.2 Certificat généré, SAN IP vérifié

```
$ openssl x509 -in livekit-selfsigned.crt -noout -text | grep -A2 "Subject Alternative Name\|Subject:\|Not After"
            Not After : Nov 21 08:41:36 2028 GMT
        Subject: C = FR, O = VisioMath, OU = video-session-service (test TLS auto-signe), CN = 193.108.54.226
            X509v3 Subject Alternative Name:
                IP Address:193.108.54.226
```

### 2.3 `docker compose config` valide la syntaxe complète

Aucune erreur autre que les gardes `:?` déjà présentes (variables requises non
fournies dans le shell de test, comportement volontaire et inchangé).

### 2.4 Smoke test bout-en-bout — pile jetable, isolée de la production

Conteneurs `smoketest_livekit` (LiveKit réel) et `smoketest_livekit_tls`
(Caddy avec le certificat réel de `infra/livekit-tls/certs/`), sur un réseau
Docker dédié `livekit_tls_smoketest_net`, détruits immédiatement après le
test. **La pile de production (`visiomath_*`) n'a jamais été touchée** —
vérifié par ailleurs que le conteneur `livekit` de production n'existe même
pas encore (`docker ps -a` ne le liste pas ; `docker inspect
visiomath_video_session` ne porte aucune variable `LIVEKIT_*`, confirmant que
la session précédente n'avait pas déployé sa partie non plus).

Script Node (`livekit-server-sdk` + `ws`, mêmes dépendances que le code de
production) :

```
--- createRoom() via HTTP clair (comme LIVEKIT_API_URL interne) ---
Room created: {"name":"smoketest-tls-room-1787129077069","sid":"RM_p2DxsgqQmzwU"}
--- AccessToken genere, longueur: 312 ---
--- Connexion WSS reelle a travers le proxy TLS ---
URL: wss://127.0.0.1:17880/rtc?access_token=<token>&auto_subscribe=1&sdk=js&version=2.5.0&protocol=15
--- Handshake WebSocket HTTP ---
Status code upgrade: 101
--- WebSocket OPEN (readyState = 1 ) ---
--- Premier message recu du serveur LiveKit, taille: 645 octets ---
--- RESULTAT ---
{"connected":true,"firstMessageBytes":645}
--- cleanup: deleteRoom() ---
Room deleted.
SMOKETEST WSS OK
```

Handshake HTTP `101 Switching Protocols` (upgrade WebSocket réussi),
`WebSocket.readyState === OPEN`, et un premier message protobuf réel du
serveur LiveKit (`JoinResponse`, 645 octets) reçu **à travers le tunnel TLS**
— preuve que la chaîne complète fonctionne : client → TLS (certificat
auto-signé, validation désactivée côté client de test **exactement comme un
navigateur le ferait après acceptation manuelle de l'avertissement**) → Caddy
→ HTTP clair interne → LiveKit → réponse réelle.

Le port 17880 (host) pointe vers `livekit-tls:7880` (Caddy) ; le port 17881
(host) pointe directement vers `livekit:7880` en HTTP clair, utilisé
uniquement pour `RoomServiceClient.createRoom()` — exactement le chemin que
`LIVEKIT_API_URL` emprunte en production (interne au réseau Docker, jamais à
travers la terminaison TLS, celle-ci n'étant nécessaire que pour le client
navigateur).

### 2.5 Nettoyage effectué

```
$ docker rm -f smoketest_livekit smoketest_livekit_tls
$ docker network rm livekit_tls_smoketest_net
```

Aucun conteneur ni réseau résiduel de ce smoke test.

---

## 3. Ce qui a été livré

1. **`infra/livekit-tls/`** (nouveau répertoire, au même niveau que
   `gateway/`) :
   - `Caddyfile` — reverse proxy TLS → HTTP local vers `livekit:7880`,
     `reverse_proxy` gère nativement l'upgrade WebSocket.
   - `certs/livekit-selfsigned.crt` + `certs/livekit-selfsigned.key` —
     certificat auto-signé, SAN IP `193.108.54.226`, valide jusqu'au
     2028-11-21 (825 jours). **Clé privée committée délibérément**, justifié
     dans `certs/README.md`.
   - `certs/openssl-san.cnf` — configuration utilisée pour générer le
     certificat, permet de le régénérer facilement si l'IP change.
   - `certs/README.md` — justification explicite du choix de committer une
     clé privée ici, et avertissement clair : **jamais** pour un vrai secret
     de production.
2. **`docker-compose.yml`** :
   - Service `livekit` : ne publie plus `7880` sur l'hôte (seuls `7881/tcp`
     et `50000-50019/udp` restent publiés directement).
   - Nouveau service `livekit-tls` (image `caddy:2-alpine`) : publie `7880`
     sur l'hôte, monte `Caddyfile` et `certs/` en lecture seule, `depends_on
     livekit`.
   - `video-session-service` : `depends_on livekit-tls` ajouté ;
     `LIVEKIT_PUBLIC_URL` documenté comme devant être `wss://` avec la valeur
     concrète attendue pour cette machine.
3. **`docs/routes.md`** — section `video-session-service` : nouveau
   sous-titre « TLS pour le port LiveKit (2026-08-19) », étape navigateur mise
   en avant.
4. **`docs/services/video-session-service.md`** — nouveau bloc
   `<implementation>` daté, décisions techniques et points ouverts.

---

## 4. Fichiers touchés (chemins absolus)

- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-abce840da1fcc6139/infra/livekit-tls/Caddyfile` (nouveau)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-abce840da1fcc6139/infra/livekit-tls/certs/livekit-selfsigned.crt` (nouveau)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-abce840da1fcc6139/infra/livekit-tls/certs/livekit-selfsigned.key` (nouveau — clé privée d'un certificat de test auto-signé, committée délibérément, voir README.md)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-abce840da1fcc6139/infra/livekit-tls/certs/openssl-san.cnf` (nouveau)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-abce840da1fcc6139/infra/livekit-tls/certs/README.md` (nouveau)
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-abce840da1fcc6139/docker-compose.yml`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-abce840da1fcc6139/docs/routes.md`
- `/home/debian/Documents/claudeVMA/.claude/worktrees/agent-abce840da1fcc6139/docs/services/video-session-service.md`

Non modifié (hors périmètre, à dessein) :
- `.env` / `.env.example` — accès refusé par la politique de sandbox, mêmes
  variables déjà signalées par la session précédente, plus le changement
  `ws://` → `wss://` documenté ici.
- Front (`VideoJoinPage.tsx`) — toujours hors périmètre, tâche séparée déjà
  identifiée par la session précédente.
- Code applicatif de `video-session-service` (`src/`) — aucun changement,
  cette session ne touche que l'exposition réseau/TLS, pas la logique métier.

---

## 5. Points ouverts

- Certificat auto-signé = limite assumée pour cette phase de test, pas
  utilisable tel quel pour les utilisateurs finaux de la plateforme
  (avertissement de sécurité systématique, à refaire par appareil/navigateur).
  Passage à un certificat de confiance réelle : hors périmètre, sur demande
  explicite future.
- Étapes manuelles `.env` + pare-feu + déploiement + acceptation navigateur :
  aucune ne peut être faite par cet agent (accès `.env` refusé par la
  politique de sandbox, pare-feu et navigateur hors de portée d'un agent de
  code). Voir section 1.
- Points ouverts déjà signalés par la session précédente (front
  `VideoJoinPage.tsx`, `video-session-service` producteur d'événements stdout
  uniquement, `ActivityConfirmed` sans `ActivityScheduled` correspondant)
  inchangés, non retraités ici.
