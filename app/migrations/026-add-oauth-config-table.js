/**
 * Migration: 026 - Add OAuth Config Table
 *
 * This migration adds the oauth_config table to store user-specific OAuth credentials
 * for Google integrations. This allows users to configure their own OAuth settings
 * when environment variables are not set.
 *
 * Table created:
 * - oauth_config
 *
 * Date: December 21, 2025
 */

const { executeQuery } = require('../core/database');

async function up(dbConnection) {
  console.log('\n📦 Starting Migration 026: Add OAuth Config Table\n');

  try {
    // ========== TABLE: oauth_config ==========
    console.log('📋 Creating oauth_config table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS oauth_config (
        oauth_config_id INTEGER PRIMARY KEY AUTOINCREMENT,
        oauth_config_uuid TEXT UNIQUE NOT NULL,
        user_uuid TEXT UNIQUE NOT NULL,
        google_client_id TEXT,
        google_client_secret TEXT,
        google_redirect_uri TEXT,
        oauth_token_type VARCHAR(64) NOT NULL CHECK(oauth_token_type IN ('google')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_uuid) REFERENCES users(user_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created oauth_config table');

    console.log('\n✅ Migration 026 completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration 026 failed:', error);
    throw error;
  }
}

async function down(dbConnection) {
  console.log('\n🔄 Rolling back Migration 026: Add OAuth Config Table\n');

  try {
    await executeQuery('DROP TABLE IF EXISTS oauth_config');
    console.log('✓ Dropped oauth_config table');

    console.log('\n✅ Rollback 026 completed successfully!\n');
  } catch (error) {
    console.error('❌ Rollback 026 failed:', error);
    throw error;
  }
}

module.exports = { up, down };
