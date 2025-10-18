# FloopyStream

=======

# FLoopyStream 🎥

FLoopyStream is a professional live broadcasting platform that lets you stream directly to multiple platforms such as YouTube, Facebook, Twitch, and more using the RTMP protocol. The application can run on a VPS (Virtual Private Server) and supports simultaneous broadcasting to many platforms, featuring advanced scheduling and monitoring capabilities.

> A modern, lightweight streaming solution for live broadcasting to multiple platforms simultaneously with advanced scheduling and monitoring capabilities.

## ✨ Features

- 🎥 **Live Broadcasting** - Stream to multiple platforms (YouTube, Facebook, Twitch, etc.) simultaneously
- 📹 **Media Management** - Upload and manage video content with metadata extraction
- ⏰ **Scheduled Broadcasting** - Schedule broadcasts in advance with flexible timing
- 📊 **Real-time Monitoring** - Monitor system performance, CPU, memory, and active broadcasts
- 🔒 **Secure Authentication** - Session-based authentication with CSRF protection and bcrypt hashing
- 💾 **SQLite Database** - Lightweight and efficient database for reliable data storage
- 📝 **Activity Logging** - Comprehensive logging system for audit trails and troubleshooting
- ☁️ **Cloud Storage** - Optional Google Drive integration for file backup
- 🎬 **Automatic Processing** - Auto-generate thumbnails, extract metadata, and process media
- 📱 **Responsive UI** - Modern, responsive interface that works on all devices
- ⚡ **Performance Optimized** - Efficient resource management and background task processing

## 🛠️ System Requirements

### Minimum Requirements

- **Node.js**: v18.19.0 or higher (v20+ recommended)
- **FFmpeg**: For video processing and streaming
- **SQLite3**: Included in npm packages
- **RAM**: Minimum 1GB for development, 2GB+ for production
- **CPU**: 1 Core minimum, 2+ Cores recommended for concurrent broadcasts
- **Disk Space**: 5GB+ for media storage

### Supported Platforms

- Linux (Ubuntu, Debian, CentOS)
- macOS (Intel & Apple Silicon)
- Windows (via WSL2 recommended for production)
- Docker (recommended for deployment)

### Port Requirements

- **Default Application Port**: 6060 (configurable)
- **FFmpeg Streaming Port**: Depends on broadcast platform
- **Redis Port**: 6379 (if using Docker)

<!-- ## Tech Stack

- **Runtime**: Node.js (v18.19.0+)
- **Framework**: Express.js 4.x
- **Database**: SQLite3
- **Media Processing**: FFmpeg, fluent-ffmpeg
- **Template Engine**: EJS
- **Session Store**: connect-sqlite3
- **Authentication**: bcrypt
- **Validation**: express-validator
- **Rate Limiting**: express-rate-limit
- **Process Manager**: PM2 (for production)
- **Containerization**: Docker & Docker Compose -->

## Installation

### Prerequisites

- Node.js (v18.19.0 or higher)
- FFmpeg (automatically installed via @ffmpeg-installer/ffmpeg)
- Git (for cloning the repository)

### Quick Start (Recommended)

**For Windows (PowerShell):**

```powershell
# Clone repository
git clone https://github.com/KodekaTeam/floopystream.git
cd floopystream/app

# Install dependencies
npm install

# Generate session secret
npm run init-secret

# Start application
npm run dev
```

**For Linux/macOS:**

```bash
# Clone repository
git clone https://github.com/KodekaTeam/floopystream.git
cd floopystream/app

# Install dependencies
npm install

# Generate session secret
npm run init-secret

# Start application
npm run dev
```

Access the application at: `http://localhost:6060`

---

## 🐳 Docker Installation (Recommended for Production)

### Prerequisites for Docker

- Docker (v20.10+)
- Docker Compose (v2.0+)

### Quick Start with Docker

**Windows (PowerShell):**

```powershell
# Navigate to project root
cd floopystream

# Start services using helper script
.\docker-helper.ps1 -Command up

# View logs
.\docker-helper.ps1 -Command logs

# Enter app container shell
.\docker-helper.ps1 -Command shell

# Stop services
.\docker-helper.ps1 -Command down
```

**Linux/macOS:**

```bash
# Navigate to project root
cd floopystream

# Start services using helper script
chmod +x docker-helper.sh
./docker-helper.sh up

# View logs
./docker-helper.sh logs

# Enter app container shell
./docker-helper.sh shell

# Stop services
./docker-helper.sh down
```

