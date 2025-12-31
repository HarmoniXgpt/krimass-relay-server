# KRIMASS Relay Server - Production Dockerfile
FROM node:18-alpine

# Metadata
LABEL maintainer="KRIXAIR <krimass@krixair.com>"
LABEL description="KRIMASS Zero-Knowledge Relay Server"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build || echo "No build script - using ts-node"

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start server
CMD ["npm", "start"]

# ✅ BUILD & RUN:
# docker build -t krimass-relay .
# docker run -d -p 3000:3000 --name krimass krimass-relay
