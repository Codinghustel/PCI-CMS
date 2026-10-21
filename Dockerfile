# Production image for PCI-Orbit (Next.js 16 + Prisma 7, Node.js 24).
#
# The database must be reachable while building: migrations are applied and the
# published pages are prerendered by `next build`. Pass DATABASE_URL and
# AUTH_SECRET as build arguments (Dokploy: Environment → Build-time Arguments)
# as well as runtime environment variables.
#
# Uploaded media lives in /app/storage — mount a persistent volume there.

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ARG DATABASE_URL
ARG AUTH_SECRET
ARG NEXT_PUBLIC_SITE_URL
ARG SITE_ENV=production
ENV DATABASE_URL=$DATABASE_URL \
    AUTH_SECRET=$AUTH_SECRET \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    SITE_ENV=$SITE_ENV \
    NEXT_TELEMETRY_DISABLED=1

# `postinstall` runs `prisma generate`, which needs the schema and config.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma/schema.prisma prisma/schema.prisma
COPY prisma/migrations prisma/migrations
RUN npm ci

COPY . .
RUN npx prisma migrate deploy
ENV NODE_ENV=production
RUN npm run build


FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/storage/public \
    PRIVATE_UPLOAD_DIR=/app/storage/private

COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/storage/public /app/storage/private && chown -R node:node /app/storage

USER node
EXPOSE 3000
VOLUME ["/app/storage"]

# Apply any pending migrations (no-op when up to date), then serve.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p ${PORT}"]
