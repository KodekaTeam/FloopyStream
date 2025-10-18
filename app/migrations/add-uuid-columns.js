/**
 * Migration Script: Add UUID columns to all tables
 * Run this script once to update existing database
 */

const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'storage', 'database', 'floopystream.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting migration: Add UUID columns...\n');

db.serialize(() => {
  // 1. Add account_uuid to accounts table
  db.run(`ALTER TABLE accounts ADD COLUMN account_uuid TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ Error adding account_uuid:', err.message);
    } else if (!err) {
      console.log('✓ Added account_uuid column to accounts table');
      
      // Generate UUIDs for existing accounts
      db.all(`SELECT account_id FROM accounts WHERE account_uuid IS NULL`, [], (err, rows) => {
        if (err) {
          console.error('❌ Error fetching accounts:', err.message);
          return;
        }
        
        if (rows.length > 0) {
          const stmt = db.prepare(`UPDATE accounts SET account_uuid = ? WHERE account_id = ?`);
          rows.forEach(row => {
            stmt.run(uuidv4(), row.account_id);
          });
          stmt.finalize();
          console.log(`  ✓ Generated UUIDs for ${rows.length} existing accounts`);
        }
      });
    }
  });

  // 2. Add unique constraint to account_uuid
  setTimeout(() => {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_uuid ON accounts(account_uuid)`, (err) => {
      if (err) {
        console.error('❌ Error creating index on account_uuid:', err.message);
      } else {
        console.log('✓ Created unique index on account_uuid');
      }
    });
  }, 1000);

  // 3. Add playlist_uuid to playlists table
  db.run(`ALTER TABLE playlists ADD COLUMN playlist_uuid TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ Error adding playlist_uuid:', err.message);
    } else if (!err) {
      console.log('✓ Added playlist_uuid column to playlists table');
      
      // Generate UUIDs for existing playlists
      db.all(`SELECT playlist_id FROM playlists WHERE playlist_uuid IS NULL`, [], (err, rows) => {
        if (err) {
          console.error('❌ Error fetching playlists:', err.message);
          return;
        }
        
        if (rows.length > 0) {
          const stmt = db.prepare(`UPDATE playlists SET playlist_uuid = ? WHERE playlist_id = ?`);
          rows.forEach(row => {
            stmt.run(uuidv4(), row.playlist_id);
          });
          stmt.finalize();
          console.log(`  ✓ Generated UUIDs for ${rows.length} existing playlists`);
        }
      });
    }
  });

  // 4. Add unique constraint to playlist_uuid
  setTimeout(() => {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_uuid ON playlists(playlist_uuid)`, (err) => {
      if (err) {
        console.error('❌ Error creating index on playlist_uuid:', err.message);
      } else {
        console.log('✓ Created unique index on playlist_uuid');
      }
    });
  }, 1500);

  // 5. Add item_uuid to playlist_items table
  db.run(`ALTER TABLE playlist_items ADD COLUMN item_uuid TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ Error adding item_uuid:', err.message);
    } else if (!err) {
      console.log('✓ Added item_uuid column to playlist_items table');
      
      // Generate UUIDs for existing playlist items
      db.all(`SELECT item_id FROM playlist_items WHERE item_uuid IS NULL`, [], (err, rows) => {
        if (err) {
          console.error('❌ Error fetching playlist_items:', err.message);
          return;
        }
        
        if (rows.length > 0) {
          const stmt = db.prepare(`UPDATE playlist_items SET item_uuid = ? WHERE item_id = ?`);
          rows.forEach(row => {
            stmt.run(uuidv4(), row.item_id);
          });
          stmt.finalize();
          console.log(`  ✓ Generated UUIDs for ${rows.length} existing playlist items`);
        }
      });
    }
  });

  // 6. Add unique constraint to item_uuid
  setTimeout(() => {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_items_uuid ON playlist_items(item_uuid)`, (err) => {
      if (err) {
        console.error('❌ Error creating index on item_uuid:', err.message);
      } else {
        console.log('✓ Created unique index on item_uuid');
      }
    });
  }, 2000);

  // 7. Add token_uuid to google_drive_tokens table
  db.run(`ALTER TABLE google_drive_tokens ADD COLUMN token_uuid TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ Error adding token_uuid:', err.message);
    } else if (!err) {
      console.log('✓ Added token_uuid column to google_drive_tokens table');
      
      // Generate UUIDs for existing tokens
      db.all(`SELECT token_id FROM google_drive_tokens WHERE token_uuid IS NULL`, [], (err, rows) => {
        if (err) {
          console.error('❌ Error fetching google_drive_tokens:', err.message);
          return;
        }
        
        if (rows.length > 0) {
          const stmt = db.prepare(`UPDATE google_drive_tokens SET token_uuid = ? WHERE token_id = ?`);
          rows.forEach(row => {
            stmt.run(uuidv4(), row.token_id);
          });
          stmt.finalize();
          console.log(`  ✓ Generated UUIDs for ${rows.length} existing tokens`);
        }
      });
    }
  });

  // 8. Add unique constraint to token_uuid
  setTimeout(() => {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_google_drive_tokens_uuid ON google_drive_tokens(token_uuid)`, (err) => {
      if (err) {
        console.error('❌ Error creating index on token_uuid:', err.message);
      } else {
        console.log('✓ Created unique index on token_uuid');
      }
    });
    
    // Close database after all operations
    setTimeout(() => {
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err.message);
        } else {
          console.log('\n✓ Migration completed successfully!');
          console.log('Please restart your application.');
        }
      });
    }, 500);
  }, 2500);
});
