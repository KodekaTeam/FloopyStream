/**
 * Migration Script: Fix existing file paths
 * Convert full paths to filename only
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'storage', 'database', 'floopystream.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting migration: Fix file paths...\n');

db.serialize(() => {
  // 1. Fix filepath in content table (convert full path to filename only)
  db.all(`SELECT content_id, filepath, thumbnail_path FROM content`, [], (err, rows) => {
    if (err) {
      console.error('❌ Error fetching content:', err.message);
      return;
    }
    
    console.log(`Found ${rows.length} content records to check`);
    
    const updateFilepath = db.prepare(`UPDATE content SET filepath = ? WHERE content_id = ?`);
    const updateThumbnail = db.prepare(`UPDATE content SET thumbnail_path = ? WHERE content_id = ?`);
    
    let filepathFixed = 0;
    let thumbnailFixed = 0;
    
    rows.forEach(row => {
      // Fix filepath - extract only filename from full path
      if (row.filepath && (row.filepath.includes('\\') || row.filepath.includes('/'))) {
        const filename = path.basename(row.filepath);
        updateFilepath.run(filename, row.content_id);
        filepathFixed++;
        console.log(`  ✓ Fixed filepath for content_id ${row.content_id}: ${filename}`);
      }
      
      // Fix thumbnail_path - remove /storage/ prefix if exists
      if (row.thumbnail_path) {
        let thumbnailPath = row.thumbnail_path;
        
        // Remove /storage/ prefix
        if (thumbnailPath.startsWith('/storage/')) {
          thumbnailPath = thumbnailPath.replace('/storage/', '');
        }
        
        // Ensure it starts with 'thumbnails/'
        if (!thumbnailPath.startsWith('thumbnails/')) {
          const thumbFilename = path.basename(thumbnailPath);
          thumbnailPath = `thumbnails/${thumbFilename}`;
        }
        
        if (thumbnailPath !== row.thumbnail_path) {
          updateThumbnail.run(thumbnailPath, row.content_id);
          thumbnailFixed++;
          console.log(`  ✓ Fixed thumbnail for content_id ${row.content_id}: ${thumbnailPath}`);
        }
      }
    });
    
    updateFilepath.finalize();
    updateThumbnail.finalize();
    
    console.log(`\n✓ Fixed ${filepathFixed} filepath records`);
    console.log(`✓ Fixed ${thumbnailFixed} thumbnail_path records`);
    
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('\n✓ Migration completed successfully!');
      }
    });
  });
});
