param(
    [string]$DbPath = "./storage/database/floopystream.db",
    [string]$BackupDir = "./storage/database/backups"
)

# Ensure paths are normalized
$DbFull = Resolve-Path -Path $DbPath
$BackupDirFull = Resolve-Path -Path $BackupDir -ErrorAction SilentlyContinue
if (-not $BackupDirFull) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    $BackupDirFull = Resolve-Path -Path $BackupDir
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dest = Join-Path $BackupDirFull "floopystream.db.$timestamp"

Write-Host "Backing up $($DbFull) -> $dest"
Copy-Item -Path $DbFull -Destination $dest -Force
if ($?) { Write-Host "Backup completed: $dest" } else { Write-Error "Backup failed" }
