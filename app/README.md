# FLoopyStream

Professional live broadcasting platform with media streaming capabilities built with Express.js, SQLite, and FFmpeg.

## Features

- 🎥 **Live Broadcasting** - Stream to multiple platforms (YouTube, Facebook, Twitch, etc.)
- 📹 **Media Management** - Upload and manage video content
- ⏰ **Scheduling** - Schedule broadcasts in advance
- 📊 **Performance Monitoring** - Real-time system monitoring
- 🔒 **Secure Authentication** - Session-based authentication with CSRF protection
- 💾 **SQLite Database** - Lightweight and efficient database
- 📝 **Activity Logging** - Comprehensive logging system
- ☁️ **Cloud Storage** - Optional Google Drive integration

## Tech Stack

- **Runtime**: Node.js (v18.19.0+)
- **Framework**: Express.js
- **Database**: SQLite3
- **Media Processing**: FFmpeg, fluent-ffmpeg
- **Template Engine**: EJS
- **Session Store**: connect-sqlite3
- **Authentication**: bcrypt

## Installation

### Prerequisites

- Node.js (v18.19.0 or higher)
- FFmpeg (automatically installed via @ffmpeg-installer/ffmpeg)

### Setup Steps

1. **Clone or download this project**

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Generate session secret**

   ```bash
   npm run init-secret
   ```

   This will create a `.env` file with a secure session secret.

4. **Configure environment** (optional)

   Edit `.env` file to customize settings:

   ```env
   PORT=8080
   NODE_ENV=development
   TIMEZONE=Asia/Jakarta
   SESSION_SECRET=<your-generated-secret>

   # Database path
   DB_PATH=./storage/database/floopystream.db

   # Google Drive (optional)
   GOOGLE_DRIVE_ENABLED=false
   ```

   **Timezone Configuration:**

   Set your preferred timezone using IANA timezone names:

   - `Asia/Jakarta` - Jakarta (GMT+7)
   - `Asia/Singapore` - Singapore (GMT+8)
   - `Europe/London` - London
   - `America/New_York` - New York
   - `UTC` - Coordinated Universal Time (default)

   The timezone affects:

   - Broadcast start/end timestamps
   - Scheduled broadcast times
   - Activity logs
   - System monitoring timestamps

5. **Start the application**

   Development mode:

   ```bash
   npm run dev
   ```

   Production mode:

   ```bash
   npm start
   ```

6. **Access the application**

   Open your browser and navigate to:

   ```
   http://localhost:8080
   ```

## Project Structure

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
```

## Usage

### Creating an Account

1. Navigate to the registration page
2. Fill in username, email, and password
3. Click "Register"

### Uploading Content

1. Log in to your account
2. Go to the dashboard
3. Use the upload form to add video content
4. The system will automatically:
   - Extract video metadata
   - Generate thumbnail
   - Store file securely

### Starting a Broadcast

1. From the dashboard, select content to broadcast
2. Configure broadcast settings:
   - Platform name (YouTube, Facebook, etc.)
   - RTMP destination URL
   - Stream key
   - Optional: Schedule for later
3. Click "Start Broadcast"

### Monitoring

The system provides:

- CPU usage monitoring
- Memory usage tracking
- Disk space monitoring
- Active broadcast count
- System logs

## API Endpoints

### Authentication

- `POST /login` - User login
- `POST /register` - User registration
- `GET /logout` - User logout

### Content Management

- `POST /api/content/upload` - Upload video content
- `GET /api/content/:id` - Get content details
- `DELETE /api/content/:id` - Delete content

### Broadcasting

- `POST /api/broadcast/start` - Start a broadcast
- `POST /api/broadcast/stop/:id` - Stop a broadcast
- `GET /api/broadcast/:id` - Get broadcast details

## Helper Scripts

### Generate Session Secret

```bash
npm run init-secret
```

### Reset User Password

```bash
node helpers/resetPassword.js
```

Follow the prompts to reset a user's password.

## Configuration

### Environment Variables

| Variable          | Description             | Default                            |
| ----------------- | ----------------------- | ---------------------------------- |
| `PORT`            | Server port             | 8080                               |
| `NODE_ENV`        | Environment             | development                        |
| `SESSION_SECRET`  | Session encryption key  | (required)                         |
| `DB_PATH`         | Database file path      | ./storage/database/floopystream.db |
| `MAX_FILE_SIZE`   | Max upload size (bytes) | 5368709120 (5GB)                   |
| `ALLOWED_FORMATS` | Allowed video formats   | mp4,avi,mov,mkv,flv,wmv,webm       |

### Google Drive Integration (Optional)

To enable Google Drive storage:

1. Create a Google Cloud project
2. Enable Google Drive API
3. Create OAuth 2.0 credentials
4. Update `.env`:
   ```env
   GOOGLE_DRIVE_ENABLED=true
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=your-redirect-uri
   GOOGLE_REFRESH_TOKEN=your-refresh-token
   ```

## Broadcasting to Platforms

### YouTube

1. Get your stream URL: `rtmp://a.rtmp.youtube.com/live2`
2. Get your stream key from YouTube Studio
3. Use these in the broadcast configuration

### Facebook

1. Get RTMP URL from Facebook Live Producer
2. Copy the stream key
3. Configure in broadcast settings

### Twitch

1. Get ingest server: `rtmp://live.twitch.tv/app/`
2. Get stream key from Twitch dashboard
3. Use in broadcast configuration

## Troubleshooting

### Database Issues

If you encounter database errors:

````bash
# Delete the database and restart
```bash
rm storage/database/floopystream.db
````

npm start

````

### FFmpeg Issues

FFmpeg is automatically installed. If you encounter issues:

- Ensure your system supports FFmpeg
- Check logs in `storage/logs/`

### Upload Failures

Check:

- File size limits in `.env`
- Available disk space
- File format compatibility

## Security

- Passwords are hashed using bcrypt
- Session-based authentication
- CSRF protection enabled
- Rate limiting on API endpoints
- SQL injection protection via parameterized queries

## Performance

- SQLite for lightweight database operations
- Efficient file handling
- Background task processing
- System resource monitoring

## Development

### Running in Development Mode

```bash
npm run dev
````

This uses nodemon for auto-restart on file changes.

### Code Structure

The application follows MVC-like architecture:

- **Models**: Data layer and database operations
- **Services**: Business logic and background tasks
- **Middleware**: Request processing and validation
- **Views**: EJS templates for frontend
- **Utilities**: Reusable helper functions

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

**Note**: This is a clone project with different naming conventions from the original StreamFlow application. All function names, variables, and structures have been renamed to avoid conflicts.
