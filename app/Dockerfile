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

# Create required directories
RUN mkdir -p storage/database storage/uploads storage/media storage/thumbnails storage/temp storage/logs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080 || exit 1

# Start application
CMD ["npm", "start"]
