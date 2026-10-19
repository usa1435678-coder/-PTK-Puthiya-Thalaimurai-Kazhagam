# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build native dependencies (sqlite3) from source.
# The published sqlite3 prebuilt binaries target a newer glibc than the Alpine
# image provides, so we compile the native addon against the container's own
# toolchain. This keeps the image self-contained and reproducible.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
# npm_config_build_from_source forces prebuild-install to skip the download and
# fall back to `node-gyp rebuild`, compiling sqlite3 for this exact platform.
RUN npm_config_build_from_source=true npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 2: minimal runtime image.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# libstdc++ is required by the compiled sqlite3 native addon at runtime.
RUN apk add --no-cache libstdc++

COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Persistent data lives on a mounted disk in production (see render.yaml).
RUN mkdir -p /var/data/backups /var/data/uploads

EXPOSE 3000
CMD ["node", "server.js"]
