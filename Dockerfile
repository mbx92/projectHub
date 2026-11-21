# OCN Project Hub — image produksi untuk Coolify (Nuxt 4 + PostgreSQL).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=4044 \
    NUXT_STORAGE_DIR=/data/storage
WORKDIR /app
# node_modules penuh dipertahankan agar migrasi & seed (tsx) bisa jalan saat start.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/server/database ./server/database
COPY --from=build /app/shared ./shared
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && mkdir -p /data/storage && chown -R node:node /app /data
USER node
VOLUME ["/data/storage"]
EXPOSE 4044
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4044/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
