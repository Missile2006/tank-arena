# Stage 1: build the browser and bundled server.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
RUN npm ci
COPY client ./client
COPY server ./server
COPY shared ./shared
RUN npm run build -w tank-arena-client \
 && npm run build -w tank-arena-server

# Stage 2: resolve production dependencies with npm in a throwaway stage.
FROM node:24-alpine AS production-deps
WORKDIR /app
COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
RUN npm ci --omit=dev && npm cache clean --force

# Stage 3: strip unneeded symbols from the Node binary in a disposable stage.
# Keep the unmodified binary in the previous backup for easy rollback.
FROM node:24-alpine AS compact-node
RUN apk add --no-cache binutils \
 && cp /usr/local/bin/node /tmp/node \
 && strip --strip-unneeded /tmp/node \
 && /tmp/node --version

# Stage 4: minimal runtime. No npm, yarn, or build toolchain.
# Keep Alpine 3.24 aligned with node:24-alpine's Alpine release.
FROM alpine:3.24 AS runtime
ARG GIT_SHA=local
RUN apk add --no-cache libstdc++ \
 && addgroup -S -g 1000 node \
 && adduser -S -D -H -u 1000 -G node node \
 && mkdir -p /app/server/logs \
 && chown 1000:1000 /app/server/logs
WORKDIR /app
ENV GIT_SHA=${GIT_SHA} \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    LOG_DIR=/app/server/logs
COPY --from=compact-node /tmp/node /usr/local/bin/node
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/dist ./server/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
