/**
 * Migration: 025 - Rename 'repeat' to 'shuffle' in playback_mode
 *
 * This migration updates the playback_mode values in the playlists table,
 * renaming 'repeat' to 'shuffle' for consistency with the application logic.
 *
 * Changes:
 * - Updates all playlists where playback_mode = 'repeat' to playback_mode = 'shuffle'
 * - Updates the database CHECK constraint to include 'shuffle' instead of 'repeat'
 * - Auto-repairs FK in playlist_items if it references stale playlists_old
 *
 * Valid playback modes after migration:
 * - 'sequential': Play videos in order
 * - 'shuffle': Play videos in random order (previously 'repeat')
 * - 'random': Play videos in truly random order
 *
 * Date: December 20, 2025
 * Updated: December 23, 2025 - Integrated FK repair for playlist_items
 */

const { executeQuery, fetchOne } = require("../core/database");

/**
 * Helper: Repair playlist_items FK if it references stale playlists_old
 * This fixes the "no such table: main.playlists_old" error when deleting projects
 */
async function repairPlaylistItemsFK(dbConnection) {
  try {
    const playlistItemsSql = await fetchOne(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='playlist_items'
    `);

    if (!playlistItemsSql || !playlistItemsSql.sql) {
      console.log("ℹ️  playlist_items table not found, skipping FK repair");
      return;
    }

    const ddl = playlistItemsSql.sql;

    // Check if it references playlists correctly
    if (
      ddl.includes("REFERENCES playlists(playlist_uuid)") &&
      !ddl.includes("playlists_old")
    ) {
      console.log("✓ playlist_items FK already correct (references playlists)");
      return;
    }

    // If it doesn't reference playlists_old, nothing to repair
    if (!ddl.includes("playlists_old")) {
      console.log("✓ playlist_items FK is healthy");
      return;
    }

    // Detected: playlist_items references playlists_old → REPAIR
    console.log(
      "⚠️  Detected playlist_items FK referencing stale playlists_old"
    );
    console.log("🔧 Rebuilding playlist_items with correct FK...");

    // Check for leftover playlist_items_old from incomplete attempts
    const oldExists = await fetchOne(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='playlist_items_old'
    `);

    if (oldExists) {
      console.log("⚠️  Found leftover playlist_items_old; dropping it");
      await executeQuery("DROP TABLE IF EXISTS playlist_items_old");
    }

    // Disable FK checks during rebuild
    await executeQuery("PRAGMA foreign_keys = OFF");

    // Rename current (broken) table
    await executeQuery(
      "ALTER TABLE playlist_items RENAME TO playlist_items_old"
    );

    // Recreate with correct FK
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

    // Copy data back
    await executeQuery(`
      INSERT INTO playlist_items (
        item_id, item_uuid, playlist_uuid, video_uuid, order_index, created_at, updated_at
      )
      SELECT
        item_id, item_uuid, playlist_uuid, video_uuid, order_index, created_at, updated_at
      FROM playlist_items_old
    `);

    // Drop the old (broken) table
    await executeQuery("DROP TABLE playlist_items_old");

    // Re-enable FK checks
    await executeQuery("PRAGMA foreign_keys = ON");

    // Verify repair
    const verifyDdl = await fetchOne(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='playlist_items'
    `);

    if (verifyDdl?.sql && verifyDdl.sql.includes("playlists_old")) {
      throw new Error(
        "playlist_items still references playlists_old after repair"
      );
    }

    console.log("✓ playlist_items FK repaired successfully");
  } catch (err) {
    console.error("⚠️  Error during FK repair:", err.message);
    // Don't throw — this is a secondary fix, primary migration should still complete
  }
}

async function up(dbConnection) {
  console.log(
    '\n📦 Starting Migration 025: Rename "repeat" to "shuffle" in playback_mode\n'
  );

  try {
    // Check if migration already completed (playlists_old doesn't exist and constraint is updated)
    const checkConstraint = await fetchOne(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='playlists'
    `);

    if (
      checkConstraint &&
      checkConstraint.sql &&
      checkConstraint.sql.includes("'shuffle'")
    ) {
      console.log("✓ Migration 025 already completed (constraint updated)");
      console.log("🔧 Checking playlist_items FK integrity (idempotent)...");
      await repairPlaylistItemsFK(dbConnection);
      console.log("⏭️  Skipping re-execution\n");
      return;
    }

    // Check if playlists_old exists (partial migration recovery)
    const checkOldTable = await fetchOne(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='playlists_old'
    `);

    if (checkOldTable) {
      console.log(
        "⚠️  Found playlists_old - recovering from incomplete migration..."
      );
      console.log("📋 Dropping incomplete backup table...");
      await executeQuery(`DROP TABLE IF EXISTS playlists_old`);
      console.log("✓ Dropped playlists_old");
    }

    // Step 1: Rename old table
    // SQLite rewrites trigger SQL when a referenced table is renamed.
    await executeQuery("DROP TRIGGER IF EXISTS fk_broadcasts_playlist_uuid");
    console.log("📋 Backing up playlists table...");
    await executeQuery(`ALTER TABLE playlists RENAME TO playlists_old`);
    console.log("✓ Renamed playlists to playlists_old");

    // Step 2: Create new table with updated CHECK constraint
    console.log("📋 Creating new playlists table with updated constraint...");
    await executeQuery(`
      CREATE TABLE playlists (
        playlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_uuid TEXT UNIQUE NOT NULL,
        channel_uuid TEXT NOT NULL,
        playlist_name VARCHAR(255) NOT NULL,
        description TEXT,
        playback_mode TEXT DEFAULT 'sequential' CHECK(playback_mode IN ('sequential', 'random', 'shuffle')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_uuid) REFERENCES channels(channel_uuid) ON DELETE CASCADE
      )
    `);
    console.log("✓ Created new playlists table with updated CHECK constraint");

    // Step 3: Copy data with transformation
    console.log(
      "📋 Migrating data from old table with playback_mode transformation..."
    );
    await executeQuery(`
      INSERT INTO playlists (
        playlist_id, playlist_uuid, channel_uuid, playlist_name, description, 
        playback_mode, created_at, updated_at
      )
      SELECT 
        playlist_id, playlist_uuid, channel_uuid, playlist_name, description,
        CASE WHEN playback_mode = 'repeat' THEN 'shuffle' ELSE playback_mode END,
        created_at, updated_at
      FROM playlists_old
    `);
    console.log("✓ Migrated data with playback_mode transformation");

    // Step 4: Drop old table (disable FK check first to avoid constraint errors)
    console.log("📋 Dropping old table...");
    await executeQuery(`PRAGMA foreign_keys = OFF`);
    await executeQuery(`DROP TABLE playlists_old`);
    await executeQuery(`PRAGMA foreign_keys = ON`);
    console.log("✓ Dropped old playlists_old table");

    // Step 4.5: Repair playlist_items FK if it references stale playlists_old
    console.log("\n🔧 Step 4.5: Checking playlist_items FK integrity...");
    await repairPlaylistItemsFK(dbConnection);

    // Step 5: Verify the migration
    const shuffleCount = await fetchOne(`
      SELECT COUNT(*) as count FROM playlists 
      WHERE playback_mode = 'shuffle'
    `);
    const sequentialCount = await fetchOne(`
      SELECT COUNT(*) as count FROM playlists 
      WHERE playback_mode = 'sequential'
    `);
    const randomCount = await fetchOne(`
      SELECT COUNT(*) as count FROM playlists 
      WHERE playback_mode = 'random'
    `);

    console.log(`📊 Playback mode distribution after migration:`);
    console.log(`   - sequential: ${sequentialCount.count}`);
    console.log(`   - shuffle: ${shuffleCount.count}`);
    console.log(`   - random: ${randomCount.count}`);

    console.log("\n✅ Migration 025 completed successfully!\n");
  } catch (err) {
    console.error("❌ Migration 025 failed:", err);
    throw err;
  }
}

async function down(dbConnection) {
  console.log(
    "\n📦 Starting Migration 025 rollback: Restore old playback_mode constraint\n"
  );

  try {
    // Step 1: Rename new table
    console.log("📋 Backing up current playlists table...");
    await executeQuery(`ALTER TABLE playlists RENAME TO playlists_new`);
    console.log("✓ Renamed playlists to playlists_new");

    // Step 2: Recreate table with old CHECK constraint
    console.log("📋 Creating playlists table with original constraint...");
    await executeQuery(`
      CREATE TABLE playlists (
        playlist_id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_uuid TEXT UNIQUE NOT NULL,
        channel_uuid TEXT NOT NULL,
        playlist_name VARCHAR(255) NOT NULL,
        description TEXT,
        playback_mode TEXT DEFAULT 'sequential' CHECK(playback_mode IN ('sequential', 'random', 'repeat')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_uuid) REFERENCES channels(channel_uuid) ON DELETE CASCADE
      )
    `);
    console.log("✓ Created playlists table with original CHECK constraint");

    // Step 3: Copy data with reverse transformation
    console.log("📋 Restoring data with original playback_mode values...");
    await executeQuery(`
      INSERT INTO playlists (
        playlist_id, playlist_uuid, channel_uuid, playlist_name, description, 
        playback_mode, created_at, updated_at
      )
      SELECT 
        playlist_id, playlist_uuid, channel_uuid, playlist_name, description,
        CASE WHEN playback_mode = 'shuffle' THEN 'repeat' ELSE playback_mode END,
        created_at, updated_at
      FROM playlists_new
    `);
    console.log("✓ Restored data with original playback_mode values");

    // Step 4: Drop temporary table
    console.log("📋 Dropping temporary table...");
    await executeQuery(`DROP TABLE playlists_new`);
    console.log("✓ Dropped playlists_new table");

    // Step 5: Verify the rollback
    const repeatCount = await fetchOne(`
      SELECT COUNT(*) as count FROM playlists 
      WHERE playback_mode = 'repeat'
    `);
    const sequentialCount = await fetchOne(`
      SELECT COUNT(*) as count FROM playlists 
      WHERE playback_mode = 'sequential'
    `);
    const randomCount = await fetchOne(`
      SELECT COUNT(*) as count FROM playlists 
      WHERE playback_mode = 'random'
    `);

    console.log(`📊 Playback mode distribution after rollback:`);
    console.log(`   - sequential: ${sequentialCount.count}`);
    console.log(`   - repeat: ${repeatCount.count}`);
    console.log(`   - random: ${randomCount.count}`);

    console.log("\n✅ Migration 025 rollback completed!\n");
  } catch (err) {
    console.error("❌ Migration 025 rollback failed:", err);
    throw err;
  }
}

module.exports = {
  up,
  down,
  name: "025-rename-repeat-to-shuffle.js",
};
