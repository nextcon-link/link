import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const expo = openDatabaseSync('calendar.db', { enableChangeListener: true });

// Tables are created synchronously at module load so they exist before
// any component using useLiveQuery mounts.
try {
  expo.runSync('PRAGMA foreign_keys = ON');
  expo.runSync(
    `CREATE TABLE IF NOT EXISTS labels (
      id          TEXT PRIMARY KEY NOT NULL,
      user_id     TEXT NOT NULL,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT '#4A90E2',
      is_visible  INTEGER NOT NULL DEFAULT 1,
      sync_status TEXT NOT NULL DEFAULT 'pending_create',
      updated_at  INTEGER NOT NULL
    )`,
  );
  expo.runSync(
    `CREATE TABLE IF NOT EXISTS events (
      id                  TEXT PRIMARY KEY NOT NULL,
      user_id             TEXT NOT NULL,
      title               TEXT NOT NULL,
      start_time          INTEGER NOT NULL,
      end_time            INTEGER NOT NULL,
      is_all_day          INTEGER NOT NULL DEFAULT 0,
      label_id            TEXT REFERENCES labels(id) ON DELETE SET NULL,
      recurrence_rule     TEXT,
      recurring_event_id  TEXT,
      original_start_time INTEGER,
      google_event_id     TEXT,
      device_event_id     TEXT,
      sync_status         TEXT NOT NULL DEFAULT 'pending_create',
      updated_at          INTEGER NOT NULL
    )`,
  );
} catch (e) {
  console.error('[DB] sync init error:', e);
}

export const db = drizzle(expo, { schema });

// Kept for backwards-compat; tables are already created above.
export async function initDb(): Promise<void> {}
