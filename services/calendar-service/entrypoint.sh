#!/bin/sh
set -e

# Applique les migrations en attente avant de démarrer le service.
# Les migrations sont écrites idempotentes (IF NOT EXISTS / IF EXISTS) et
# TypeORM tient de toute façon le journal `calendar_service_migrations` : un
# redémarrage du conteneur ne rejoue rien.
#
# Un échec de migration doit empêcher le démarrage (set -e) : servir l'API sur
# un schéma incomplet produirait des 500 diffus au lieu d'un échec net.
echo "[calendar-service] application des migrations..."
node ./node_modules/typeorm/cli.js -d dist/src/data-source.js migration:run

echo "[calendar-service] démarrage de l'application..."
exec node dist/src/main
