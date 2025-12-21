#!/bin/bash

# FLoopyStream Docker Helper Script
# Usage: ./docker-helper.sh [command]

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${GREEN}==================================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}==================================================${NC}"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Commands
cmd_help() {
    cat << EOF
${GREEN}FLoopyStream - Docker Helper${NC}

Usage: ./docker-helper.sh [command]

Commands:
    ${GREEN}up${NC}              Build and start all services
    ${GREEN}down${NC}            Stop and remove containers
    ${GREEN}logs${NC}            Show logs from all services
    ${GREEN}logs-app${NC}        Show logs from app service
    ${GREEN}logs-redis${NC}      Show logs from redis service
    ${GREEN}ps${NC}              Show container status
    ${GREEN}shell${NC}           Enter app container shell
    ${GREEN}redis-cli${NC}       Connect to Redis CLI
    ${GREEN}restart${NC}         Restart all services
    ${GREEN}rebuild${NC}         Rebuild images and start
    ${GREEN}clean${NC}           Remove containers and volumes
    ${GREEN}backup-db${NC}       Backup database
    ${GREEN}restore-db${NC}      Restore database from backup
    ${GREEN}status${NC}          Show detailed status
    ${GREEN}help${NC}            Show this help message

EOF
}

cmd_up() {
    print_header "Starting FLoopyStream Services"
    
    if [ ! -f "$ENV_FILE" ]; then
        print_info "Creating $ENV_FILE from .env.docker..."
        cp .env.docker "$ENV_FILE"
    fi
    
    docker-compose up -d
    print_success "Services started!"
    cmd_status
}

cmd_down() {
    print_header "Stopping FLoopyStream Services"
    docker-compose down
    print_success "Services stopped!"
}

cmd_logs() {
    docker-compose logs -f
}

cmd_logs_app() {
    docker-compose logs -f app
}

cmd_logs_redis() {
    docker-compose logs -f redis
}

cmd_ps() {
    docker-compose ps
}

cmd_shell() {
    print_info "Entering app container shell..."
    docker-compose exec app sh
}

cmd_redis_cli() {
    print_info "Connecting to Redis CLI..."
    docker-compose exec redis redis-cli
}

cmd_restart() {
    print_header "Restarting Services"
    docker-compose restart
    print_success "Services restarted!"
    cmd_status
}

cmd_rebuild() {
    print_header "Rebuilding and Starting Services"
    docker-compose down
    docker-compose up -d --build
    print_success "Services rebuilt and started!"
    cmd_status
}

cmd_clean() {
    print_header "Cleaning Up Docker Resources"
    read -p "This will remove containers, images, and volumes. Continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        print_success "Cleanup complete!"
    else
        print_info "Cleanup cancelled."
    fi
}

cmd_backup_db() {
    print_header "Backing Up Database"
    BACKUP_DIR="${PROJECT_DIR}/backup"
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/database-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    docker-compose exec -T app tar czf - /app/storage/database > "$BACKUP_FILE"
    print_success "Database backed up to: $BACKUP_FILE"
}

cmd_restore_db() {
    print_header "Restoring Database"
    BACKUP_DIR="${PROJECT_DIR}/backup"
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        print_error "No backups found in $BACKUP_DIR"
        return 1
    fi
    
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/database-backup-*.tar.gz 2>/dev/null | nl
    
    read -p "Enter backup number to restore: " BACKUP_NUM
    BACKUP_FILE=$(ls "$BACKUP_DIR"/database-backup-*.tar.gz 2>/dev/null | sed -n "${BACKUP_NUM}p")
    
    if [ -z "$BACKUP_FILE" ]; then
        print_error "Invalid selection"
        return 1
    fi
    
    read -p "This will overwrite current database. Continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose exec -T app sh -c "rm -rf /app/storage/database && mkdir -p /app/storage/database"
        tar xzf "$BACKUP_FILE" -C /tmp && \
        docker-compose cp /tmp/app/storage/database/. app:/app/storage/database/ || true
        print_success "Database restored!"
    fi
}

cmd_status() {
    print_header "Service Status"
    
    echo -e "\n${YELLOW}Container Status:${NC}"
    docker-compose ps
    
    echo -e "\n${YELLOW}Resource Usage:${NC}"
    docker stats --no-stream || true
    
    echo -e "\n${YELLOW}Application URL:${NC}"
    echo "  http://localhost:8080"
    
    echo -e "\n${YELLOW}Redis Info:${NC}"
    docker-compose exec redis redis-cli info server 2>/dev/null | head -5 || echo "  Redis not available"
}

# Main
cd "$PROJECT_DIR"

COMMAND="${1:-help}"

case "$COMMAND" in
    up) cmd_up ;;
    down) cmd_down ;;
    logs) cmd_logs ;;
    logs-app) cmd_logs_app ;;
    logs-redis) cmd_logs_redis ;;
    ps) cmd_ps ;;
    shell) cmd_shell ;;
    redis-cli) cmd_redis_cli ;;
    restart) cmd_restart ;;
    rebuild) cmd_rebuild ;;
    clean) cmd_clean ;;
    backup-db) cmd_backup_db ;;
    restore-db) cmd_restore_db ;;
    status) cmd_status ;;
    help) cmd_help ;;
    *)
        print_error "Unknown command: $COMMAND"
        cmd_help
        exit 1
        ;;
esac
