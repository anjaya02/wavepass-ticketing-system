# Production Dockerfile for WavePass Backend API
FROM node:22-alpine AS base

# Install security updates and dumb-init for clean PID 1 signal handling
RUN apk add --no-cache dumb-init

WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source files
COPY . .

# Ensure app directory is owned by non-root user
RUN chown -R node:node /usr/src/app

USER node

EXPOSE 5000

ENV PORT=5000 \
    NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) process.exit(1)})"

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