**Manual Docker Compose:**

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild and start
docker-compose up -d --build

# Stop services
docker-compose down

# Stop and remove all volumes
docker-compose down -v
```

Access the application at: `http://localhost:6060`

### Docker Services

| Service | Port | Container          | Purpose             |
| ------- | ---- | ------------------ | ------------------- |
| app     | 6060 | floopystream-app   | Node.js application |
| redis   | 6379 | floopystream-redis | Session & caching   |
| db      | -    | -                  | Database volume     |

### Data Persistence in Docker

All data is automatically persisted:

- `./app/storage/database/` → SQLite database
- `./app/storage/uploads/` → User uploaded files
- `./app/storage/media/` → Processed media files
- `./app/storage/thumbnails/` → Generated thumbnails
- `./app/storage/logs/` → Application logs
- `redis-data` → Redis data (named volume)

### Docker Helper Script Commands

```bash
# Windows (PowerShell)
.\docker-helper.ps1 -Command [command]

# Linux/macOS
./docker-helper.sh [command]
```

Available commands:

```
up              - Build and start all services
down            - Stop and remove containers
logs            - Show logs from all services
logs-app        - Show app service logs only
logs-redis      - Show redis service logs
ps              - Show container status
shell           - Enter app container shell
redis-cli       - Connect to Redis CLI
restart         - Restart all services
rebuild         - Rebuild images and start
clean           - Remove containers and volumes
backup-db       - Backup database
restore-db      - Restore database from backup
status          - Show detailed status
help            - Show help message
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the app directory:

```env
# Server Configuration
PORT=6060
NODE_ENV=development
TIMEZONE=Asia/Jakarta

# Database
DB_PATH=./storage/database/floopystream.db

# Security
SESSION_SECRET=<your-generated-secret>

# File Upload
MAX_FILE_SIZE=5368709120
ALLOWED_FORMATS=mp4,avi,mov,mkv,flv,wmv,webm

# Broadcasting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_CONCURRENT_BROADCASTS=5
BROADCAST_TIMEOUT=43200000

# Application
APP_NAME=FLoopyStream
APP_URL=http://localhost:6060

# Google Drive (Optional)
GOOGLE_DRIVE_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_REFRESH_TOKEN=
```

### Timezone Configuration

Set your preferred timezone using IANA timezone names:

**Common Timezones:**

- `Asia/Jakarta` - Jakarta/Indonesia (GMT+7)
- `Asia/Bangkok` - Bangkok/Thailand (GMT+7)
- `Asia/Singapore` - Singapore (GMT+8)
- `Asia/Shanghai` - China (GMT+8)
- `Europe/London` - UK (GMT/BST)
- `Europe/Paris` - France (GMT+1/+2)
- `America/New_York` - US East (UTC-5/-4)
- `America/Los_Angeles` - US West (UTC-8/-7)
- `UTC` - Coordinated Universal Time

**The timezone affects:**

- Broadcast start/end timestamps
- Scheduled broadcast times
- Activity logs
- System monitoring timestamps
- Report generation

**Set timezone:**

```bash
# For Docker
docker-compose exec app /bin/bash
sudo timedatectl set-timezone Asia/Jakarta

# For local installation
# Linux/macOS
sudo timedatectl set-timezone Asia/Jakarta

# Windows PowerShell (Admin)
Set-TimeZone -Id "SE Asia Standard Time"
```

<!-- ### Platform-Specific Setup

#### YouTube Live Streaming

1. Go to YouTube Studio (studio.youtube.com)
2. Click "Create" → "Go Live"
3. Copy your **Stream URL**: `rtmp://a.rtmp.youtube.com/live2`
4. Copy your **Stream Key** from the settings
5. Use these credentials in the broadcast configuration

#### Facebook Live Streaming

1. Go to Facebook Creator Studio
2. Navigate to Live Producers
3. Click "Create Live Video"
4. Get your **RTMP URL** and **Stream Key**
5. Configure in the broadcast settings

#### Twitch Live Streaming

1. Go to Twitch Creator Dashboard
2. Navigate to Settings → Stream
3. Copy your **Ingest Server**: `rtmp://live.twitch.tv/app/`
4. Copy your **Stream Key**
5. Use in broadcast configuration -->

---

## 🔧 Manual Installation (Advanced)

### Step 1: Prepare Server

**Ubuntu/Debian:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg
sudo apt install ffmpeg -y

