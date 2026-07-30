const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const appRoot = path.join(__dirname, '..');
const dbDir = path.join(appRoot, 'storage', 'database');
const corruptPattern = /^floopystream\.db\.corrupt/;

function findCorruptFiles() {
  if (!fs.existsSync(dbDir)) return [];
  return fs.readdirSync(dbDir).filter(f => corruptPattern.test(f)).map(f => path.join(dbDir, f));
}

function tryDump(corruptPath, outSql) {
  try {
    console.log(`Trying sqlite3 .dump on: ${corruptPath}`);
    // Use platform shell to redirect output
    const cmd = `sqlite3 "${corruptPath}" .dump`;
    const result = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
    fs.writeFileSync(outSql, result);
    console.log(`Dump written to ${outSql} (${fs.statSync(outSql).size} bytes)`);
    return true;
  } catch (err) {
    console.error('Dump failed:', err.message);
    return false;
  }
}

function tryRecoverCLI(corruptPath, outDb) {
  try {
    console.log(`Trying sqlite3 .recover on: ${corruptPath}`);
    // Some sqlite3 builds include .recover as an extension; attempt and pipe to new DB
    // We'll run: sqlite3 corrupt.db ".mode insert" ".output recovered.sql" ".recover"
    const recoveredSql = outDb + '.recovered.sql';
    const cmd = `sqlite3 "${corruptPath}" ".output ${recoveredSql}" ".recover"`;
    execSync(cmd, { stdio: 'inherit' });
    if (fs.existsSync(recoveredSql)) {
      // Create new DB from recovered SQL
      execSync(`sqlite3 "${outDb}" ".read ${recoveredSql}"`);
      console.log(`Recovered DB created at ${outDb}`);
      return true;
    }
  } catch (err) {
    console.error('.recover attempt failed:', err.message);
  }
  return false;
}

function applySqlToNewDb(sqlFile, outDb) {
  try {
    console.log(`Applying SQL to new DB: ${outDb}`);
    execSync(`sqlite3 "${outDb}" ".read ${sqlFile}"`, { stdio: 'inherit' });
    console.log('SQL applied to new DB. Running integrity_check...');
    const out = execSync(`sqlite3 "${outDb}" "PRAGMA integrity_check;"`, { encoding: 'utf8' });
    console.log('integrity_check result:', out.trim());
    return out.trim() === 'ok';
  } catch (err) {
    console.error('Applying SQL failed:', err.message);
    return false;
  }
}

async function main() {
  const corruptFiles = findCorruptFiles();
  if (!corruptFiles.length) {
    console.log('No corrupt DB files found matching pattern floopystream.db.corrupt* in', dbDir);
    process.exit(0);
  }

  for (const corruptPath of corruptFiles) {
    console.log('\nFound corrupt file:', corruptPath);
    const base = path.basename(corruptPath);
    const workingCopy = path.join(dbDir, base + '.workcopy');
    fs.copyFileSync(corruptPath, workingCopy);
    console.log('Created working copy:', workingCopy);

    const dumpSql = workingCopy + '.dump.sql';
    let dumped = tryDump(workingCopy, dumpSql);
    const recoveredDb = path.join(dbDir, base + '.recovered.db');

    if (dumped) {
      const ok = applySqlToNewDb(dumpSql, recoveredDb);
      if (ok) {
        console.log('Recovery successful via dump -> recovered DB at', recoveredDb);
        continue;
      } else {
        console.log('Dump produced SQL but integrity_check failed on reconstructed DB. Will try .recover fallback.');
      }
    }

    // try .recover fallback
    const recOk = tryRecoverCLI(workingCopy, recoveredDb);
    if (recOk) {
      console.log('Recovery via .recover succeeded:', recoveredDb);
      continue;
    }

    console.log('All automated recovery attempts failed for', corruptPath, '\nYou can try manual inspection of the working copy or use sqlite3 tools with newer builds.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
