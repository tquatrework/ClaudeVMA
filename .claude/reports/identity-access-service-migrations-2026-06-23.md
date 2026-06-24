# identity-access-service — Migration Investigation Report
**Date:** 2026-06-23
**Status:** CRITICAL — Migration non appliquée — crash en boucle en production

---

## 1. Comment les migrations sont-elles lancées au démarrage Docker ?

Elles ne le sont PAS.

Le Dockerfile se termine par :
  CMD ["node", "dist/src/main"]

Il n'y a aucun entrypoint.sh qui appelle typeorm migration:run avant le démarrage.
docker-compose.yml ne définit pas de command: pour ce service.
Le package.json ne contient aucun script migration:run ni commande typeorm CLI.

---

## 2. Les fichiers de migration sont-ils inclus dans l'image compilée ?

OUI. Les fichiers .js compilés sont présents dans dist/ :
- Source : src/migrations/1750000000000-AddLoginIdentifier.ts
- Compilé : dist/src/migrations/1750000000000-AddLoginIdentifier.js

Ils sont copiés via COPY --from=builder /app/dist ./dist dans le Dockerfile.
Ce n'est PAS un problème de build.

---

## 3. Le DataSource pointe-t-il sur visiomath_identity_access ?

OUI. La config dans app.module.ts lit DATABASE_URL depuis l'environnement.
docker-compose.yml l'injecte :
  DATABASE_URL: postgresql://visiomath:***@postgres:5432/visiomath_identity_access

La base cible est bien visiomath_identity_access.

---

## 4. Historique des migrations en base

La table migrations n'existe PAS dans visiomath_identity_access :
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migrations');
  => f (false)

TypeORM n'a jamais été utilisé en mode "migrations" sur cette base.
La colonne login_identifier est absente de la table users (vérifiée via \d users).

Les logs du conteneur visiomath_identity_access montrent la tentative de synchronize qui échoue :
  query: ALTER TABLE "users" ADD "login_identifier" character varying(100) NOT NULL
  query failed: ... column "login_identifier" of relation "users" contains null values
  query: ROLLBACK

---

## 5. Ce que fait la migration

La migration 1750000000000-AddLoginIdentifier effectue 5 étapes dans up() :
1. Ajoute login_identifier VARCHAR(100) NULL (nullable en premier)
2. Peuple la colonne depuis l'email de chaque utilisateur (partie locale, normalisée,
   déduplication avec suffixe .2/.3... par ordre created_at ASC)
3. Passe la colonne en NOT NULL
4. Crée l'index unique UQ_users_login_identifier
5. Supprime la contrainte UNIQUE sur email (détectée dynamiquement)

Le down() est l'inverse : réajoute UNIQUE sur email, supprime l'index, supprime la colonne.

---

## 6. Cause racine

DOUBLE PROBLÈME :

Problème A — synchronize: true en développement a créé le schéma SANS migrations.
  app.module.ts : synchronize: config.get('NODE_ENV') !== 'production'
  En dev, TypeORM a créé les tables directement depuis les entités, sans jamais
  enregistrer de migration. La table migrations n'existe donc pas.

Problème B — En production, synchronize est false, mais aucun migration:run n'est appelé.
  TypeORM détecte l'écart entité/schéma et tente un ALTER TABLE direct, qui échoue
  car la colonne login_identifier est NOT NULL sans valeur par défaut ni peuplement
  préalable. La migration elle-même gère ce cas correctement (étapes 1-2-3), mais
  elle n'est jamais invoquée.

---

## Commandes pour appliquer la migration sans perte de données

Exécuter dans l'ordre (5 étapes atomiques sur la base existante) :

ETAPE 1 — Ajouter la colonne nullable :
  docker exec visiomath_postgres psql -U visiomath -d visiomath_identity_access -c \
    'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_identifier" VARCHAR(100);'

ETAPE 2 — Peupler depuis email :
  docker exec visiomath_postgres psql -U visiomath -d visiomath_identity_access << 'SQL'
  DO $$
  DECLARE
    rec RECORD;
    base_id VARCHAR(100);
    candidate_id VARCHAR(100);
    counter INTEGER;
  BEGIN
    FOR rec IN SELECT id, email FROM "users" WHERE "login_identifier" IS NULL ORDER BY "created_at" ASC
    LOOP
      base_id := LOWER(SPLIT_PART(rec.email, '@', 1));
      base_id := REGEXP_REPLACE(base_id, '[^a-z0-9.\-]', '.', 'g');
      base_id := REGEXP_REPLACE(base_id, '\.{2,}', '.', 'g');
      base_id := TRIM(BOTH '.' FROM base_id);
      IF base_id = '' THEN base_id := 'user'; END IF;
      candidate_id := base_id;
      counter := 1;
      WHILE EXISTS (SELECT 1 FROM "users" WHERE "login_identifier" = candidate_id) LOOP
        counter := counter + 1;
        candidate_id := base_id || '.' || counter::TEXT;
      END LOOP;
      UPDATE "users" SET "login_identifier" = candidate_id WHERE id = rec.id;
    END LOOP;
  END;
  $$;
  SQL

ETAPE 3 — Passer en NOT NULL :
  docker exec visiomath_postgres psql -U visiomath -d visiomath_identity_access -c \
    'ALTER TABLE "users" ALTER COLUMN "login_identifier" SET NOT NULL;'

ETAPE 4 — Créer l'index unique :
  docker exec visiomath_postgres psql -U visiomath -d visiomath_identity_access -c \
    'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_login_identifier" ON "users" ("login_identifier");'

ETAPE 5 — Supprimer la contrainte UNIQUE sur email :
  docker exec visiomath_postgres psql -U visiomath -d visiomath_identity_access << 'SQL'
  DO $$
  DECLARE cname TEXT;
  BEGIN
    SELECT tc.constraint_name INTO cname
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'users' AND tc.constraint_type = 'UNIQUE' AND kcu.column_name = 'email';
    IF cname IS NOT NULL THEN
      EXECUTE 'ALTER TABLE "users" DROP CONSTRAINT "' || cname || '"';
    END IF;
  END;
  $$;
  SQL

ETAPE 6 — Redémarrer le service :
  docker restart visiomath_identity_access

---

## Corrections long terme recommandées

1. Ajouter un entrypoint.sh qui appelle typeorm migration:run avant node dist/src/main
2. Ajouter src/data-source.ts (DataSource dédié à la CLI TypeORM) et un script npm migration:run
3. Ne pas utiliser synchronize:true si la base est partagée/persistante même en dev
4. Ou : activer migrationsRun: true dans la config TypeORM de app.module.ts (avec migrations: [...])
