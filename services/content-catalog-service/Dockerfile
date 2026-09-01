FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

# Point de montage du volume `content_catalog_exercise_images` (images des
# blocs et solutions d'Exercice, refonte du 2026-08-29), CREE ICI et donne a
# l'utilisateur `node`.
#
# Sans cette ligne, Docker cree le point de montage lui-meme au premier
# demarrage, en root et en 0755 — alors que le conteneur tourne en `node`
# (uid 1000). Le service demarre, sert tout le reste normalement, et echoue au
# premier televersement sur un `EACCES: permission denied`. Quand le volume
# nomme est vide, Docker recopie le proprietaire et les droits du repertoire
# de l'image : le creer ici suffit donc a initialiser le volume correctement.
# Meme correctif que services/profile-service/Dockerfile (`media_data`) et
# services/pedagogical-log-service/Dockerfile (`pedagogical_log_media` /
# `pedagogical_log_memo_images`) — oublie lors de l'introduction du volume par
# la PR #184, corrige ici (2026-09-01).
RUN mkdir -p /app/storage/exercise-images && chown -R node:node /app/storage

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1
CMD ["node", "dist/src/main"]
