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

// Configure SQLite for better performance and concurrency
dbConnection.run('PRAGMA foreign_keys = ON');
dbConnection.run('PRAGMA journal_mode = WAL');        // Write-ahead logging untuk concurrency lebih baik
dbConnection.run('PRAGMA synchronous = NORMAL');      // Mengurangi I/O disk
dbConnection.run('PRAGMA busy_timeout = 5000');       // Tunggu 5 detik jika ada lock

/**
 * Initialize database schema
 * Uses migration runner for schema versioning
 */
async function initializeSchema() {
  try {
    console.log('🔄 Initializing database schema...');
    
    // Import migration runner
    const migrationRunner = require('./migrationRunner');
    
    // Run all pending migrations
    const migrationResults = await migrationRunner.runMigrations(dbConnection);
    
    if (migrationResults.length > 0) {
      console.log(`✓ Executed ${migrationResults.length} migration(s)`);
      migrationResults.forEach(result => {
        console.log(`  - ${result.filename}: ${result.status}`);
      });
    } else {
      console.log('✓ Database schema is up to date');
    }
    
    // Run cleanup tasks after migrations
    try {
      const Broadcast = require('../models/Broadcast');
      
      // Cleanup orphaned active broadcasts from previous session
      await Broadcast.cleanupOrphanedBroadcasts();
      
      // Fix active broadcasts with NULL started_at
      await Broadcast.fixActiveStartedAt();
      
      console.log('✓ Database cleanup completed');
    } catch (cleanupError) {
      console.error('⚠ Database cleanup warning:', cleanupError.message);
    }
    
    console.log('✓ Database initialization complete');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Refuse to start the web server until all tracked migrations have succeeded.
 */
async function assertDatabaseReady() {
  const migrationsTable = await fetchOne(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'"
  );

  if (!migrationsTable) {
    throw new Error("Database is not initialized. Run `npm run migrate` first.");
  }

  const { getMigrationFiles } = require("./migrationRunner");
  const migrationFiles = await getMigrationFiles();
  const executed = await fetchAll(
    "SELECT name, status FROM migrations WHERE status = 'success'"
  );
  const successful = new Set(executed.map((migration) => migration.name));
  const pending = migrationFiles
    .map((file) => path.parse(file).name)
    .filter((name) => !successful.has(name));

  if (pending.length > 0) {
    throw new Error(
      `Database migration required. Run \`npm run migrate\`. Pending: ${pending.join(", ")}`
    );
  }
}

/**
 * Check if any accounts exist in database
 * Updated to support both old (accounts) and new (users) table names
 */
function verifyAccountsExist() {
  return new Promise((resolve, reject) => {
    // Try new table name first (users)
    dbConnection.get('SELECT name FROM sqlite_master WHERE type="table" AND name="users"', (err, table) => {
      if (err) {
        reject(err);
        return;
      }
      
      const tableName = table ? 'users' : 'accounts';
      
      dbConnection.get(`SELECT COUNT(*) as total FROM ${tableName}`, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.total > 0);
        }
      });
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

// Export functions - schema initialization is handled by server.js
module.exports = {
  dbConnection,
  initializeSchema,
  assertDatabaseReady,
  verifyAccountsExist,
  executeQuery,
  fetchOne,
  fetchAll,
  closeConnection
};
