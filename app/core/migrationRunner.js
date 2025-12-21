/**
 * Migration Runner - Executes database migrations in order
 * 
 * Migrations are run sequentially to ensure data integrity.
 * Each migration must have:
 * - up(dbConnection): Function to run migration
 * - down(dbConnection): Function to rollback migration
 * - name: Migration file name
 */

const path = require('path');
const fs = require('fs-extra');

/**
 * Helper functions for database operations
 * These are passed from database.js to avoid circular dependency
 */
let executeQuery, fetchOne, fetchAll;

/**
 * Initialize database helpers
 * @param {Object} helpers - Database helper functions
 */
function initHelpers(helpers) {
  executeQuery = helpers.executeQuery;
  fetchOne = helpers.fetchOne;
  fetchAll = helpers.fetchAll;
}

/**
 * Get all migration files
 * @returns {Promise<Array>} Array of migration file paths
 */
async function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = await fs.readdir(migrationsDir);
  return files
    .filter(f => f.endsWith('.js') && !f.startsWith('_'))
    .sort();
}

/**
 * Create migrations tracking table
 * @param {Object} dbConnection - Database connection
 */
async function initMigrationsTable(dbConnection) {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'success'
      )
    `;
    
    dbConnection.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Check if migration has been executed
 * @param {Object} dbConnection - Database connection
 * @param {string} migrationName - Migration file name
 * @returns {Promise<boolean>} True if migration was executed
 */
async function isMigrationExecuted(dbConnection, migrationName) {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT COUNT(*) as count FROM migrations WHERE name = ? AND status = \'success\'';
    dbConnection.get(sql, [migrationName], (err, result) => {
      if (err) reject(err);
      else resolve((result?.count || 0) > 0);
    });
  });
}

/**
 * Record migration execution
 * @param {Object} dbConnection - Database connection
 * @param {string} migrationName - Migration file name
 * @param {string} status - Migration status
 */
async function recordMigration(dbConnection, migrationName, status = 'success') {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT OR REPLACE INTO migrations (name, status) VALUES (?, ?)';
    dbConnection.run(sql, [migrationName, status], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Get executed migrations
 * @param {Object} dbConnection - Database connection
 * @returns {Promise<Array>} Array of executed migrations
 */
async function getExecutedMigrations(dbConnection) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM migrations
      WHERE status = 'success'
      ORDER BY executed_at ASC
    `;
    dbConnection.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

/**
 * Run all pending migrations
 * @param {Object} dbConnection - Database connection object
 * @returns {Promise<Object>} Migration results
 */
async function runMigrations(dbConnection) {
  console.log('\n🔄 Starting Migration Runner...\n');

  try {
    // Initialize migrations tracking table
    await initMigrationsTable(dbConnection);

    // Get all migration files
    const migrationFiles = await getMigrationFiles();
    console.log(`📋 Found ${migrationFiles.length} migration(s)`);

    if (migrationFiles.length === 0) {
      console.log('✓ No migrations to run');
      return [];
    }

    const results = [];

    for (const file of migrationFiles) {
      const migrationName = path.parse(file).name;
      
      // Check if already executed
      const executed = await isMigrationExecuted(dbConnection, migrationName);
      
      if (executed) {
        console.log(`⏭️  Skipping: ${migrationName} (already executed)`);
        results.push({
          filename: migrationName,
          status: 'skipped'
        });
        continue;
      }

      try {
        console.log(`\n▶️  Running: ${migrationName}`);
        
        // Load migration module
        const migrationPath = path.join(__dirname, '../migrations', file);
        delete require.cache[require.resolve(migrationPath)]; // Clear cache
        const migration = require(migrationPath);

        // Execute migration
        if (typeof migration.up !== 'function') {
          throw new Error('Migration must export up() function');
        }

        await migration.up(dbConnection);

        // Record successful execution
        await recordMigration(dbConnection, migrationName, 'success');
        console.log(`✅ Completed: ${migrationName}`);
        
        results.push({
          filename: migrationName,
          status: 'success'
        });

      } catch (err) {
        console.error(`❌ Failed: ${migrationName}`);
        console.error(`   Error: ${err.message}`);
        
        // Record failed execution
        await recordMigration(dbConnection, migrationName, 'failed');
        
        results.push({
          filename: migrationName,
          status: 'failed',
          error: err.message
        });
      }
    }

    return results;

  } catch (err) {
    console.error('\n❌ Migration Runner Error:', err.message);
    throw err;
  }
}

/**
 * Get migration status
 * @param {Object} dbConnection - Database connection
 * @returns {Promise<Object>} Status information
 */
async function getMigrationStatus(dbConnection) {
  try {
    const executed = await getExecutedMigrations(dbConnection);
    const all = await getMigrationFiles();
    
    return {
      total: all.length,
      executed: executed.length,
      pending: all.length - executed.length,
      migrations: executed.map(m => ({
        name: m.name,
        executedAt: m.executed_at,
        status: m.status
      }))
    };
  } catch (err) {
    console.error('Error getting migration status:', err.message);
    return null;
  }
}

module.exports = {
  runMigrations,
  getMigrationStatus,
  getMigrationFiles,
  initMigrationsTable,
  isMigrationExecuted,
  recordMigration,
  getExecutedMigrations
};
