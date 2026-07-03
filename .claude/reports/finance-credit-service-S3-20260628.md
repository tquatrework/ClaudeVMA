# Audit S3 — finance-credit-service — Identifiants utilisateur dans l'URL

Date : 2026-06-28
Service : finance-credit-service
Perimetre : Verification que les parametres ID utilisateur dans l'URL sont compares avec req.user.id ou un role interne dans la couche service.

Statut global : OK — Aucune faille detectee

Tous les endpoints avec parametre ID utilisateur dans l'URL effectuent la verification contextuelle attendue dans la couche service.

Tableau des endpoints :

FinancialProfilesController GET /financial-profiles/:ownerId
  - Parametre URL : ownerId
  - Verification service : assertCanRead → requesterId === ownerId OU role AF/RP/TI
  - Statut : OK

FinancialProfilesController PATCH /financial-profiles/:ownerId
  - Parametre URL : ownerId
  - Verification service : assertCanWrite → requesterId === ownerId OU role AF/TI
  - Statut : OK

FinancialArchivesController GET /financial-archives/:ownerId
  - Parametre URL : ownerId
  - Verification service : assertCanRead → requesterId === ownerId OU role AF/RP/TI
  - Statut : OK

TeacherPaymentRequestsController GET /teacher-payment-requests/by-teacher/:teacherId
  - Parametre URL : teacherId
  - Verification service : assertCanRead → requesterId === teacherId OU role AF/RP/TI
  - Statut : OK

TeacherPaymentRequestsController POST /teacher-payment-requests/:id/validate
  - Parametre URL : id (UUID de la demande, pas d'un utilisateur)
  - Verification service : reviewerRole === AF uniquement
  - Statut : OK (param n'est pas un ID utilisateur)

PaymentsController POST /payments
  - Parametre URL : aucun
  - Verification service : ownerId = req.user.id direct
  - Statut : OK

InternalController POST /internal/check-payment-status/:ownerId
  - Parametre URL : ownerId
  - Protection : InternalSecretGuard (X-Internal-Secret) — route inter-services non exposee publiquement
  - Statut : OK

Conclusion : Le service applique correctement le pattern de controle contextuel partout. Aucune correction necessaire.