# Install Git
sudo apt install git -y

# Verify installations
node --version
npm --version
ffmpeg -version
```

**macOS:**

```bash
# Using Homebrew
brew install node ffmpeg git

# Verify installations
node --version
npm --version
ffmpeg -version
```

### Step 2: Clone and Setup

```bash
# Clone repository
git clone https://github.com/KodekaTeam/floopystream.git
cd floopystream/app

# Install dependencies
npm install

# Generate session secret
npm run init-secret

# Create necessary directories
mkdir -p storage/database storage/uploads storage/media storage/thumbnails storage/temp storage/logs
```

### Step 3: Configure Firewall

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow ssh        # Allow SSH to prevent lockout!
sudo ufw allow 6060       # Allow application port
sudo ufw enable
sudo ufw status

# CentOS/RHEL (Firewalld)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-port=6060/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

### Step 4: Install Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application with PM2
pm2 start app.js --name floopystream

# Setup auto-restart on reboot
pm2 save
pm2 startup

# Follow the instructions provided by PM2
# Usually: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username

# Verify PM2 configuration
pm2 status
pm2 logs floopystream
```

### Step 5: Monitor and Maintain

```bash
# View application status
pm2 status

# View real-time logs
pm2 logs floopystream

# Monitor resource usage
pm2 monit

# Restart application
pm2 restart floopystream

# Stop application
pm2 stop floopystream

# Remove application from PM2
pm2 delete floopystream
```

---

## ⏰ Reset Password

If you forget the admin password or need to reset an account:

```bash
# Using Node.js
node helpers/resetPassword.js

# Using Docker
docker-compose exec app node helpers/resetPassword.js
```

Follow the interactive prompts to reset the password.

---

<!-- ## Project Structure

```
FloopyStream/
├── core/                    # Core functionality
│   └── database.js         # Database connection and queries
├── models/                 # Data models
│   ├── Account.js         # User account model
│   ├── Broadcast.js       # Broadcast model
│   └── Content.js         # Media content model
├── services/              # Business logic services
│   ├── activityLogger.js  # Logging service
│   ├── broadcastEngine.js # Broadcasting engine
│   ├── performanceMonitor.js # System monitoring
│   └── taskScheduler.js   # Task scheduling
├── middleware/            # Express middleware
│   ├── authGuard.js      # Authentication middleware
│   └── fileUpload.js     # File upload handling
├── utilities/            # Utility functions
│   ├── cloudStorage.js   # Google Drive integration
│   ├── fileManager.js    # File operations
│   └── mediaProcessor.js # Video processing
├── views/                # EJS templates
│   ├── layout.ejs       # Main layout
│   ├── index.ejs        # Homepage
│   ├── login.ejs        # Login page
│   ├── register.ejs     # Registration page
│   └── dashboard.ejs    # User dashboard
├── public/              # Static assets
│   ├── css/            # Stylesheets
│   └── js/             # JavaScript files
├── helpers/            # Helper scripts
│   ├── secretGenerator.js # Generate session secret
│   └── resetPassword.js   # Reset user password
├── storage/            # Data storage
│   ├── database/      # SQLite database files
│   ├── uploads/       # Uploaded files
│   ├── media/         # Processed media
│   ├── thumbnails/    # Video thumbnails
│   ├── temp/          # Temporary files
│   └── logs/          # Application logs
├── .env.example       # Environment template
├── .gitignore        # Git ignore rules
├── package.json      # Dependencies
└── server.js         # Main application file
``` -->

## 📖 Usage Guide

### Creating an Account

1. Open `http://localhost:6060` in your browser
2. Click on "Register" button
3. Fill in the registration form:
   - **Username**: Choose a unique username
   - **Email**: Valid email address
   - **Password**: Strong password (recommended 8+ characters)
4. Click "Create Account"
5. You'll be redirected to login page
6. Enter credentials to access your dashboard

### Dashboard Overview

Once logged in, you can:

- **View Statistics**: Monitor broadcasts, uploads, and activity
- **Upload Content**: Add video files for streaming
- **Create Broadcasts**: Start live streams to platforms
- **Manage Playlists**: Organize videos into playlists
- **Schedule Events**: Plan future broadcasts
- **Monitor Performance**: Track system metrics
- **View Activity Logs**: Review all activities

### Uploading Video Content

