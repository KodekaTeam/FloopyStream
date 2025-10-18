require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

const dbPath = process.env.DB_PATH || './storage/database/floopystream.db';
const dbDirectory = path.dirname(dbPath);

// Ensure database directory exists
fs.ensureDirSync(dbDirectory);

// Initialize database connection
const dbConnection = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('✓ Database connection established');
});

// Enable foreign keys
dbConnection.run('PRAGMA foreign_keys = ON');

/**
 * Initialize database schema
 */
function initializeSchema() {
  return new Promise((resolve, reject) => {
    dbConnection.serialize(() => {
      // Accounts table (replaces Users)
      dbConnection.run(`
        CREATE TABLE IF NOT EXISTS accounts (
          account_id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_uuid TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          profile_picture TEXT,
          account_role TEXT DEFAULT 'member',
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating accounts table:', err);
          reject(err);
        }
      });

      // Content table (replaces Videos)
      dbConnection.run(`
        CREATE TABLE IF NOT EXISTS content (
          content_id INTEGER PRIMARY KEY AUTOINCREMENT,
          content_uuid TEXT UNIQUE NOT NULL,
          account_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          filename TEXT NOT NULL,
          filepath TEXT NOT NULL,
          filesize INTEGER,
          mimetype TEXT,
          duration_seconds REAL,
          thumbnail_path TEXT,
          status TEXT DEFAULT 'ready',
          upload_date TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating content table:', err);
          reject(err);
        }
      });

      // Broadcasts table (replaces Streams)
      // Note: content_id can reference either content.content_id or playlists.playlist_id
      // depending on content_type. FK constraint removed to allow this flexibility.
      dbConnection.run(`
        CREATE TABLE IF NOT EXISTS broadcasts (
          broadcast_id INTEGER PRIMARY KEY AUTOINCREMENT,
          broadcast_uuid TEXT UNIQUE NOT NULL,
          account_id INTEGER NOT NULL,
          content_id INTEGER,
          content_type TEXT DEFAULT 'content',
          broadcast_name TEXT,
          platform_name TEXT NOT NULL,
          destination_url TEXT NOT NULL,
          stream_key TEXT,
          broadcast_status TEXT DEFAULT 'scheduled',
          scheduled_time TEXT,
          started_at TEXT,
          ended_at TEXT,
          error_message TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating broadcasts table:', err);
          reject(err);
        }
      });

      // Playlists table
      dbConnection.run(`
        CREATE TABLE IF NOT EXISTS playlists (
          playlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
          playlist_uuid TEXT UNIQUE NOT NULL,
          account_id INTEGER NOT NULL,
          playlist_name TEXT NOT NULL,
          description TEXT,
          playback_mode TEXT DEFAULT 'sequential',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating playlists table:', err);
          reject(err);
        }
      });

      // Playlist Items table (junction table for playlist-content relationship)
      dbConnection.run(`
        CREATE TABLE IF NOT EXISTS playlist_items (
          item_id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_uuid TEXT UNIQUE NOT NULL,
          playlist_id INTEGER NOT NULL,
          content_id INTEGER NOT NULL,
          order_index INTEGER DEFAULT 0,
          added_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE,
          FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE CASCADE,
          UNIQUE(playlist_id, content_id)
        )
      `, async (err) => {
        if (err) {
          console.error('Error creating playlist_items table:', err);
          reject(err);
        } else {
          console.log('✓ Database schema initialized');
          
          // Run migrations
          try {
            const Broadcast = require('../models/Broadcast');
            
            // Cleanup orphaned active broadcasts from previous session
            await Broadcast.cleanupOrphanedBroadcasts();
            
            // Fix active broadcasts with NULL started_at
            await Broadcast.fixActiveStartedAt();
          } catch (migrationError) {
            console.error('⚠ Migration error:', migrationError.message);
          }
          
          resolve();
        }
      });

      // Google Drive tokens table
      dbConnection.run(`
        CREATE TABLE IF NOT EXISTS google_drive_tokens (
          token_id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_uuid TEXT UNIQUE NOT NULL,
          account_id INTEGER NOT NULL UNIQUE,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating google_drive_tokens table:', err);
          reject(err);
        }
      });

      // Migration: Add broadcast_name and Advanced Settings columns if they don't exist
      dbConnection.all("PRAGMA table_info(broadcasts)", (err, columns) => {
        if (err) {
          console.error('Error checking broadcasts table:', err);
          return;
        }
        
        const hasBroadcastName = columns.some(col => col.name === 'broadcast_name');
        const hasBitrate = columns.some(col => col.name === 'bitrate');
        const hasFrameRate = columns.some(col => col.name === 'frame_rate');
        const hasResolution = columns.some(col => col.name === 'resolution');
        const hasOrientation = columns.some(col => col.name === 'orientation');
        
        if (!hasBroadcastName) {
          dbConnection.run(`ALTER TABLE broadcasts ADD COLUMN broadcast_name TEXT`, (err) => {
            if (err) {
              console.error('Error adding broadcast_name column:', err);
            } else {
              console.log('✓ Added broadcast_name column to broadcasts table');
            }
          });
        }
        
        if (!hasBitrate) {
          dbConnection.run(`ALTER TABLE broadcasts ADD COLUMN bitrate TEXT`, (err) => {
            if (err) {
              console.error('Error adding bitrate column:', err);
            } else {
              console.log('✓ Added bitrate column to broadcasts table');
            }
          });
        }
        
        if (!hasFrameRate) {
          dbConnection.run(`ALTER TABLE broadcasts ADD COLUMN frame_rate TEXT`, (err) => {
            if (err) {
              console.error('Error adding frame_rate column:', err);
            } else {
              console.log('✓ Added frame_rate column to broadcasts table');
            }
          });
        }
        
        if (!hasResolution) {
          dbConnection.run(`ALTER TABLE broadcasts ADD COLUMN resolution TEXT`, (err) => {
            if (err) {
              console.error('Error adding resolution column:', err);
            } else {
              console.log('✓ Added resolution column to broadcasts table');
            }
          });
        }
        
        if (!hasOrientation) {
          dbConnection.run(`ALTER TABLE broadcasts ADD COLUMN orientation TEXT`, (err) => {
            if (err) {
              console.error('Error adding orientation column:', err);
            } else {
              console.log('✓ Added orientation column to broadcasts table');
            }
          });
        }
      });

      // Migration: Add resolution column to content table if it doesn't exist
      dbConnection.all("PRAGMA table_info(content)", (err, columns) => {
        if (err) {
          console.error('Error checking content table:', err);
          return;
        }
        
        const hasResolution = columns.some(col => col.name === 'resolution');
        if (!hasResolution) {
          dbConnection.run(`ALTER TABLE content ADD COLUMN resolution TEXT`, (err) => {
            if (err) {
              console.error('Error adding resolution column:', err);
            } else {
              console.log('✓ Added resolution column to content table');
            }
          });
        }
      });
    });
  });
}

/**
 * Check if any accounts exist in database
 */
function verifyAccountsExist() {
  return new Promise((resolve, reject) => {
    dbConnection.get('SELECT COUNT(*) as total FROM accounts', (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.total > 0);
      }
    });
  });
}

/**
 * Execute a query with promise support
 */
function executeQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbConnection.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

/**
 * Fetch single row
 */
function fetchOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbConnection.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * Fetch multiple rows
 */
function fetchAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    dbConnection.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Close database connection
 */
function closeConnection() {
  return new Promise((resolve, reject) => {
    dbConnection.close((err) => {
      if (err) {
        reject(err);
      } else {
        console.log('✓ Database connection closed');
        resolve();
      }
    });
  });
}

// Initialize schema on load
initializeSchema().catch(err => {
  console.error('Failed to initialize database schema:', err);
  process.exit(1);
});

module.exports = {
  dbConnection,
  initializeSchema,
  verifyAccountsExist,
  executeQuery,
  fetchOne,
  fetchAll,
  closeConnection
};
