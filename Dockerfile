# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY .npmrc* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --no-audit

# Copy source code and config files
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install production system dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S golden-tap -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --no-audit && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create required directories
RUN mkdir -p logs uploads && \
    chown -R golden-tap:nodejs /app

# Switch to non-root user
USER golden-tap

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/server.js"]
