# Garment ERP Frontend - Production Dockerfile
# Optimized for Synology DS923+ (AMD64 architecture)

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for API URL
ARG VITE_API_URL=http://localhost:5000

# Set environment for build
ENV VITE_API_URL=$VITE_API_URL

# Build the frontend (skip TypeScript check, use Vite directly)
RUN npx vite build

# Production stage - Nginx
FROM nginx:alpine AS production

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration (full nginx.conf, not just server block)
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
