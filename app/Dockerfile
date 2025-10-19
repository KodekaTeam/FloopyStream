# Use Node.js LTS as base image
FROM node:18-slim

# Set locale to prevent encoding issues
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Install system dependencies in a single layer
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    make \
    g++ \
    sqlite3 \
    ca-certificates \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && ffmpeg -version | head -1 \
    && echo "✓ FFmpeg installed successfully"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
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
