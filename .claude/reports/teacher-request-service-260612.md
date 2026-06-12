# teacher-request-service — Rapport BUG-008 — 2026-06-12

## Objet
Correction de la faille de sécurité BUG-008 : suppression du fallback JWT secret `dev-secret`.

## Fichiers modifiés

### `services/teacher-request-service/src/common/jwt.guard.ts`
- Ligne ~35 : remplacement de `config.get<string>('JWT_SECRET', 'dev-secret')` par `config.get<string>('JWT_SECRET')`.
- Ajout immédiat après : `if (!secret) throw new Error('JWT_SECRET environment variable is required');`
- L'erreur est lancée dans le bloc `try`, ce qui provoquera une `UnauthorizedException` pour toute tentative d'utilisation sans secret défini.

### `services/teacher-request-service/src/teacher-request/teacher-request.module.ts`
- La `useFactory` de `JwtModule.registerAsync` est convertie de flèche implicite en corps de fonction explicite.
- `config.get<string>('JWT_SECRET', 'dev-secret')` remplacé par `config.get<string>('JWT_SECRET')`.
- Vérification ajoutée : `if (!secret) throw new Error('JWT_SECRET environment variable is required');` — lancée au démarrage du module si `JWT_SECRET` est absent ou vide, empêchant le service de démarrer sans secret valide.

## Résultat
Le service ne peut plus démarrer ni valider de JWT si `JWT_SECRET` n'est pas défini dans l'environnement. Le fallback `dev-secret` (valeur publiquement connue) est entièrement supprimé des deux points d'entrée.

## Points en suspens
Aucun. Aucune autre modification effectuée.
