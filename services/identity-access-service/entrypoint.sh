#!/bin/sh
set -e

echo '[entrypoint] Running TypeORM migrations...'
node ./node_modules/typeorm/cli.js -d dist/src/data-source.js migration:run

echo '[entrypoint] Starting application...'
exec node dist/src/main
