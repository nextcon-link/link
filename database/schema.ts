import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const labels = sqliteTable('labels', {
  id:         text('id').primaryKey(),
  userId:     text('user_id').notNull(),
  name:       text('name').notNull(),
  color:      text('color').notNull().default('#DC143C'),
  isVisible:  integer('is_visible', { mode: 'boolean' }).notNull().default(true),
  googleCalendarId: text('google_calendar_id'),
  googleAccessRole: text('google_access_role'),
  googleSyncEnabled: integer('google_sync_enabled', { mode: 'boolean' }).notNull().default(false),
  googleIsReadonly: integer('google_is_readonly', { mode: 'boolean' }).notNull().default(false),
  deletedAt:  integer('deleted_at'),
  syncStatus: text('sync_status').notNull().default('pending_create'),
  updatedAt:  integer('updated_at').notNull(),
  sharingMode: text('sharing_mode').notNull().default('none'),
});

export const events = sqliteTable('events', {
  id:                text('id').primaryKey(),
  userId:            text('user_id').notNull(),
  title:             text('title').notNull(),
  startTime:         integer('start_time').notNull(),
  endTime:           integer('end_time').notNull(),
  isAllDay:          integer('is_all_day', { mode: 'boolean' }).notNull().default(false),
  labelId:           text('label_id').references(() => labels.id, { onDelete: 'set null' }),
  recurrenceRule:    text('recurrence_rule'),
  recurringEventId:  text('recurring_event_id'),
  originalStartTime: integer('original_start_time'),
  googleEventId:     text('google_event_id'),
  googleCalendarId:  text('google_calendar_id'),
  googleEtag:        text('google_etag'),
  googleUpdatedAt:   integer('google_updated_at'),
  deviceEventId:     text('device_event_id'),
  deletedAt:         integer('deleted_at'),
  syncStatus:        text('sync_status').notNull().default('pending_create'),
  updatedAt:         integer('updated_at').notNull(),
  sharingMode:       text('sharing_mode').notNull().default('none'),
});

export const sharedBundles = sqliteTable('shared_bundles', {
  id:        text('id').primaryKey(),
  userId:    text('user_id').notNull(),
  title:     text('title').notNull(),
  ownerName: text('owner_name').notNull(),
  color:     text('color').notNull().default('#6C8AE4'),
  expiresAt: integer('expires_at'),
  isDemo:    integer('is_demo', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const sharedBundleEvents = sqliteTable('shared_bundle_events', {
  id:        text('id').primaryKey(),
  bundleId:  text('bundle_id').notNull().references(() => sharedBundles.id, { onDelete: 'cascade' }),
  userId:    text('user_id').notNull(),
  title:     text('title').notNull(),
  startTime: integer('start_time').notNull(),
  endTime:   integer('end_time').notNull(),
  isAllDay:  integer('is_all_day', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

export const labelsRelations = relations(labels, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  label: one(labels, { fields: [events.labelId], references: [labels.id] }),
}));

export const sharedBundlesRelations = relations(sharedBundles, ({ many }) => ({
  events: many(sharedBundleEvents),
}));

export const sharedBundleEventsRelations = relations(sharedBundleEvents, ({ one }) => ({
  bundle: one(sharedBundles, {
    fields: [sharedBundleEvents.bundleId],
    references: [sharedBundles.id],
  }),
}));

// Inferred TypeScript types
export type Label = typeof labels.$inferSelect;
export type NewLabel = typeof labels.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type SharedBundle = typeof sharedBundles.$inferSelect;
export type NewSharedBundle = typeof sharedBundles.$inferInsert;
export type SharedBundleEvent = typeof sharedBundleEvents.$inferSelect;
export type NewSharedBundleEvent = typeof sharedBundleEvents.$inferInsert;
export type SyncStatus = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
