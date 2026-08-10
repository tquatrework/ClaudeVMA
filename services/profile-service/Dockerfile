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
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Point de montage du volume `media_data` (photos de profil), CRÉÉ ICI et
# donné à l'utilisateur `node`.
#
# Sans cette ligne, Docker crée le point de montage lui-même au premier
# démarrage, en root et en 0755 — alors que le conteneur tourne en `node`
# (uid 1000). Le service démarre, sert tout le reste normalement, et échoue au
# premier téléversement sur un `EACCES: permission denied, mkdir`. Quand le
# volume nommé est vide, Docker recopie le propriétaire et les droits du
# répertoire de l'image : le créer ici suffit donc à initialiser le volume
# correctement.
RUN mkdir -p /app/storage/media && chown -R node:node /app/storage

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1
CMD ["/app/entrypoint.sh"]
