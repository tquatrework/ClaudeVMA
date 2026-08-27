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

# Point de montage du volume `pedagogical_log_media` (pieces jointes du
# cahier de texte), CREE ICI et donne a l'utilisateur `node`.
#
# Sans cette ligne, Docker cree le point de montage lui-meme au premier
# demarrage, en root et en 0755 — alors que le conteneur tourne en `node`
# (uid 1000). Le service demarre, sert tout le reste normalement, et echoue au
# premier televersement sur un `EACCES: permission denied`. Quand le volume
# nomme est vide, Docker recopie le proprietaire et les droits du repertoire
# de l'image : le creer ici suffit donc a initialiser le volume correctement.
# Meme correctif que services/profile-service/Dockerfile pour `media_data`.
RUN mkdir -p /app/storage/media /app/storage/memo-images && chown -R node:node /app/storage

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1
CMD ["node", "dist/src/main"]
