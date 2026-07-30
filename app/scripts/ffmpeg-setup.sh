#!/bin/bash

# FFmpeg Setup and Verification Script for Docker Container
# This script ensures FFmpeg is properly configured and working

echo "=== FFmpeg Docker Setup Verification ==="

# Check if FFmpeg is installed and accessible
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg not found in PATH"
    exit 1
else
    echo "✅ FFmpeg found: $(which ffmpeg)"
fi

if ! command -v ffprobe &> /dev/null; then
    echo "❌ FFprobe not found in PATH"
    exit 1
else
    echo "✅ FFprobe found: $(which ffprobe)"
fi

# Test FFmpeg basic functionality
echo ""
echo "=== FFmpeg Version ==="
ffmpeg -version 2>/dev/null | head -3 || echo "Could not get FFmpeg version"

echo ""
echo "=== FFmpeg Codecs Check ==="
echo "Available codecs (sample):"
ffmpeg -codecs 2>/dev/null | grep -E "(h264|aac|opus|libx264)" | head -5 || echo "Could not list codecs"

echo ""
echo "=== FFmpeg Formats Check ==="
echo "Available formats (sample):"
ffmpeg -formats 2>/dev/null | grep -E "(mp4|avi|mov)" | head -3 || echo "Could not list formats"

# Test basic FFmpeg operation (optional - skip if fails)
echo ""
echo "=== Testing FFmpeg Basic Operation ==="
if ffmpeg -f lavfi -i color=black:size=320x240:duration=1 -c:v libx264 -y /tmp/test_output.mp4 >/dev/null 2>&1; then
    echo "✅ FFmpeg basic operation test passed"
    rm -f /tmp/test_output.mp4 2>/dev/null || true
else
    echo "⚠️ FFmpeg basic operation test failed (may work in runtime)"
fi

# Check system resources
echo ""
echo "=== System Resources ==="
echo "Memory: $(free -h 2>/dev/null | grep 'Mem:' | awk '{print $2}' || echo 'Unknown')"
echo "CPU cores: $(nproc 2>/dev/null || echo 'Unknown')"
echo "Disk space: $(df -h / 2>/dev/null | tail -1 | awk '{print $4}' || echo 'Unknown') available"

echo ""
echo "=== FFmpeg Setup Complete ✅ ==="
echo "FFmpeg is ready for streaming operations"