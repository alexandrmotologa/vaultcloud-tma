# Multi-stage Dockerfile for VaultCloud TMA
# Stage 1: Build Web Client
FROM node:22-alpine AS web-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/
COPY server/package.json ./server/
RUN npm ci --workspace=web

COPY web/ ./web/
RUN npm run build --workspace=web

# Stage 2: Build Server Backend
FROM node:22-alpine AS server-builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci --workspace=server

COPY server/ ./server/
RUN npm run build --workspace=server

# Stage 3: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DEMO_MODE=true
ENV DATABASE_PATH=/data/vaultcloud.db

# Create persistent storage directory
RUN mkdir -p /data

# Copy built server and node_modules
COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --omit=dev --workspace=server

COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=web-builder /app/web/dist ./web/dist

EXPOSE 8080

CMD ["node", "server/dist/index.js"]
