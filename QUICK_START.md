# ✅ Docker Setup Checklist

## Verifikasi File yang Sudah Dibuat

- ✅ `docker-compose.yml` - Main orchestration file (PORT: 6060, Resource limits)
- ✅ `docker-compose.override.yml` - Development overrides
- ✅ `.env.docker` - Environment template dengan resource configuration
- ✅ `.env.example.docker` - Commented environment example
- ✅ `app/Dockerfile` - Container image definition
- ✅ `app/.dockerignore` - Build exclusions
- ✅ `docker-helper.sh` - Helper script (Linux/Mac)
- ✅ `docker-helper.ps1` - Helper script (Windows PowerShell)
- ✅ `docker-check.sh` - Verification script (Linux/Mac)
- ✅ `docker-check.ps1` - Verification script (Windows PowerShell)
- ✅ `DOCKER_README.md` - Quick start guide
- ✅ `DOCKER_SETUP.md` - Detailed setup documentation
- ✅ `RESOURCE_CONFIG.md` - Resource management guide
- ✅ `UPDATE_SUMMARY.md` - Changes summary

## Port Configuration

| Component | Port | URL                   |
| --------- | ---- | --------------------- |
| App       | 6060 | http://localhost:6060 |
| Redis     | 6379 | localhost:6379        |

## Resource Configuration (Default)

```
CPU Limit:        2 cores
CPU Reserve:      0.5 cores
Memory Limit:     2GB
Memory Reserve:   512MB
```

## Quick Start

### Option 1: Using Helper Script (Recommended)

**Windows (PowerShell):**

```powershell
# Verify setup
.\docker-check.ps1

# Start services
.\docker-helper.ps1 -Command up

# View logs
.\docker-helper.ps1 -Command logs

# Access shell
.\docker-helper.ps1 -Command shell

# Stop services
.\docker-helper.ps1 -Command down
```

**Linux/Mac (Bash):**

```bash
# Verify setup
./docker-check.sh

# Start services
./docker-helper.sh up

# View logs
./docker-helper.sh logs

# Access shell
./docker-helper.sh shell

# Stop services
./docker-helper.sh down
```

### Option 2: Using Docker Compose Directly

```bash
# Create .env
cp .env.docker .env

# Start
docker-compose up -d

# Logs
docker-compose logs -f app

# Stop
docker-compose down
```

## Resource Preset Options

Choose one and set in `.env`:

### Lightweight (1 CPU, 1GB RAM)

```bash
APP_CPU_LIMIT=1
APP_MEMORY_LIMIT=1G
APP_CPU_RESERVE=0.25
APP_MEMORY_RESERVE=256M
```

### Standard (2 CPU, 2GB RAM) - **DEFAULT**

```bash
APP_CPU_LIMIT=2
APP_MEMORY_LIMIT=2G
APP_CPU_RESERVE=0.5
APP_MEMORY_RESERVE=512M
```

### High-performance (4 CPU, 4GB RAM)

```bash
APP_CPU_LIMIT=4
APP_MEMORY_LIMIT=4G
APP_CPU_RESERVE=1
APP_MEMORY_RESERVE=1G
```

### Production (8 CPU, 8GB RAM)

```bash
APP_CPU_LIMIT=8
APP_MEMORY_LIMIT=8G
APP_CPU_RESERVE=2
APP_MEMORY_RESERVE=2G
```

## Configuration Steps

### 1️⃣ Verify Docker Installation

```bash
# Windows PowerShell
.\docker-check.ps1

# Linux/Mac
./docker-check.sh
```

### 2️⃣ Create Configuration File

```bash
# From .env.docker
cp .env.docker .env

# Or from example
cp .env.example.docker .env
```

### 3️⃣ Adjust Resources (Optional)

Edit `.env` and select appropriate preset or customize:

```bash
APP_CPU_LIMIT=2
APP_MEMORY_LIMIT=2G
APP_CPU_RESERVE=0.5
APP_MEMORY_RESERVE=512M
```

### 4️⃣ Start Services

```bash
# Using helper
.\docker-helper.ps1 -Command up  # Windows
./docker-helper.sh up             # Linux/Mac

# Or direct
docker-compose up -d
```

### 5️⃣ Verify Services Running

```bash
# Check status
docker-compose ps

# Monitor resources
docker stats
```

### 6️⃣ Access Application

Open browser: **http://localhost:6060**

## Monitoring & Management

### View Real-time Stats

```bash
docker stats
```

### View Logs

```bash
# All services
docker-compose logs -f

# Only app
docker-compose logs -f app

# Only redis
docker-compose logs -f redis
```

### Enter Container Shell

```bash
docker-compose exec app sh
```

### Redis CLI

```bash
docker-compose exec redis redis-cli
```

### Stop/Restart

```bash
# Restart
docker-compose restart

# Stop
docker-compose stop

# Down
docker-compose down
```

## Adjusting Resources

### Change Port (if 6060 is in use)

```bash
# Edit .env
APP_PORT=7070

# Restart
docker-compose restart app
```

### Increase Memory (if OOM errors)

```bash
# Edit .env
APP_MEMORY_LIMIT=4G
APP_MEMORY_RESERVE=1G

# Restart
docker-compose down
docker-compose up -d
```

### Increase CPU (if performance issues)

```bash
# Edit .env
APP_CPU_LIMIT=4
APP_CPU_RESERVE=1

# Restart
docker-compose down
docker-compose up -d
```

## Troubleshooting

### Container won't start

```bash
docker-compose logs app
# Check for port conflicts or memory issues
```

### Port already in use

```bash
# Change APP_PORT in .env to different value
APP_PORT=7070
docker-compose restart app
```

### Out of Memory (OOM)

```bash
# Increase memory limit
APP_MEMORY_LIMIT=4G
docker-compose restart app
```

### Slow performance

```bash
# Check current usage
docker stats

# Increase resources if near limit
# Then restart
```

## Documentation References

- `DOCKER_README.md` - Overview & quick reference
- `DOCKER_SETUP.md` - Detailed setup instructions
- `RESOURCE_CONFIG.md` - Resource management guide
- `UPDATE_SUMMARY.md` - What changed in this update

## Key Information

🔑 **Port Changes:**

- Application moved from port 8080 → **6060**
- All references updated automatically

🔑 **Resource Management:**

- CPU and Memory limits can be configured
- Presets available for different use cases
- Monitor with `docker stats`

🔑 **Important Files:**

- `.env.docker` - Base configuration template
- `.env.example.docker` - Fully commented example
- `docker-compose.yml` - With resource section

## Next Steps

1. ✅ Run `docker-check.ps1` or `docker-check.sh`
2. ✅ Copy `.env.docker` to `.env`
3. ✅ Adjust resources if needed
4. ✅ Run `docker-helper` or `docker-compose up -d`
5. ✅ Monitor with `docker stats`
6. ✅ Access http://localhost:6060

---

**Last Updated:** October 16, 2025
**Configuration Version:** 2.0 (Updated)