1. Navigate to "Media Library" or "Videos" section
2. Click "Upload Video" button
3. Select video file from your computer (mp4, avi, mov, mkv, etc.)
4. Fill in video details:
   - **Title**: Video title
   - **Description**: Video description
   - **Tags**: Relevant tags for categorization
5. Click "Upload"
6. System automatically:
   - Extracts video metadata
   - Generates thumbnail
   - Processes and stores file
7. Video appears in library once processing is complete

### Starting a Broadcast

#### Method 1: Direct Broadcast

1. Go to "Broadcasts" section
2. Click "Start New Broadcast"
3. Select source:
   - From uploaded video
   - Direct streaming (if supported)
4. Configure broadcast settings:
   - **Platform**: Select destination (YouTube, Facebook, Twitch)
   - **Stream URL**: Enter RTMP URL for platform
   - **Stream Key**: Enter stream key from platform
   - **Quality**: Select bitrate and resolution
   - **Title**: Broadcast title
   - **Description**: Broadcast description
5. Click "Start Broadcast"
6. Monitor broadcast status and statistics

#### Method 2: Scheduled Broadcast

1. Go to "Schedule" section
2. Click "Create Scheduled Broadcast"
3. Fill in broadcast details
4. Select date and time
5. Configure broadcast settings (same as direct)
6. Click "Schedule"
7. System will automatically start at scheduled time

### Managing Broadcasts

**During a Broadcast:**

- Monitor real-time statistics
- View viewer count
- Check bitrate and quality
- View comments and interactions

**End a Broadcast:**

- Click "Stop Broadcast" button
- Confirm termination
- System saves broadcast data

**View Broadcast History:**

- All past broadcasts in "History" section
- View statistics for each broadcast
- Download broadcast recordings (if available)

---

<!-- ## 🔌 API Endpoints

### Authentication Endpoints

| Method | Endpoint                    | Description         |
| ------ | --------------------------- | ------------------- |
| POST   | `/login`                    | User login          |
| POST   | `/register`                 | User registration   |
| GET    | `/logout`                   | User logout         |
| GET    | `/api/user/profile`         | Get user profile    |
| PUT    | `/api/user/profile`         | Update user profile |
| POST   | `/api/user/change-password` | Change password     |

### Content Management Endpoints

| Method | Endpoint                    | Description         |
| ------ | --------------------------- | ------------------- |
| GET    | `/api/content`              | List all content    |
| POST   | `/api/content/upload`       | Upload new content  |
| GET    | `/api/content/:id`          | Get content details |
| PUT    | `/api/content/:id`          | Update content info |
| DELETE | `/api/content/:id`          | Delete content      |
| GET    | `/api/content/:id/download` | Download content    |

### Broadcasting Endpoints

| Method | Endpoint                   | Description              |
| ------ | -------------------------- | ------------------------ |
| GET    | `/api/broadcast`           | List all broadcasts      |
| POST   | `/api/broadcast/start`     | Start broadcast          |
| POST   | `/api/broadcast/stop/:id`  | Stop broadcast           |
| GET    | `/api/broadcast/:id`       | Get broadcast details    |
| GET    | `/api/broadcast/:id/stats` | Get broadcast statistics |
| GET    | `/api/broadcast/active`    | Get active broadcasts    |

### Playlist Endpoints

| Method | Endpoint                              | Description             |
| ------ | ------------------------------------- | ----------------------- |
| GET    | `/api/playlist`                       | List playlists          |
| POST   | `/api/playlist`                       | Create playlist         |
| PUT    | `/api/playlist/:id`                   | Update playlist         |
| DELETE | `/api/playlist/:id`                   | Delete playlist         |
| POST   | `/api/playlist/:id/add`               | Add content to playlist |
| DELETE | `/api/playlist/:id/remove/:contentId` | Remove from playlist    |

### Monitoring Endpoints

| Method | Endpoint              | Description         |
| ------ | --------------------- | ------------------- |
| GET    | `/api/system/metrics` | Get system metrics  |
| GET    | `/api/system/health`  | System health check |
| GET    | `/api/logs`           | Get activity logs   |
| GET    | `/api/logs/errors`    | Get error logs      |

--- -->

## 🤝 Contributing

We welcome contributions! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Reporting Issues

Found a bug? Please report it:

