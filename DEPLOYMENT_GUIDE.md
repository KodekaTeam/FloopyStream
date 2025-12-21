# Panduan Deployment Production

## ⚠️ PENTING: Masalah "nodemon: not found"

Jika Anda mendapat error `sh: 1: nodemon: not found`, ini karena file `docker-compose.override.yml` masih aktif.

### Penyebab
File `docker-compose.override.yml` adalah konfigurasi untuk **development** yang:
- Mengoverride command menjadi `npm run dev` (menggunakan nodemon)
- Mount source code untuk hot reload
- Set NODE_ENV=development

Sedangkan Dockerfile production hanya install dependencies production (`npm ci --only=production`), yang tidak termasuk nodemon.

### Solusi

**Untuk Production Deployment:**

1. **Hapus atau rename file override:**
   ```bash
   # Rename (recommended)
   mv docker-compose.override.yml docker-compose.override.yml.dev
   
   # Atau hapus
   rm docker-compose.override.yml
   ```

2. **Rebuild dan restart container:**
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

**Untuk Development:**

1. **Pastikan override file ada dan nodemon terinstall:**
   ```bash
   # Di local machine, bukan di container
   cd app
   npm install
   ```

2. **Jalankan dengan docker-compose:**
   ```bash
   docker-compose up
   ```

### Cara Kerja Docker Compose Override

Docker Compose secara otomatis menggabungkan `docker-compose.yml` dengan `docker-compose.override.yml` jika file tersebut ada. Ini berguna untuk development, tapi **TIDAK** boleh ada di production.

### Struktur File yang Benar

```
deploy/
├── docker-compose.yml              # ✓ Production config
├── docker-compose.override.yml.dev # ✓ Development config (renamed)
└── app/
    ├── Dockerfile                  # ✓ Production build
    └── package.json
```

## Verifikasi Deployment

Setelah fix, pastikan container berjalan dengan benar:

```bash
# Cek status
docker-compose ps

# Cek logs
docker-compose logs -f app

# Cek environment
docker-compose exec app printenv NODE_ENV
# Should output: production

# Cek command yang dijalankan
docker-compose exec app ps aux | grep node
# Should show: node server.js (NOT nodemon)
```

## Quick Fix Commands

```powershell
# Stop containers
docker-compose down

# Rename override file
Rename-Item -Path "docker-compose.override.yml" -NewName "docker-compose.override.yml.dev"

# Rebuild and start
docker-compose up -d --build

# Check logs
docker-compose logs -f app
```

## Troubleshooting

### Container masih menggunakan nodemon?
```bash
# Clean rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### File override terus muncul?
Pastikan file tidak ter-commit ke git:
```bash
# Check gitignore
cat .gitignore | grep override

# Jika belum ada, tambahkan:
echo "docker-compose.override.yml" >> .gitignore
```
