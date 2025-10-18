# FLoopyStream Docker Helper Script for Windows PowerShell
# Usage: .\docker-helper.ps1 -Command [command]

param(
    [string]$Command = "help"
)

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = "docker-compose.yml"
$EnvFile = ".env"

# Set working directory
Set-Location $ProjectDir

# Color functions
function Write-Header {
    param([string]$Message)
    Write-Host "`n=================================================="  -ForegroundColor Green
    Write-Host $Message -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

# Command functions
function Cmd-Help {
    $helpText = @"
`n
================================================== 
 FLoopyStream - Docker Helper
==================================================

Usage: .\docker-helper.ps1 -Command [command]

Commands:
    up              Build and start all services
    down            Stop and remove containers
    logs            Show logs from all services
    logs-app        Show logs from app service
    logs-redis      Show logs from redis service
    ps              Show container status
    shell           Enter app container shell
    redis-cli       Connect to Redis CLI
    restart         Restart all services
    rebuild         Rebuild images and start
    clean           Remove containers and volumes
    backup-db       Backup database
    restore-db      Restore database from backup
    status          Show detailed status
    help            Show this help message

"@
    Write-Host $helpText
}

function Cmd-Up {
    Write-Header "Starting FLoopyStream Services"
    
    if (-not (Test-Path $EnvFile)) {
        Write-Info "Creating $EnvFile from .env.docker..."
        Copy-Item ".env.docker" $EnvFile
    }
    
    docker-compose up -d
    Write-Success "Services started!"
    Cmd-Status
}

function Cmd-Down {
    Write-Header "Stopping FLoopyStream Services"
    docker-compose down
    Write-Success "Services stopped!"
}

function Cmd-Logs {
    docker-compose logs -f
}

function Cmd-Logs-App {
    docker-compose logs -f app
}

function Cmd-Logs-Redis {
    docker-compose logs -f redis
}

function Cmd-Ps {
    docker-compose ps
}

function Cmd-Shell {
    Write-Info "Entering app container shell..."
    docker-compose exec app sh
}

function Cmd-Redis-Cli {
    Write-Info "Connecting to Redis CLI..."
    docker-compose exec redis redis-cli
}

function Cmd-Restart {
    Write-Header "Restarting Services"
    docker-compose restart
    Write-Success "Services restarted!"
    Cmd-Status
}

function Cmd-Rebuild {
    Write-Header "Rebuilding and Starting Services"
    docker-compose down
    docker-compose up -d --build
    Write-Success "Services rebuilt and started!"
    Cmd-Status
}

function Cmd-Clean {
    Write-Header "Cleaning Up Docker Resources"
    $response = Read-Host "This will remove containers, images, and volumes. Continue? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        docker-compose down -v
        Write-Success "Cleanup complete!"
    }
    else {
        Write-Info "Cleanup cancelled."
    }
}

function Cmd-Backup-Db {
    Write-Header "Backing Up Database"
    $BackupDir = "$ProjectDir\backup"
    $null = New-Item -ItemType Directory -Path $BackupDir -Force
    
    $BackupFile = "$BackupDir\database-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').tar.gz"
    
    docker-compose exec -T app tar czf - /app/storage/database | Out-File -Encoding Byte $BackupFile
    Write-Success "Database backed up to: $BackupFile"
}

function Cmd-Restore-Db {
    Write-Header "Restoring Database"
    $BackupDir = "$ProjectDir\backup"
    
    if (-not (Test-Path $BackupDir) -or (Get-ChildItem "$BackupDir\database-backup-*.tar.gz" -ErrorAction SilentlyContinue).Count -eq 0) {
        Write-Error-Custom "No backups found in $BackupDir"
        return
    }
    
    Write-Host "`nAvailable backups:" -ForegroundColor Yellow
    $backups = Get-ChildItem "$BackupDir\database-backup-*.tar.gz" | Sort-Object LastWriteTime -Descending
    $backups | ForEach-Object { Write-Host "  [$(1+$backups.IndexOf($_))]  $($_.Name)  -  $(Get-Date $_.LastWriteTime -Format 'yyyy-MM-dd HH:mm:ss')" }
    
    $backupNum = Read-Host "`nEnter backup number to restore"
    $BackupFile = $backups[$backupNum - 1]
    
    if ($null -eq $BackupFile) {
        Write-Error-Custom "Invalid selection"
        return
    }
    
    $response = Read-Host "`nThis will overwrite current database. Continue? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        docker-compose exec -T app sh -c "rm -rf /app/storage/database && mkdir -p /app/storage/database"
        
        # Extract and restore
        $tempDir = "$env:TEMP\floopystream-restore"
        $null = New-Item -ItemType Directory -Path $tempDir -Force
        
        # Using 7zip or tar if available
        if (Get-Command tar -ErrorAction SilentlyContinue) {
            tar -xzf $BackupFile -C $tempDir
        }
        else {
            Write-Error-Custom "tar command not found. Please install Windows tar support."
            return
        }
        
        Write-Success "Database restored!"
    }
}

function Cmd-Status {
    Write-Header "Service Status"
    
    Write-Host "`nContainer Status:" -ForegroundColor Yellow
    docker-compose ps
    
    Write-Host "`nApplication URL:" -ForegroundColor Yellow
    Write-Host "  http://localhost:8080"
    
    try {
        Write-Host "`nRedis Info:" -ForegroundColor Yellow
        docker-compose exec redis redis-cli info server | Select-Object -First 5
    }
    catch {
        Write-Host "  Redis not available" -ForegroundColor Gray
    }
}

# Main command dispatcher
switch ($Command) {
    "up" { Cmd-Up }
    "down" { Cmd-Down }
    "logs" { Cmd-Logs }
    "logs-app" { Cmd-Logs-App }
    "logs-redis" { Cmd-Logs-Redis }
    "ps" { Cmd-Ps }
    "shell" { Cmd-Shell }
    "redis-cli" { Cmd-Redis-Cli }
    "restart" { Cmd-Restart }
    "rebuild" { Cmd-Rebuild }
    "clean" { Cmd-Clean }
    "backup-db" { Cmd-Backup-Db }
    "restore-db" { Cmd-Restore-Db }
    "status" { Cmd-Status }
    "help" { Cmd-Help }
    default {
        Write-Error-Custom "Unknown command: $Command"
        Cmd-Help
        exit 1
    }
}
