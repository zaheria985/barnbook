# ---- Dependencies ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Build ----
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

# ---- Runtime ----
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3500
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./

# Uploads live here and are backed by the barnbook_uploads volume. The directory
# must exist with nextjs ownership in the image: Docker seeds a fresh named volume
# from the image path, so a missing path would yield a root-owned volume the app
# (uid 1001) cannot write to.
RUN mkdir -p ./public/uploads/horse-photos \
             ./public/uploads/event-attachments \
             ./public/uploads/vet-receipts && \
    chown -R nextjs:nodejs ./public/uploads
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/db ./db

# Runtime dependencies not traced by standalone (server-side requires)
COPY --from=build --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=build --chown=nextjs:nodejs /app/node_modules/next-auth ./node_modules/next-auth
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@panva ./node_modules/@panva
COPY --from=build --chown=nextjs:nodejs /app/node_modules/cookie ./node_modules/cookie
COPY --from=build --chown=nextjs:nodejs /app/node_modules/jose ./node_modules/jose
COPY --from=build --chown=nextjs:nodejs /app/node_modules/oauth ./node_modules/oauth
COPY --from=build --chown=nextjs:nodejs /app/node_modules/openid-client ./node_modules/openid-client
COPY --from=build --chown=nextjs:nodejs /app/node_modules/uuid ./node_modules/uuid
COPY --from=build --chown=nextjs:nodejs /app/node_modules/lru-cache ./node_modules/lru-cache
COPY --from=build --chown=nextjs:nodejs /app/node_modules/object-hash ./node_modules/object-hash
COPY --from=build --chown=nextjs:nodejs /app/node_modules/oidc-token-hash ./node_modules/oidc-token-hash
COPY --from=build --chown=nextjs:nodejs /app/node_modules/preact ./node_modules/preact
COPY --from=build --chown=nextjs:nodejs /app/node_modules/preact-render-to-string ./node_modules/preact-render-to-string

USER nextjs
EXPOSE 3500

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3500/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["sh", "-c", "node db/bootstrap.js && node db/migrate.js && node server.js"]
