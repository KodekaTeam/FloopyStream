#!/bin/bash
# Docker Preparation Script for Linux/Mac
# Ensures all required directories exist with proper permissions

echo "🔧 Preparing Docker environment..."

# Define storage directories
STORAGE_BASE="app/storage"
DIRECTORIES=(
    "$STORAGE_BASE/database"
    "$STORAGE_BASE/uploads"
    "$STORAGE_BASE/media"
    "$STORAGE_BASE/thumbnails"
    "$STORAGE_BASE/temp"
    "$STORAGE_BASE/logs"
)

# Create directories if they don't exist
for dir in "${DIRECTORIES[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo "✓ Created: $dir"
    else
        echo "✓ Exists: $dir"
    fi
done

# Set permissions (755 for directories, will be accessible by node user in container)
echo ""
echo "🔐 Setting permissions..."
chmod -R 755 "$STORAGE_BASE"
echo "✓ Permissions set for $STORAGE_BASE"

echo ""
echo "✅ Docker preparation complete!"
echo "You can now run: docker-compose up -d"
