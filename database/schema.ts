import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const labels = sqliteTable('labels', {
  id:         text('id').primaryKey(),
  userId:     text('user_id').notNull(),
  name:       text('name').notNull(),
  color:      text('color').notNull().default('#4A90E2'),
  isVisible:  integer('is_visible', { mode: 'boolean' }).notNull().default(true),
  syncStatus: text('sync_status').notNull().default('pending_create'),
  updatedAt:  integer('updated_at').notNull(),
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
  deviceEventId:     text('device_event_id'),
  syncStatus:        text('sync_status').notNull().default('pending_create'),
  updatedAt:         integer('updated_at').notNull(),
});

export const labelsRelations = relations(labels, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  label: one(labels, { fields: [events.labelId], references: [labels.id] }),
}));

// Inferred TypeScript types
export type Label = typeof labels.$inferSelect;
export type NewLabel = typeof labels.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type SyncStatus = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
