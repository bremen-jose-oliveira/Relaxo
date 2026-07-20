import * as SQLite from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import * as schema from '@/db/schema';

const DB_NAME = 'relaxo.db';

export type RelaxoDatabase = ExpoSQLiteDatabase<typeof schema>;

let db: RelaxoDatabase | null = null;
let expoDb: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<RelaxoDatabase> | null = null;

export async function getDb(): Promise<RelaxoDatabase> {
  if (db) return db;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        expoDb = await SQLite.openDatabaseAsync(DB_NAME);
        await expoDb.execAsync('PRAGMA journal_mode = WAL;');
        await expoDb.execAsync('PRAGMA foreign_keys = ON;');
        const drizzleDb = drizzle(expoDb, { schema });
        await migrate(drizzleDb, migrations);
        db = drizzleDb;
        return drizzleDb;
      } catch (err) {
        initPromise = null;
        db = null;
        expoDb = null;
        throw err;
      }
    })();
  }

  return initPromise;
}

/** Raw expo-sqlite handle for explicit transactions. */
export async function getExpoDb(): Promise<SQLite.SQLiteDatabase> {
  await getDb();
  if (!expoDb) throw new Error('Database not initialized');
  return expoDb;
}

export { schema };
