# Use Node.js LTS as base image
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    ffmpeg \
    python3 \
    make \
    g++ \
    sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Create required directories with proper permissions
RUN mkdir -p storage/database storage/uploads storage/media storage/thumbnails storage/temp storage/logs && \
    chmod -R 777 storage

# NOTE: Running as root in development for simplicity with bind mounts
# For production, uncomment the line below and ensure proper volume permissions
# USER node

# Expose port
EXPOSE 6060

# Set environment variables
ENV NODE_ENV=production
ENV PORT=6060

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:6060 || exit 1

# Start application
CMD ["npm", "start"]
