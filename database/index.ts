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
      google_calendar_id TEXT,
      google_access_role TEXT,
      google_sync_enabled INTEGER NOT NULL DEFAULT 0,
      google_is_readonly INTEGER NOT NULL DEFAULT 0,
      deleted_at  INTEGER,
      sync_status TEXT NOT NULL DEFAULT 'pending_create',
      updated_at  INTEGER NOT NULL,
      sharing_mode TEXT NOT NULL CHECK (sharing_mode IN ('none', 'visible', 'invisible', 'blind')) DEFAULT 'none'
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
      google_calendar_id  TEXT,
      google_etag         TEXT,
      google_updated_at   INTEGER,
      device_event_id     TEXT,
      deleted_at          INTEGER,
      sync_status         TEXT NOT NULL DEFAULT 'pending_create',
      updated_at          INTEGER NOT NULL,
      sharing_mode        TEXT NOT NULL CHECK (sharing_mode IN ('none', 'visible', 'invisible', 'blind')) DEFAULT 'none'
    )`,
  );
  expo.runSync(
    `CREATE TABLE IF NOT EXISTS shared_bundles (
      id         TEXT PRIMARY KEY NOT NULL,
      user_id    TEXT NOT NULL,
      title      TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      color      TEXT NOT NULL DEFAULT '#6C8AE4',
      expires_at INTEGER,
      is_demo    INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
  );
  expo.runSync(
    `CREATE TABLE IF NOT EXISTS shared_bundle_events (
      id         TEXT PRIMARY KEY NOT NULL,
      bundle_id  TEXT NOT NULL REFERENCES shared_bundles(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL,
      title      TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time   INTEGER NOT NULL,
      is_all_day INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`,
  );
  expo.runSync(
    'CREATE INDEX IF NOT EXISTS shared_bundles_user_id_idx ON shared_bundles(user_id)',
  );
  expo.runSync(
    'CREATE INDEX IF NOT EXISTS shared_bundle_events_bundle_id_idx ON shared_bundle_events(bundle_id)',
  );

  const addColumnIfMissing = (table: string, column: string, definition: string) => {
    const rows = expo.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!rows.some((row) => row.name === column)) {
      expo.runSync(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    }
  };

  addColumnIfMissing('labels', 'google_calendar_id', 'google_calendar_id TEXT');
  addColumnIfMissing('labels', 'google_access_role', 'google_access_role TEXT');
  addColumnIfMissing(
    'labels',
    'google_sync_enabled',
    'google_sync_enabled INTEGER NOT NULL DEFAULT 0',
  );
  addColumnIfMissing(
    'labels',
    'google_is_readonly',
    'google_is_readonly INTEGER NOT NULL DEFAULT 0',
  );
  addColumnIfMissing('labels', 'deleted_at', 'deleted_at INTEGER');
  addColumnIfMissing('events', 'google_calendar_id', 'google_calendar_id TEXT');
  addColumnIfMissing('events', 'google_etag', 'google_etag TEXT');
  addColumnIfMissing('events', 'google_updated_at', 'google_updated_at INTEGER');
  addColumnIfMissing('events', 'deleted_at', 'deleted_at INTEGER');
  //새로 추가한 코드라 밑에 놔뒀습니다. 확인후 위치끼리 묶어줘도 됩니다.
  addColumnIfMissing('labels', 'sharing_mode', "sharing_mode TEXT NOT NULL CHECK (sharing_mode IN ('none', 'visible', 'invisible', 'blind')) DEFAULT 'none'");
  addColumnIfMissing('events', 'sharing_mode', "sharing_mode TEXT NOT NULL CHECK (sharing_mode IN ('none', 'visible', 'invisible', 'blind')) DEFAULT 'none'");

  const sharingModeSchemaNeedsMigration = (table: string) => {
    const rows = expo.getAllSync<{ sql: string | null }>(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${table}'`,
    );
    const sql = rows[0]?.sql ?? '';
    return sql.includes('sharing_mode') && !sql.includes("'none'");
  };

  if (
    sharingModeSchemaNeedsMigration('labels') ||
    sharingModeSchemaNeedsMigration('events')
  ) {
    expo.runSync('PRAGMA foreign_keys = OFF');
    expo.runSync('DROP TABLE IF EXISTS labels_sharing_mode_migration');
    expo.runSync('DROP TABLE IF EXISTS events_sharing_mode_migration');
    expo.runSync(
      `CREATE TABLE labels_sharing_mode_migration (
        id          TEXT PRIMARY KEY NOT NULL,
        user_id     TEXT NOT NULL,
        name        TEXT NOT NULL,
        color       TEXT NOT NULL DEFAULT '#4A90E2',
        is_visible  INTEGER NOT NULL DEFAULT 1,
        google_calendar_id TEXT,
        google_access_role TEXT,
        google_sync_enabled INTEGER NOT NULL DEFAULT 0,
        google_is_readonly INTEGER NOT NULL DEFAULT 0,
        deleted_at  INTEGER,
        sync_status TEXT NOT NULL DEFAULT 'pending_create',
        updated_at  INTEGER NOT NULL,
        sharing_mode TEXT NOT NULL CHECK (sharing_mode IN ('none', 'visible', 'invisible', 'blind')) DEFAULT 'none'
      )`,
    );
    expo.runSync(
      `CREATE TABLE events_sharing_mode_migration (
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
        google_calendar_id  TEXT,
        google_etag         TEXT,
        google_updated_at   INTEGER,
        device_event_id     TEXT,
        deleted_at          INTEGER,
        sync_status         TEXT NOT NULL DEFAULT 'pending_create',
        updated_at          INTEGER NOT NULL,
        sharing_mode        TEXT NOT NULL CHECK (sharing_mode IN ('none', 'visible', 'invisible', 'blind')) DEFAULT 'none'
      )`,
    );
    expo.runSync(
      `INSERT INTO labels_sharing_mode_migration (
        id, user_id, name, color, is_visible, google_calendar_id,
        google_access_role, google_sync_enabled, google_is_readonly,
        deleted_at, sync_status, updated_at, sharing_mode
      )
      SELECT
        id, user_id, name, color, is_visible, google_calendar_id,
        google_access_role, google_sync_enabled, google_is_readonly,
        deleted_at, sync_status, updated_at,
        CASE
          WHEN sharing_mode IN ('none', 'visible', 'invisible', 'blind') THEN sharing_mode
          ELSE 'none'
        END
      FROM labels`,
    );
    expo.runSync(
      `INSERT INTO events_sharing_mode_migration (
        id, user_id, title, start_time, end_time, is_all_day, label_id,
        recurrence_rule, recurring_event_id, original_start_time,
        google_event_id, google_calendar_id, google_etag, google_updated_at,
        device_event_id, deleted_at, sync_status, updated_at, sharing_mode
      )
      SELECT
        id, user_id, title, start_time, end_time, is_all_day, label_id,
        recurrence_rule, recurring_event_id, original_start_time,
        google_event_id, google_calendar_id, google_etag, google_updated_at,
        device_event_id, deleted_at, sync_status, updated_at,
        CASE
          WHEN sharing_mode IN ('none', 'visible', 'invisible', 'blind') THEN sharing_mode
          ELSE 'none'
        END
      FROM events`,
    );
    expo.runSync('DROP TABLE events');
    expo.runSync('DROP TABLE labels');
    expo.runSync('ALTER TABLE labels_sharing_mode_migration RENAME TO labels');
    expo.runSync('ALTER TABLE events_sharing_mode_migration RENAME TO events');
    expo.runSync('PRAGMA foreign_keys = ON');
  }
} catch (e) {
  console.error('[DB] sync init error:', e);
}

export const db = drizzle(expo, { schema });

// Kept for backwards-compat; tables are already created above.
export async function initDb(): Promise<void> {}