1. Go to [GitHub Issues](https://github.com/KodekaTeam/floopystream/issues)
2. Click "New Issue"
3. Describe the problem in detail
4. Include steps to reproduce
5. Attach logs or screenshots if helpful
6. Submit issue

### Feature Requests

Have a feature idea?

1. Go to [GitHub Issues](https://github.com/KodekaTeam/floopystream/issues)
2. Click "New Issue"
3. Select "Feature Request" template
4. Describe the feature
5. Explain use case
6. Submit request

---

## 📚 Additional Resources

### Documentation Files

- **README.md** - This file (main documentation)
- **DOCKER_README.md** - Detailed Docker setup guide
- **QUICK_START.md** - Quick start guide
- **RESOURCE_CONFIG.md** - Resource configuration
- **FILES_STRUCTURE.md** - Detailed file structure

### External Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [SQLite3 Reference](https://www.sqlite.org/docs.html)
- [Docker Documentation](https://docs.docker.com/)

### Community

- **GitHub**: [KodekaTeam/floopystream](https://github.com/KodekaTeam/floopystream)
- **Issues**: Report bugs and request features
- **Discussions**: Share ideas and ask questions

---

## 📋 FAQ

### Q: Can I use FLoopyStream for commercial purposes?

**A:** Yes, FLoopyStream is released under MIT License. You can use it commercially with proper attribution.

### Q: What's the maximum file size for uploads?

**A:** Default is 5GB. You can change `MAX_FILE_SIZE` in `.env` file.

### Q: Can I stream to multiple platforms simultaneously?

**A:** Yes! FLoopyStream is designed to stream to multiple platforms at once. Add multiple broadcast configurations.

### Q: Is Docker required for production?

**A:** No, but it's highly recommended for easier deployment, scaling, and maintenance.

### Q: How do I backup my data?

**A:** Use the Docker helper script: `./docker-helper.sh backup-db` or manually backup the `storage/database/` directory.

### Q: Can I migrate from another streaming platform?

**A:** Yes, you can import videos and configurations. See the migration guide for details.

### Q: What's the maximum concurrent broadcasts?

**A:** Default is 5. Increase `MAX_CONCURRENT_BROADCASTS` in `.env` based on your hardware resources.

### Q: How do I update to the latest version?

**A:** Pull the latest changes: `git pull origin main` then restart the application.

### Q: Do you provide support?

**A:** Community support via GitHub Issues. For professional support, contact the development team.

---

## 🐛 Known Issues & Limitations

### Current Limitations

1. **Single-Server Only**: Currently designed for single-server deployment

   - _Solution_: Use load balancer for high availability

2. **Local Storage Only**: Media stored locally by default

   - _Solution_: Enable Google Drive integration for cloud backup

3. **No Built-in CDN**: Videos streamed directly from server

   - _Solution_: Use CDN service in front of server

4. **SQLite Limitations**: SQLite has limits on concurrent writes
   - _Solution_: Not recommended for 1000+ concurrent users on single instance

### Fixed Issues

- ✅ v1.0.0: Initial release
- ✅ v1.1.0: Added playlist support
- ✅ v1.2.0: Improved performance monitoring
- ✅ v2.0.0: Docker support added
- ✅ v2.1.0: Enhanced security

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

**What you can do:**

- ✅ Use commercially
- ✅ Modify the code
- ✅ Distribute the software
- ✅ Private use

**Conditions:**

- Include license and copyright notice
- Provide source code modifications

---

## 🙏 Acknowledgments

FLoopyStream wouldn't be possible without:

- [Express.js](https://expressjs.com/) - Web framework
- [FFmpeg](https://ffmpeg.org/) - Media processing
- [SQLite](https://www.sqlite.org/) - Database
- [Node.js](https://nodejs.org/) - Runtime
- All open-source contributors and community members

Special thanks to the streaming community for feedback and feature requests.

---

## 📞 Contact & Support

### Get Help

- **Issues**: [GitHub Issues](https://github.com/KodekaTeam/floopystream/issues)
- **Discussions**: [GitHub Discussions](https://github.com/KodekaTeam/floopystream/discussions)
- **Email**: Contact via GitHub

### Follow Updates

- ⭐ Star the repository for updates
- 👁️ Watch for notifications
- 🔔 Enable GitHub notifications

---

## 🎉 Getting Started Checklist

Quick checklist to get FLoopyStream running:

- [✔] Install Node.js v18+
- [✔] Install FFmpeg
- [✔] Clone repository
- [✔] Run `npm install`
- [✔] Run `npm run init-secret`
- [✔] Configure `.env` file
- [✔] Start application (`npm start` or `npm run dev`)
- [✔] Access `http://localhost:6060`
- [✔] Create account
- [✔] Upload test video
- [✔] Create test broadcast
- [✔] Start streaming!

---

> **Last Updated**: October 16, 2025  
> **Version**: 2.1.0  
> **Status**: Actively Maintained ✅

---

**Happy Streaming! 🎥**

## 🔫 Troubleshooting

### Common Issues and Solutions

#### 1. Port Already in Use

**Error:** `Error: listen EADDRINUSE :::6060`

**Solution:**

```bash
# Find process using port 6060
# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 6060).OwningProcess

# Linux/macOS
sudo lsof -i :6060

# Kill the process
# Windows (PowerShell) - replace PID with actual process ID
Stop-Process -Id PID -Force

# Linux/macOS
sudo kill -9 <PID>

# Or change port in .env
PORT=8080
```

#### 2. FFmpeg Not Found

**Error:** `FFmpeg not found`

**Solution:**

```bash
# Windows - check if FFmpeg is installed
where ffmpeg

# If not installed via npm, install globally
npm install -g ffmpeg

# Linux/macOS
sudo apt install ffmpeg  # Ubuntu/Debian
brew install ffmpeg      # macOS

# Verify installation
ffmpeg -version
```

#### 3. Database Error / Corrupt Database

**Error:** `SQLITE_CORRUPT` or database lock errors

**Solution:**

```bash
# Delete corrupted database (⚠️ WARNING: This will delete all data)
rm storage/database/floopystream.db

# Restart application to create new database
npm start

# Or with Docker
docker-compose exec app rm storage/database/floopystream.db
docker-compose restart app
```

#### 4. Permission Denied Errors

**Error:** `Permission denied` when accessing files/folders

**Solution:**

```bash
# Linux/macOS - fix permissions
chmod -R 755 storage/
chmod -R 755 public/

# Or more permissive (only if needed)
sudo chmod -R 777 storage/
sudo chmod -R 777 public/

# Fix Node.js module permissions
sudo chown -R $USER:$USER node_modules/
```

#### 5. Upload Fails

**Error:** Upload fails or file is rejected

**Possible Causes & Solutions:**

```bash
# 1. File size too large
# Check MAX_FILE_SIZE in .env (default: 5GB)
# MAX_FILE_SIZE=10737418240  # 10GB example

# 2. Wrong file format
# Ensure file is in ALLOWED_FORMATS (default: mp4,avi,mov,mkv,flv,wmv,webm)
ALLOWED_FORMATS=mp4,avi,mov,mkv,flv,wmv,webm,m4v

# 3. Insufficient disk space
# Check available space
df -h          # Linux/macOS
dir c: /s      # Windows

# 4. Permission issues on upload folder
chmod -R 755 storage/uploads/
```

#### 6. Cannot Login / Session Issues

**Error:** Cannot login or keeps getting logged out

**Solution:**

```bash
# 1. Clear sessions database
rm storage/database/sessions.db

# 2. Verify SESSION_SECRET in .env
npm run init-secret

# 3. Check timezone - affects session timestamps
# See timezone configuration section

# 4. For Docker - ensure volumes are properly mounted
docker-compose exec app ls -la storage/database/

# 5. Clear browser cookies and cache, then try again
```

#### 7. Broadcast Won't Start

**Error:** Broadcast fails to start or stops immediately

**Possible Causes & Solutions:**

```bash
# 1. Invalid RTMP URL or stream key
# Verify credentials with your streaming platform
# YouTube: rtmp://a.rtmp.youtube.com/live2
# Twitch: rtmp://live.twitch.tv/app/

# 2. FFmpeg process crashed
# Check logs
tail -f storage/logs/activity.log

# 3. Network connectivity issues
# Check internet connection and firewall rules
ping youtube.com

# 4. Stream key expired
# Generate new stream key from your platform
# Restart the broadcast with new key

# 5. Max concurrent broadcasts reached
# Check MAX_CONCURRENT_BROADCASTS in .env
MAX_CONCURRENT_BROADCASTS=10

# 6. Resource limits
# Increase resource allocation in docker-compose.yml
# Or close other applications to free up resources
```

#### 8. Docker Issues

**Error:** Docker containers won't start

**Solutions:**

```bash
# Check Docker status
docker ps -a

# View container logs
docker-compose logs app
docker-compose logs redis

# Rebuild images
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Permission errors
sudo usermod -aG docker $USER
newgrp docker

# Port conflicts
# Change port in docker-compose.yml or .env
APP_PORT=7070
```

#### 9. High CPU/Memory Usage

**Error:** Application consuming too much resources

**Solution:**

```bash
# 1. Monitor resource usage
# Linux/macOS
top              # Press 'q' to exit
ps aux | grep node

# Docker
docker stats

# Windows Task Manager
tasklist /v

# 2. Check for hung processes
pm2 monit

# 3. Restart application
pm2 restart floopystream
# Or
docker-compose restart app

# 4. Reduce concurrent broadcasts
MAX_CONCURRENT_BROADCASTS=2

# 5. Check for memory leaks in logs
tail -f storage/logs/activity.log
```

#### 10. Google Drive Integration Issues

**Error:** Google Drive upload fails

**Solution:**

```bash
# 1. Verify credentials in .env
GOOGLE_DRIVE_ENABLED=true
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:6060/auth/google/callback
GOOGLE_REFRESH_TOKEN=your-refresh-token

# 2. Test OAuth flow
# Access: http://localhost:6060/auth/google

# 3. Check token expiration
# Regenerate refresh token from Google Cloud Console

# 4. Verify API is enabled
# Go to Google Cloud Console > Enable Google Drive API
```

### Log Files

Application logs are stored in:

```
storage/logs/
├── activity.log        # Main application log
├── errors.log          # Error logs
├── access.log          # Access logs
└── [date].log          # Daily logs
```

**View logs:**

```bash
# Real-time logs
tail -f storage/logs/activity.log

# Last 50 lines
tail -50 storage/logs/activity.log

# Search for errors
grep ERROR storage/logs/activity.log

# Docker
docker-compose logs -f app
```

---

## 🚀 Performance Optimization

### Production Deployment Best Practices

#### 1. Environment Configuration

```env
NODE_ENV=production
PORT=6060

# Disable development features
DEBUG=false

# Increase timeouts for large files
BROADCAST_TIMEOUT=43200000

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200

# Resource limits
MAX_CONCURRENT_BROADCASTS=10
MAX_FILE_SIZE=10737418240
```

#### 2. Docker Resource Limits

Edit `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: "2"
      memory: 2G
    reservations:
      cpus: "1"
      memory: 1G
```

#### 3. Database Optimization

```bash
# Periodic database maintenance
sqlite3 storage/database/floopystream.db "VACUUM;"
sqlite3 storage/database/floopystream.db "ANALYZE;"

# Backup before maintenance
cp storage/database/floopystream.db storage/database/floopystream.db.backup
```

#### 4. File Storage Management

```bash
# Monitor disk usage
df -h

# Clean old temporary files
find storage/temp -mtime +7 -delete  # Delete files older than 7 days

# Archive old logs
gzip storage/logs/activity.log
tar -czf storage/logs/activity-$(date +%Y%m%d).tar.gz storage/logs/*.log
```

#### 5. Enable HTTPS (Recommended for Production)

Use a reverse proxy like Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:6060;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 6. Monitoring and Alerts

```bash
# Monitor with PM2
pm2 monit

# CPU/Memory alerts
pm2 trigger floopystream "max memory restart" 500

# Restart on crash
pm2 restart floopystream
```

### Performance Metrics

Monitor these metrics regularly:

- **CPU Usage**: Should stay under 80% during normal operation
- **Memory Usage**: Should not exceed available RAM
- **Disk I/O**: Monitor read/write speeds
- **Broadcast Latency**: Should be < 5 seconds to platforms
- **Upload Speed**: Should match network capabilities
- **Concurrent Broadcasts**: Monitor active broadcasts

---

## 📝 Development Guide

### Project Structure

<!-- ```
floopystream/
├── app/                          # Main application
│   ├── core/                     # Core functionality
│   │   └── database.js          # Database connection & queries
│   │
│   ├── models/                   # Data models
│   │   ├── Account.js           # User account model
│   │   ├── Broadcast.js         # Broadcast model
│   │   ├── Content.js           # Media content model
│   │   └── Playlist.js          # Playlist model
│   │
│   ├── services/                 # Business logic
│   │   ├── activityLogger.js    # Logging service
│   │   ├── broadcastEngine.js   # Broadcasting engine
│   │   ├── performanceMonitor.js# System monitoring
│   │   └── taskScheduler.js     # Task scheduling
│   │
│   ├── middleware/               # Express middleware
│   │   ├── authGuard.js         # Authentication
│   │   └── fileUpload.js        # File upload handling
│   │
│   ├── utilities/                # Utility functions
│   │   ├── cloudStorage.js      # Google Drive integration
│   │   ├── fileManager.js       # File operations
│   │   └── mediaProcessor.js    # Video processing
│   │
│   ├── helpers/                  # Helper scripts
│   │   ├── secretGenerator.js   # Generate session secret
│   │   └── resetPassword.js     # Reset user password
│   │
│   ├── views/                    # EJS templates
│   │   ├── layout.ejs           # Main layout
│   │   ├── index.ejs            # Homepage
│   │   ├── login.ejs            # Login page
│   │   ├── dashboard.ejs        # User dashboard
│   │   └── ...                  # Other pages
│   │
│   ├── public/                   # Static assets
│   │   ├── css/                 # Stylesheets
│   │   ├── js/                  # JavaScript files
│   │   └── images/              # Images
│   │
│   ├── storage/                  # Data storage
│   │   ├── database/            # SQLite database
│   │   ├── uploads/             # User uploads
│   │   ├── media/               # Processed media
│   │   ├── thumbnails/          # Video thumbnails
│   │   ├── temp/                # Temporary files
│   │   └── logs/                # Application logs
│   │
│   ├── migrations/               # Database migrations
│   ├── package.json             # Dependencies
│   ├── server.js                # Main server file
│   └── Dockerfile               # Docker configuration
│
├── docker-compose.yml           # Docker services config
├── docker-helper.ps1            # Docker helper (Windows)
├── docker-helper.sh             # Docker helper (Linux/Mac)
├── DOCKER_README.md             # Docker documentation
├── README.md                    # Main documentation
├── QUICK_START.md               # Quick start guide
└── backup/                      # Backup & archived files
``` -->

### Running Development Server

```bash
# With auto-restart (recommended)
npm run dev

# Standard start
npm start

# Debug mode
DEBUG=* npm start
```

### Code Quality

```bash
# Check for linting issues
npm run lint

# Format code
npm run format

# Run tests
npm test
```

---

## 🔐 Security Considerations

### Authentication & Authorization

- ✅ Passwords hashed with bcrypt (salt rounds: 10)
- ✅ Session-based authentication with secure cookies
- ✅ CSRF protection on all state-changing operations
- ✅ Role-based access control (User/Admin)
- ✅ Secure session storage in SQLite

### API Security

- ✅ Rate limiting on all endpoints (100 requests per 15 minutes default)
- ✅ Input validation using express-validator
- ✅ SQL injection prevention via parameterized queries
- ✅ XSS protection through EJS auto-escaping
- ✅ CORS configuration for cross-origin requests

### File Upload Security

- ✅ File type validation
- ✅ File size limits (5GB default)
- ✅ Scanned for malicious content
- ✅ Stored outside web root
- ✅ Unique filename generation

### Data Protection

- ✅ Sensitive data encrypted in database
- ✅ Backup recommendations implemented
- ✅ Audit logging of all activities
- ✅ Secure configuration file handling

### Production Hardening

1. **Use HTTPS only**

   ```bash
   NODE_ENV=production
   APP_URL=https://yourdomain.com
   ```

2. **Strong session secret**

   ```bash
   npm run init-secret  # Generates 32-byte random secret
   ```

3. **Disable debug mode**

   ```env
   NODE_ENV=production
   DEBUG=false
   ```

4. **Use reverse proxy (Nginx)**

   - Rate limiting
   - SSL termination
   - Load balancing

5. **Regular backups**
   ```bash
   tar -czf backup-$(date +%Y%m%d).tar.gz storage/
   ```

---

## License

MIT License - See LICENSE.md for details

## Support

For issues or questions:

1. Check the logs in `storage/logs/`
2. Review the error messages
3. Consult the documentation

## Acknowledgments

- FFmpeg for media processing
- Express.js community
- All open-source contributors

---

> **Note:**  
> FLoopyStream is intended for educational and personal use. Please ensure you comply with the terms of service and streaming policies of each platform you broadcast to. For production deployments, review security and scalability considerations.

---

<p align="center" style="font-size:2.0em; padding-top: 25px;">
    <strong>🎉 Status: COMPLETE & PRODUCTION-READY</strong>
</p>
<p align="center" style="font-size:2.5em; padding-top: -10px;">
    <strong>Terima kasih telah menggunakan FloopyStream! 🚀</strong>
</p>
