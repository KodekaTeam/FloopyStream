require("dotenv").config();

const { closeConnection, dbConnection } = require("../core/database");
const { runMigrations } = require("../core/migrationRunner");

async function main() {
  try {
    const results = await runMigrations(dbConnection);
    const failed = results.filter((result) => result.status === "failed");

    if (failed.length > 0) {
      const names = failed.map((result) => result.filename).join(", ");
      throw new Error(`Migration failed: ${names}`);
    }

    console.log("\nDatabase migration completed successfully.");
  } finally {
    await closeConnection().catch(() => {});
  }
}

main().catch((error) => {
  console.error("\nDatabase migration failed:", error.message);
  process.exitCode = 1;
});
