#!/usr/bin/env pwsh
# Docker Preparation Script for Windows
# Ensures all required directories exist with proper permissions

Write-Host "Preparing Docker environment..." -ForegroundColor Cyan

# Define storage directories
$storageBase = "app/storage"
$directories = @(
    "$storageBase/database",
    "$storageBase/uploads",
    "$storageBase/media",
    "$storageBase/thumbnails",
    "$storageBase/temp",
    "$storageBase/logs"
)

# Create directories if they don't exist
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "Created: $dir" -ForegroundColor Green
    } else {
        Write-Host "Exists: $dir" -ForegroundColor Gray
    }
}

# Set permissions (Everyone - Full Control) for storage directories
Write-Host ""
Write-Host "Setting permissions..." -ForegroundColor Cyan
try {
    $acl = Get-Acl $storageBase
    $permission = "Everyone", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
    $acl.SetAccessRule($accessRule)
    Set-Acl $storageBase $acl
    Write-Host "Permissions set for $storageBase" -ForegroundColor Green
} catch {
    Write-Host "Could not set permissions: $_" -ForegroundColor Yellow
    Write-Host "This may cause issues in Docker. Try running as Administrator." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Docker preparation complete!" -ForegroundColor Green
Write-Host "You can now run: docker-compose up -d" -ForegroundColor Cyan
