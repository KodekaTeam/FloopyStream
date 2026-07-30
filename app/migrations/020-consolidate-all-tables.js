/**
 * Migration: 020 - Consolidate All Tables
 *
 * This migration creates all database tables in a single consolidated migration
 * for a cleaner, more maintainable database setup. This replaces the need for
 * multiple incremental migrations while maintaining the same final structure.
 *
 * Tables created:
 * - users
 * - projects
 * - channels
 * - oauth_credentials
 * - streamkeys
 * - gallery_videos
 * - videos
 * - playlists
 * - playlist_items
 * - broadcasts
 * - upload_templates
 * - google_drive_tokens
 * - notifications_channels
 * - notifications_logs
 *
 * Date: December 13, 2025
 */

const { executeQuery } = require('../core/database');

async function up(dbConnection) {
  console.log('\n📦 Starting Migration 020: Consolidate All Tables\n');

  try {
    // ========== TABLE 1: users ==========
    console.log('📋 Creating users table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_uuid TEXT UNIQUE NOT NULL,
        user_fullname VARCHAR(64) UNIQUE NOT NULL,
        user_username VARCHAR(64) UNIQUE NOT NULL,
        user_email TEXT UNIQUE NOT NULL,
        user_password TEXT NOT NULL,
        profile_picture TEXT,
        user_role TEXT DEFAULT 'member' CHECK(user_role IN ('admin', 'member')),
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created users table');

    // ========== TABLE 2: projects ==========
    console.log('📋 Creating projects table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS projects (
        project_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_uuid TEXT UNIQUE NOT NULL,
        user_uuid TEXT NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'banned')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_uuid) REFERENCES users(user_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created projects table');

    // ========== TABLE 3: channels ==========
    console.log('📋 Creating channels table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS channels (
        channel_id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_uuid TEXT UNIQUE NOT NULL,
        project_uuid TEXT NOT NULL,
        channel_platform TEXT NOT NULL,
        channel_name VARCHAR(255) NOT NULL,
        external_id VARCHAR(255),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_uuid) REFERENCES projects(project_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created channels table');

    // ========== TABLE 4: oauth_credentials ==========
    console.log('📋 Creating oauth_credentials table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS oauth_credentials (
        oauth_id INTEGER PRIMARY KEY AUTOINCREMENT,
        oauth_uuid TEXT UNIQUE NOT NULL,
        channel_uuid TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL CHECK(provider IN ('google', 'facebook', 'twitch', 'tiktok')),
        client_id VARCHAR(255),
        client_secret VARCHAR(255),
        access_token TEXT,
        refresh_token TEXT,
        token_type VARCHAR(50),
        expiry_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_uuid) REFERENCES channels(channel_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created oauth_credentials table');

    // ========== TABLE 5: streamkeys ==========
    console.log('📋 Creating streamkeys table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS streamkeys (
        streamkey_id TEXT PRIMARY KEY,
        streamkey_uuid TEXT UNIQUE NOT NULL,
        channel_uuid TEXT NOT NULL,
        streamkey_name VARCHAR(255) NOT NULL,
        streamkey_description VARCHAR(255),
        server_url VARCHAR(255),
        stream_key TEXT,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        youtube_broadcast_id VARCHAR(255),
        youtube_stream_id VARCHAR(255),
        status VARCHAR(20) DEFAULT 'active',
        user_uuid VARCHAR(36),
        streaming_protocol TEXT DEFAULT 'rtmp',
        enable_manual_settings INTEGER DEFAULT 0,
        manual_resolution TEXT DEFAULT '1080p',
        enable_60fps INTEGER DEFAULT 0,
        FOREIGN KEY (channel_uuid) REFERENCES channels(channel_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created streamkeys table');

    // ========== TABLE 6: gallery_videos ==========
    console.log('📋 Creating gallery_videos table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS gallery_videos (
        gallery_id INTEGER PRIMARY KEY AUTOINCREMENT,
        gallery_uuid TEXT UNIQUE NOT NULL,
        channel_uuid TEXT NOT NULL,
        gallery_title VARCHAR(255) NOT NULL,
        gallery_description VARCHAR(255),
        thumbnail_path TEXT,
        platform_video_id VARCHAR(255),
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_uuid) REFERENCES channels(channel_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created gallery_videos table');

    // ========== TABLE 7: videos ==========
    console.log('📋 Creating videos table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS videos (
        video_id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_uuid TEXT UNIQUE NOT NULL,
        gallery_uuid TEXT NOT NULL,
        video_title VARCHAR(255) NOT NULL,
        video_description VARCHAR(255),
        filename TEXT NOT NULL,
        filepath TEXT,
        filesize INTEGER,
        mimetype TEXT,
        duration_seconds REAL,
        thumbnail_path TEXT,
        status TEXT DEFAULT 'ready' CHECK(status IN ('ready', 'uploaded', 'processing', 'live', 'archived')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        resolution TEXT,
        FOREIGN KEY (gallery_uuid) REFERENCES gallery_videos(gallery_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created videos table');

    // ========== TABLE 8: playlists ==========
    console.log('📋 Creating playlists table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS playlists (
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
    console.log('✓ Created playlists table');

    // ========== TABLE 9: playlist_items ==========
    console.log('📋 Creating playlist_items table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS playlist_items (
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
    console.log('✓ Created playlist_items table');

    // ========== TABLE 10: broadcasts ==========
    console.log('📋 Creating broadcasts table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        broadcast_id INTEGER PRIMARY KEY AUTOINCREMENT,
        broadcast_uuid TEXT UNIQUE NOT NULL,
        channel_uuid TEXT NOT NULL,
        video_uuid TEXT,
        broadcast_type TEXT DEFAULT 'single' CHECK(broadcast_type IN ('single', 'playlist')),
        broadcast_name VARCHAR(255),
        platform_name TEXT NOT NULL,
        destination_url TEXT NOT NULL,
        stream_key TEXT,
        broadcast_status TEXT DEFAULT 'scheduled',
        loopvideo INTEGER DEFAULT 1,
        scheduled_time TEXT,
        duration_timeout INTEGER,
        advanced_settings TEXT,
        started_at TEXT,
        ended_at TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        youtube_broadcast_id VARCHAR(255),
        enable_autostart TEXT DEFAULT 'false' CHECK(enable_autostart IN ('true', 'false')),
        enable_autoend TEXT DEFAULT 'false' CHECK(enable_autoend IN ('true', 'false')),
        enable_dvr TEXT DEFAULT 'false' CHECK(enable_dvr IN ('true', 'false')),
        enable_360 TEXT DEFAULT 'false' CHECK(enable_360 IN ('true', 'false')),
        template_uuid TEXT,
        playlist_uuid TEXT,
        repeat_stream TEXT DEFAULT NULL,
        enable_private_replay INTEGER DEFAULT 0 CHECK(enable_private_replay IN (0, 1)),
        private_replay_processed INTEGER DEFAULT 0 CHECK(private_replay_processed IN (0, 1)),
        FOREIGN KEY (channel_uuid) REFERENCES channels(channel_uuid) ON DELETE CASCADE,
        FOREIGN KEY (video_uuid) REFERENCES videos(video_uuid) ON DELETE SET NULL
      )
    `);
    console.log('✓ Created broadcasts table');

    // Add missing columns if they don't exist (for existing databases)
    // const missingColumns = [
    //   'ADD COLUMN enable_private_replay INTEGER DEFAULT 0 CHECK(enable_private_replay IN (0, 1))',
    //   'ADD COLUMN private_replay_processed INTEGER DEFAULT 0 CHECK(private_replay_processed IN (0, 1))',
    //   'ADD COLUMN youtube_broadcast_id VARCHAR(255)',
    //   'ADD COLUMN enable_autostart TEXT DEFAULT \'false\'',
    //   'ADD COLUMN enable_autoend TEXT DEFAULT \'false\'',
    //   'ADD COLUMN enable_dvr TEXT DEFAULT \'false\'',
    //   'ADD COLUMN enable_360 TEXT DEFAULT \'false\'',
    //   'ADD COLUMN template_uuid TEXT'
    // ];

    // for (const columnSql of missingColumns) {
    //   try {
    //     await executeQuery(`ALTER TABLE broadcasts ${columnSql}`);
    //     console.log(`✓ Added missing column: ${columnSql}`);
    //   } catch (error) {
    //     if (error.message.includes('duplicate column name')) {
    //       console.log(`⚠ Column already exists: ${columnSql}`);
    //     } else {
    //       console.log(`⚠ Error adding column ${columnSql}:`, error.message);
    //     }
    //   }
    // }

    // ========== TABLE 11: upload_templates ==========
    console.log('📋 Creating upload_templates table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS upload_templates (
        template_id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_uuid TEXT UNIQUE NOT NULL,
        channel_uuid TEXT NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        template_title VARCHAR(255),
        template_description TEXT,
        template_tags TEXT,
        template_license TEXT,
        template_category TEXT,
        template_language_video TEXT,
        template_language_title TEXT,
        template_language_option TEXT,
        template_certificate_text TEXT,
        template_comment TEXT DEFAULT 'active',
        template_moderation TEXT DEFAULT 'none',
        template_visibility TEXT DEFAULT 'private',
        template_audience TEXT DEFAULT 'not_for_kids',
        thumbnail_url TEXT,
        auto_schedule INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_uuid) REFERENCES channels(channel_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created upload_templates table');

    // ========== TABLE 12: google_drive_tokens ==========
    console.log('📋 Creating google_drive_tokens table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS google_drive_tokens (
        token_id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_uuid TEXT UNIQUE NOT NULL,
        user_uuid TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_uuid) REFERENCES users(user_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created google_drive_tokens table');

    // ========== TABLE 13: oauth_config ==========
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

    // ========== TABLE 14: notifications_channels ==========
    console.log('📋 Creating notifications_channels table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS notifications_channels (
        notification_id TEXT PRIMARY KEY,
        notification_uuid TEXT UNIQUE NOT NULL,
        user_uuid TEXT NOT NULL,
        provider TEXT CHECK(provider IN ('telegram', 'discord', 'webhook')),
        external_chat_id VARCHAR(255),
        external_username VARCHAR(255),
        bot_token TEXT,
        is_active INTEGER DEFAULT 1,
        notify_on_upload INTEGER DEFAULT 1,
        notify_on_stream INTEGER DEFAULT 1,
        notify_on_error INTEGER DEFAULT 1,
        notify_on_schedule INTEGER DEFAULT 0,
        status INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_uuid) REFERENCES users(user_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created notifications_channels table');

    // ========== TABLE 15: notifications_logs ==========
    console.log('📋 Creating notifications_logs table...');
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS notifications_logs (
        log_id TEXT PRIMARY KEY,
        notification_uuid TEXT NOT NULL,
        notification_type VARCHAR(255),
        message TEXT,
        status INTEGER DEFAULT 1,
        sent_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (notification_uuid) REFERENCES notifications_channels(notification_uuid) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created notifications_logs table');

    // ========== CREATE INDEXES ==========
    console.log('\n📋 Creating indexes...');

    // Streamkeys indexes
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_streamkeys_channel_uuid ON streamkeys(channel_uuid)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_streamkeys_is_active ON streamkeys(is_active)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_streamkeys_youtube_stream_id ON streamkeys(youtube_stream_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_streamkeys_youtube_broadcast_id ON streamkeys(youtube_broadcast_id)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_streamkeys_user_uuid ON streamkeys(user_uuid)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_streamkeys_streaming_protocol ON streamkeys(streaming_protocol)');

    // Videos indexes
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_videos_gallery_uuid ON videos(gallery_uuid)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status)');

    // Broadcasts indexes
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_broadcasts_channel_uuid ON broadcasts(channel_uuid)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_broadcasts_broadcast_status ON broadcasts(broadcast_status)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_broadcasts_playlist_uuid ON broadcasts(playlist_uuid)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_broadcasts_enable_private_replay ON broadcasts(enable_private_replay)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_broadcasts_private_replay_processed ON broadcasts(private_replay_processed)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_broadcasts_template_uuid ON broadcasts(template_uuid)');

    // Notifications indexes
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_notifications_user_uuid ON notifications_channels(user_uuid)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_notifications_provider ON notifications_channels(provider)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_notifications_active ON notifications_channels(is_active)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications_channels(created_at)');

    // Logs indexes
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_logs_notification_uuid ON notifications_logs(notification_uuid)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_logs_type ON notifications_logs(notification_type)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_logs_status ON notifications_logs(status)');
    await executeQuery('CREATE INDEX IF NOT EXISTS idx_logs_created_at ON notifications_logs(created_at)');

    console.log('✓ Created all indexes');

    console.log('\n✅ Migration 020 completed successfully!\n');

  } catch (err) {
    console.error('❌ Migration 020 failed:', err);
    throw err;
  }
}

async function down(dbConnection) {
  console.log('\n🔄 Rollback: Migration 020 - Consolidate All Tables\n');

  try {
    // Drop tables in reverse order to avoid foreign key constraints
    const tablesToDrop = [
      'notifications_logs',
      'notifications_channels',
      'oauth_config',
      'google_drive_tokens',
      'upload_templates',
      'broadcasts',
      'playlist_items',
      'playlists',
      'videos',
      'gallery_videos',
      'streamkeys',
      'oauth_credentials',
      'channels',
      'projects',
      'users'
    ];

    for (const tableName of tablesToDrop) {
      try {
        await executeQuery(`DROP TABLE IF EXISTS ${tableName}`);
        console.log(`✓ Dropped table: ${tableName}`);
      } catch (dropError) {
        console.warn(`⚠️  Could not drop table ${tableName}:`, dropError.message);
      }
    }

    console.log('\n✅ Migration 020 rollback completed!\n');

  } catch (err) {
    console.error('❌ Migration 020 rollback failed:', err);
    throw err;
  }
}

module.exports = {
  up,
  down,
  name: '020-consolidate-all-tables.js'
};