/**
 * Migration: 027 - Repair playlist_items FK to playlists
 *
 * Fixes cases where playlist_items FK was rewritten by SQLite to reference
 * playlists_old during a playlists table rebuild/rename, causing runtime errors:
 *   SQLITE_ERROR: no such table: main.playlists_old
 *
 * This migration is safe to run multiple times.
 *
 * Date: January 13, 2026
 */

const { executeQuery, fetchOne } = require('../core/database');

async function repairPlaylistItemsFK() {
  const playlistItemsSql = await fetchOne(`
    SELECT sql FROM sqlite_master
    WHERE type='table' AND name='playlist_items'
  `);

  if (!playlistItemsSql || !playlistItemsSql.sql) {
    console.log('ℹ️  playlist_items table not found, skipping');
    return;
  }

  const ddl = playlistItemsSql.sql;

  if (ddl.includes('REFERENCES playlists(playlist_uuid)') && !ddl.includes('playlists_old')) {
    console.log('✓ playlist_items FK already correct (references playlists)');
    return;
  }

  if (!ddl.includes('playlists_old')) {
    console.log('✓ playlist_items schema looks healthy (no playlists_old reference)');
    return;
  }

  console.log('⚠️  Detected playlist_items FK referencing stale playlists_old');
  console.log('🔧 Rebuilding playlist_items with correct FK...');

  const oldExists = await fetchOne(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='playlist_items_old'
  `);

  if (oldExists) {
    console.log('⚠️  Found leftover playlist_items_old; dropping it');
    await executeQuery('DROP TABLE IF EXISTS playlist_items_old');
  }

  await executeQuery('PRAGMA foreign_keys = OFF');

  await executeQuery('ALTER TABLE playlist_items RENAME TO playlist_items_old');

  await executeQuery(`
    CREATE TABLE playlist_items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_uuid TEXT UNIQUE NOT NULL,
      playlist_uuid TEXT NOT NULL,
      video_uuid TEXT NOT NULL,
      order_index INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_uuid) REFERENCES playlists(playlist_uuid) ON DELETE CASCADE,
      FOREIGN KEY (video_uuid) REFERENCES videos(video_uuid) ON DELETE CASCADE,
      UNIQUE(playlist_uuid, video_uuid)
    )
  `);

  await executeQuery(`
    INSERT INTO playlist_items (
      item_id, item_uuid, playlist_uuid, video_uuid, order_index, created_at, updated_at
    )
    SELECT
      item_id, item_uuid, playlist_uuid, video_uuid, order_index, created_at, updated_at
    FROM playlist_items_old
  `);

  await executeQuery('DROP TABLE playlist_items_old');

  await executeQuery('PRAGMA foreign_keys = ON');

  const verifyDdl = await fetchOne(`
    SELECT sql FROM sqlite_master
    WHERE type='table' AND name='playlist_items'
  `);

  if (verifyDdl?.sql && verifyDdl.sql.includes('playlists_old')) {
    throw new Error('playlist_items still references playlists_old after repair');
  }

  console.log('✓ playlist_items FK repaired successfully');
}

async function up(dbConnection) {
  console.log('\n📦 Starting Migration 027: Repair playlist_items FK\n');

  try {
    await repairPlaylistItemsFK();
    console.log('\n✅ Migration 027 completed successfully!\n');
  } catch (err) {
    console.error('❌ Migration 027 failed:', err);
    throw err;
  }
}

async function down(dbConnection) {
  // No-op: we do not want to reintroduce a broken FK
  console.log('\nℹ️  Migration 027 rollback: no-op\n');
}

module.exports = {
  up,
  down,
  name: '027-repair-playlist-items-fk.js'
};
