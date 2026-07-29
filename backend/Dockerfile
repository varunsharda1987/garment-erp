# ==================================
# Multi-stage Dockerfile for Backend
# ==================================

# Stage 1: Build
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema BEFORE install: the `postinstall` script runs `prisma generate`,
# which needs prisma/schema.prisma to already be present, or it fails with
# "Could not find Prisma Schema".
COPY prisma ./prisma

# Install dependencies (including devDependencies for build); postinstall generates the client
RUN npm ci

# Ensure the client is generated (idempotent; explicit for clarity)
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ==================================
# Stage 2: Production
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema BEFORE install (postinstall runs `prisma generate`, which needs the schema)
COPY prisma ./prisma

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Ensure the client is generated (idempotent; explicit for clarity)
RUN npx prisma generate

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy necessary files
COPY --from=builder /app/src ./src

# Create logs directory with proper permissions
RUN mkdir -p logs uploads && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/server.js"]
