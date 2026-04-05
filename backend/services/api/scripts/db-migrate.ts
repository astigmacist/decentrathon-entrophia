import "../src/load-env";
import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join, resolve } from "path";

function sh(command: string): string {
  return execSync(command, { stdio: ["ignore", "pipe", "pipe"] }).toString();
}

function shInherit(command: string): void {
  execSync(command, { stdio: "inherit" });
}

function listMigrationFiles(): string[] {
  const migrationsDir = resolve(__dirname, "../prisma/migrations");
  if (!existsSync(migrationsDir)) {
    return [];
  }

  const entries = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(migrationsDir, entry.name, "migration.sql"))
    .filter((filePath) => existsSync(filePath))
    .sort();

  return entries;
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }
  return databaseUrl;
}

function databaseUrlForPsql(): string {
  const raw = getDatabaseUrl();
  const parsed = new URL(raw);
  parsed.searchParams.delete("schema");
  return parsed.toString();
}

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, "'\"'\"'");
}

function usersTableExists(): boolean {
  const databaseUrl = escapeSingleQuotes(databaseUrlForPsql());
  const output = sh(
    `psql '${databaseUrl}' -t -A -c "SELECT to_regclass('public.users') IS NOT NULL;"`,
  ).trim();
  return output === "t";
}

function applyMigration(filePath: string): void {
  const normalized = filePath.replace(/\\/g, "/");
  const databaseUrl = escapeSingleQuotes(databaseUrlForPsql());
  shInherit(`psql '${databaseUrl}' -v ON_ERROR_STOP=1 -f "${normalized}"`);
}

function main(): void {
  const files = listMigrationFiles();
  if (files.length === 0) {
    console.log("No migration files found in prisma/migrations.");
    return;
  }

  if (usersTableExists()) {
    console.log("Database already migrated (users table exists).");
    return;
  }

  for (const file of files) {
    console.log(`Applying migration: ${file}`);
    applyMigration(file);
  }

  console.log("Migrations applied successfully.");
}

try {
  main();
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}
