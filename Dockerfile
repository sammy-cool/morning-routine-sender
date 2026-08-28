# ==========================================
# Stage 1: Build / Dependency Resolution
# ==========================================
FROM node:20-alpine AS dependencies

WORKDIR /app

# Set build-time environment
ENV NODE_ENV=production

# Install build dependencies for any native addons if needed
RUN apk add --no-cache python3 make g++

# Copy package definitions for cached layer resolution
COPY package*.json ./

# Clean production dependency install without development packages
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ==========================================
# Stage 2: Final Production Runner
# ==========================================
FROM node:20-alpine AS runner

LABEL maintainer="Morning Routine Sender Team" \
      description="Automated morning routine email sender service" \
      version="1.0.0"

# Install dumb-init for proper PID 1 signal forwarding and zombie process reaping,
# plus wget/curl for robust health checks
RUN apk add --no-cache dumb-init curl wget

# Set production environment variables
ENV NODE_ENV=production \
    PORT=2900

WORKDIR /app

# Pre-create application and log directories with non-root node ownership
RUN mkdir -p /app/logs && chown -R node:node /app

# Copy production node_modules from dependency stage
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules

# Copy application source code
COPY --chown=node:node . .

# Switch to the non-privileged default 'node' user
USER node

# Expose the application port
EXPOSE 2900

# Container-level health check polling the express health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:2900/health || exit 1

# dumb-init handles process signals (SIGTERM, SIGINT) and child process reaping
ENTRYPOINT ["dumb-init", "--"]

# Launch application
CMD ["node", "index.js"]
