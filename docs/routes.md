# VisioMath — Référence des routes Phase 1

Toutes les routes sont préfixées par `/api/v1/` via le gateway.
Les routes marquées 🔒 nécessitent un header `Authorization: Bearer <token>`.

---

## auth-service

| Méthode | Chemin | Description | Auth | Body |
|---|---|---|---|---|
| POST | /auth/register | Créer un compte | Non | `{email, password, role?}` |
| POST | /auth/login | Se connecter | Non | `{email, password}` |
| POST | /auth/refresh | Rafraîchir le token | Non | `{refresh_token}` |
| GET | /auth/me | Profil courant | 🔒 | — |

Réponse login/register : `{access_token, refresh_token, user: {id, email, role}}`

---

## user-profile-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /profiles | Créer un profil | 🔒 |
| GET | /profiles | Lister tous les profils | 🔒 |
| GET | /profiles/:userId | Profil d'un utilisateur | 🔒 |
| PATCH | /profiles/:userId | Mettre à jour un profil | 🔒 |
| DELETE | /profiles/:userId | Supprimer un profil | 🔒 |

---

## teacher-request-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /requests | Créer une demande | 🔒 |
| GET | /requests | Lister toutes les demandes | 🔒 |
| GET | /requests/:id | Détail d'une demande | 🔒 |
| PATCH | /requests/:id/status | Changer le statut | 🔒 |
| DELETE | /requests/:id | Supprimer une demande | 🔒 |

Statuts : `pending` → `accepted` / `declined` / `cancelled`

---

## calendar-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /calendar | Créer une séance | 🔒 |
| GET | /calendar | Lister les séances | 🔒 |
| GET | /calendar?teacherId=X | Séances d'un professeur | 🔒 |
| GET | /calendar?studentId=X | Séances d'un élève | 🔒 |
| GET | /calendar/:id | Détail d'une séance | 🔒 |
| PATCH | /calendar/:id | Modifier une séance | 🔒 |
| DELETE | /calendar/:id | Supprimer une séance | 🔒 |

---

## video-session-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /video/rooms | Créer une salle vidéo | 🔒 |
| GET | /video/rooms/:id | Info d'une salle | 🔒 |
| POST | /video/rooms/:id/join | Rejoindre la salle | 🔒 |
| POST | /video/rooms/:id/end | Terminer la session | 🔒 |

---

## communication-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /messages | Envoyer un message | 🔒 |
| GET | /messages/conversation/:id | Messages d'une conversation | 🔒 |
| PATCH | /messages/:id/read | Marquer comme lu | 🔒 |

---

## pedagogical-log-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /logs | Créer un log | 🔒 |
| GET | /logs/student/:studentId | Logs d'un élève | 🔒 |
| GET | /logs/session/:sessionId | Logs d'une séance | 🔒 |
| GET | /logs/:id | Détail d'un log | 🔒 |

---

## notification-dashboard-service

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| POST | /notifications | Créer une notification | 🔒 |
| GET | /notifications/user/:userId | Notifications d'un utilisateur | 🔒 |
| PATCH | /notifications/:id/read | Marquer comme lue | 🔒 |
| PATCH | /notifications/user/:userId/read-all | Tout marquer comme lu | 🔒 |
| DELETE | /notifications/:id | Supprimer une notification | 🔒 |

---

## Health checks (non authentifié)

Chaque service expose `GET /health` → `{status: "ok", service: "...", timestamp: "..."}`
