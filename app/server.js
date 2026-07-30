require('dotenv').config();
require('./services/activityLogger');

const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const engine = require('ejs-mate');

// Import utilities and services
const { createRequiredDirectories } = require('./utilities/fileManager');
const { initializeDriveClient } = require('./utilities/cloudStorage');
const { startMonitoring } = require('./services/performanceMonitor');
const { startScheduler } = require('./services/taskScheduler');
const { logInfo, logError } = require('./services/activityLogger');
const rateLimit = require('express-rate-limit');

// Import utilities
const { formatDuration } = require('./utilities/mediaProcessor');
const { formatFileSize } = require('./utilities/fileManager');
const { formatTimestamp, getTimezoneInfo, parseTimestampToDate } = require('./utils/datetime');

// Import database readiness check
const { assertDatabaseReady } = require('./core/database');

// Initialize Express app
const app = express();
const port = process.env.PORT || 8080;

// Create required directories FIRST (before importing routes that use database)
createRequiredDirectories();

// Import routes (these may require database, so directories must exist first)
const routes = require('./routes');

// Clean up old mediaflow.db files (if they exist) - migrate to floopystream.db
// try {
//   const oldDbPath = path.join(__dirname, 'storage', 'database', 'mediaflow.db');
//   if (fs.existsSync(oldDbPath)) {
//     fs.unlinkSync(oldDbPath);
//     console.log('✓ Cleaned up old mediaflow.db file');
//   }
// } catch (error) {
//   console.warn('Note: Could not clean mediaflow.db -', error.message);
// }

// Initialize Google Drive (if configured)
initializeDriveClient();

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  logError('Unhandled rejection', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error('Error:', error);
  logError('Uncaught exception', { error: error.message, stack: error.stack });
});

// Configure view engine
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Timeout middleware for upload routes
app.use('/api/content/upload', (req, res, next) => {
  // Increase timeout for upload requests (30 minutes)
  req.setTimeout(30 * 60 * 1000); // 30 minutes
  res.setTimeout(30 * 60 * 1000); // 30 minutes
  next();
});

// Session configuration
// Determine cookie security based on actual environment
const isProduction = process.env.NODE_ENV === 'production';
const isSecureEnv = process.env.APP_URL && process.env.APP_URL.startsWith('https://');

// Database directory - resolve to absolute path
let dbDir;
if (process.env.DB_PATH) {
  dbDir = path.dirname(process.env.DB_PATH);
} else {
  dbDir = path.join(__dirname, 'storage', 'database');
}

// Ensure it's an absolute path
if (!path.isAbsolute(dbDir)) {
  dbDir = path.resolve(__dirname, dbDir);
}

// Ensure session directory exists
try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true, mode: 0o755 });
    console.log('✓ Created session directory:', dbDir);
  } else {
    console.log('✓ Session directory exists:', dbDir);
  }
} catch (error) {
  console.error('✗ Failed to create session directory:', error.message);
  console.error('  Path:', dbDir);
}

// Test write permission
try {
  const testFile = path.join(dbDir, '.write-test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  console.log('✓ Session directory is writable');
} catch (error) {
  console.error('✗ Session directory not writable:', error.message);
}

// Initialize session store with error handling
let sessionStore;
try {
  // Lazy load SQLiteStore AFTER directories are created
  const SQLiteStore = require('connect-sqlite3')(session);
  
  sessionStore = new SQLiteStore({
    db: 'sessions.db',
    dir: dbDir,
    table: 'sessions'
  });
  console.log('✓ SQLite session store initialized');
} catch (error) {
  console.error('✗ Failed to create SQLite session store:', error.message);
  console.log('⚠ Using memory store (sessions will not persist)');
  sessionStore = new session.MemoryStore();
}

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-this-secret-key',
  resave: false,
  saveUninitialized: false,
  name: 'floopystream.sid',
  cookie: {
    // In Docker, allow both HTTP and HTTPS by checking actual URL config
    // Only force secure if we have an HTTPS URL configured
    secure: isSecureEnv ? true : false,
    httpOnly: true,
    sameSite: 'lax', // Prevent CSRF
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests, please try again later'
});

// Make session available to all views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Helper functions for views
app.locals.formatFileSize = formatFileSize;
app.locals.formatDuration = formatDuration;
app.locals.appName = process.env.APP_NAME || 'FLoopyStream';
app.locals.formatTimestamp = formatTimestamp;
app.locals.tzInfo = getTimezoneInfo();
// Helper: build thumbnail URL robustly from stored thumbnail_path
app.locals.getThumbnailUrl = function(thumbnailPath) {
  if (!thumbnailPath) return '/images/default-thumb.png';
  // If already an absolute path, return as-is
  if (thumbnailPath.startsWith('/')) return thumbnailPath;
  // If starts with storage/ (no leading slash) -> prefix with '/'
  if (thumbnailPath.startsWith('storage/')) return '/' + thumbnailPath;
  // If starts with thumbnails/ -> prefix with /storage/
  if (thumbnailPath.startsWith('thumbnails/')) return '/storage/' + thumbnailPath;
  // Otherwise assume it's a filename stored in storage/thumbnails
  return '/storage/thumbnails/' + thumbnailPath;
};

// ============================================
// ROUTES - All modular routes
// ============================================

app.use(routes);

// ============================================
// START SERVER
// ============================================

// Async IIFE to verify migrations before server starts
(async () => {
  try {
    await assertDatabaseReady();
    console.log('✓ Database migration state verified\n');
    
    // THEN start the server
    app.listen(port, () => {
      const { getTimezoneInfo } = require('./utils/datetime');
      const tzInfo = getTimezoneInfo();
      
      console.log('='.repeat(50));
      console.log(`🚀 ${process.env.APP_NAME || 'FLoopyStream'} is running`);
      console.log(`📡 Server: http://localhost:${port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🕐 Timezone: ${tzInfo.timezone} (${tzInfo.offset})`);
      console.log(`🕗 Server time: ${formatTimestamp(new Date(), 'datetime')}`);
      console.log('='.repeat(50));
      
      // Start monitoring and scheduler AFTER server is listening
      startMonitoring(5);
      startScheduler(30);
      
      logInfo('Application started', { 
        port, 
        env: process.env.NODE_ENV || 'development',
        timezone: tzInfo.timezone 
      });
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    console.error('Error details:', err);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  logInfo('Application shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  logInfo('Application shutting down');
  process.exit(0);
});
