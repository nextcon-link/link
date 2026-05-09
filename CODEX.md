# CODEX.md

This file is the current working guide for Codex and other coding agents in
this repository. Treat this as the successor to `CLAUDE.md`: read this first
before changing code, then use `CLAUDE.md` only as older historical context.

## Project Snapshot

`link` is an Expo Router calendar app with:

- Native-first mobile screens built with React Native and Expo Router.
- Local-first storage using `expo-sqlite` + Drizzle.
- Supabase Auth, RLS-backed remote tables, profiles, friendships, and Edge
  Functions.
- Server-side Google Calendar OAuth and bidirectional sync through Supabase
  Edge Functions.
- A lightweight web path for shared-calendar/demo viewing, with web stubs for
  native-only modules.

The current app is no longer the simple unauthenticated local calendar described
by the original `CLAUDE.md`. Authentication, Google Calendar integration,
friends, shared bundles, soft deletes, and web/native platform splits are now
part of the core design.

## Common Commands

```bash
npm install
npm start
npm run android
npm run ios
npm run web
npm run lint
npx drizzle-kit generate
```

Notes:

- `expo-sqlite` and `expo-calendar` are native/runtime concerns. The web target
  uses `.web.ts` / `.web.tsx` stubs for several modules.
- Git may report `dubious ownership` in this workspace when run from a sandboxed
  user. Do not treat that as a repo problem. Ask the user before changing global
  Git config.

## Current Directory Map

```text
app/
  _layout.tsx             Native root: auth routing, session init, sync loops
  _layout.web.tsx         Web root: minimal stack, no native auth/sync boot
  login.tsx/signup.tsx    Supabase email/password auth screens
  auth-callback.tsx       Supabase email/auth callback handler
  add.tsx/edit.tsx        Event create/edit modal screens
  labels.tsx              Label CRUD, visibility, Google entry point
  google.tsx              Google Calendar connect/sync/disconnect UI
  friends.tsx             Friend list/add/remove UI
  (tabs)/
    index.tsx             Main native weekly calendar
    calendar.tsx          Month date picker -> week selection
    shared.tsx            Native shared bundle viewer with local demo seed
    *.web.tsx             Web shared/demo redirects and static demo data

components/
  EventForm.tsx           Shared add/edit form, label picker, recurrence picker
  WeekCalendarView.tsx    Weekly grid renderer, overlap lanes, all-day row
  SharedBundleViewer.tsx  Shared/source-filtered week view

database/
  schema.ts               Drizzle schema and TS types
  index.ts                Native SQLite open, table creation, additive columns
  index.web.ts            Web stub

services/
  supabaseApi.ts          Supabase client, labels/events push/pull wrappers
  supabaseApi.web.ts      Web stub
  syncEngine.ts           Local <-> Supabase sync engine
  googleCalendarApi.ts    Client wrapper around google-sync-now Edge Function
  deviceSync.ts           Read-only device calendar merge
  deviceSync.web.ts       Web local-only stub
  friendApi.ts            Supabase RPC wrappers for friendships
  profileApi.ts           Profile/public profile helpers
  sharedDemoSeed.ts       Dev-only local shared bundle seed
  recurrence.ts           RRULE helpers

store/
  auth.ts                 Supabase auth Zustand store + legacy adoption
  index.ts                Calendar UI state

supabase/
  auth_profiles.sql       Remote schema, RLS, triggers, RPCs
  functions/
    google-sync-now/      Authenticated Google status/auth/sync/disconnect API
    google-oauth-callback Google OAuth callback -> token storage -> app redirect
    google-webhook/       Google push notification receiver
    google-renew-watches/ Watch renewal endpoint
    _shared/google_calendar.ts
                           Main Google Calendar server sync implementation
```

## What Changed Since `CLAUDE.md`

- Authentication is now required on native. `app/_layout.tsx` redirects logged
  out users to `/login`; most data is scoped to `auth.uid()`.
- `utils/storage.ts` no longer creates a device-only user id. It calls
  `supabase.auth.getUser()` and throws if unauthenticated.
- `store/auth.ts` owns session initialization, sign-in/sign-up/sign-out, and
  adopts legacy local rows from the old `device_user_id` into the Supabase user.
- Local SQLite schema now includes Google metadata fields and shared bundle
  tables in addition to labels/events.
- Supabase SQL now includes `profiles`, `friendships`, `google_connections`,
  `google_calendar_links`, RLS policies, public profile view, updated-at
  triggers, soft-delete helpers, and friend RPCs.
- Google Calendar sync is server-side. The client invokes Supabase Functions;
  it does not call Google APIs directly.
- Labels can represent Google calendars. Some labels are read-only
  (`googleIsReadonly`), and event writes must respect that.
- Shared calendar viewing exists. Native uses local dev demo seed data;
  web uses static demo bundles.
- Web support is intentionally partial. Several modules are stubs, not full app
  implementations.
- `database/index.ts` creates tables synchronously at module load. `initDb()` is
  currently a backwards-compatible no-op.
- Deletes are soft-deleted for remote sync and often hard-deleted locally after
  successful push/pull handling.

## Architecture Rules

### 1. Local-first writes

Event and label writes go to SQLite first so UI updates immediately:

- `createEvent`, `updateEvent`, `deleteEvent` in `utils/eventService.ts`
- `createLabel`, `updateLabel`, `deleteLabel`, `toggleLabelVisibility` in
  `utils/labelService.ts`

Rows are marked with:

- `pending_create`
- `pending_update`
- `pending_delete`
- `synced`

After local writes, services call `pushChanges()` without blocking the UI.

### 2. Auth-scoped data

Almost every local and remote query must filter by the current Supabase user id.
Use:

```ts
const userId = useAuthStore((state) => state.user?.id ?? "");
```

in React screens, or:

```ts
const userId = await getCurrentUserId();
```

in service functions.

Do not reintroduce anonymous device-user writes unless explicitly designing a
new offline guest mode.

### 3. Sync order matters

`services/syncEngine.ts` pushes/pulls labels before events because events depend
on label ids.

Important behavior:

- Pending local rows are local-wins.
- Remote rows overwrite only local rows whose `syncStatus` is `synced` and whose
  `updatedAt` is older than remote `updated_at`.
- Label soft delete clears event `labelId`.
- When push changes remote data, the sync engine tries to trigger Google sync.

### 4. Device calendar is read-only

`services/deviceSync.ts` reads device calendars through `expo-calendar`, merges
them in memory, and returns renderable events.

Never persist device calendar events into SQLite unless the product direction
explicitly changes. Device events should remain visually distinct and
non-editable.

### 5. Google Calendar belongs on the server

The client flow is:

```text
app/google.tsx
  -> services/googleCalendarApi.ts
  -> Supabase Function google-sync-now
  -> supabase/functions/_shared/google_calendar.ts
  -> Google Calendar API + Supabase service role writes
```

The server sync flow includes:

- Create Google calendars for local labels that are sync-enabled and writable.
- Import Google calendars as labels.
- Push Supabase label/event changes to Google.
- Pull Google events into Supabase.
- Register or renew Google webhook watches where supported.

Do not move Google access/refresh token handling into the app client. Tokens are
stored in `public.google_connections` and accessed by Edge Functions using the
service role key.

### 6. Read-only Google calendars

Google calendars with access roles other than `owner` or `writer` are read-only.
The app represents this through label fields:

- `googleAccessRole`
- `googleSyncEnabled`
- `googleIsReadonly`

When changing event creation/editing behavior, keep these rules:

- Users must not create/update events under a read-only Google label.
- Existing read-only Google events can be displayed.
- Read-only events should not navigate into editable local forms.

### 7. Soft delete semantics

Local and remote deletes are not all the same:

- Local delete marks `syncStatus = pending_delete` and `deletedAt = now`.
- Supabase delete wrappers update `deleted_at`.
- After confirmed remote delete, local rows may be hard-deleted.
- Supabase triggers also clear `events.label_id` when labels are soft-deleted.

Be careful not to query deleted rows in UI. Most UI queries should include both:

```ts
isNull(row.deletedAt)
ne(row.syncStatus, "pending_delete")
```

where applicable.

## Data Model Summary

### Local SQLite

`labels`

- User-owned calendar categories.
- Can map to Google calendars.
- Has visibility, color, sync status, soft delete, and read-only metadata.

`events`

- User-owned events.
- Optional `labelId`.
- Stores local timestamps as Unix milliseconds.
- Stores Google event/calendar ids and sync metadata.

`shared_bundles` and `shared_bundle_events`

- Local representation for shared calendar/demo viewing.
- Currently seeded in dev by `services/sharedDemoSeed.ts`.
- Not part of the main Supabase label/event sync engine.

### Supabase

Defined in `supabase/auth_profiles.sql`:

- `profiles`, `profiles_public`
- `labels`, `events`
- `friendships`
- `google_connections`
- `google_calendar_links`
- RPCs: `get_friends`, `add_friend_by_username`, `remove_friend`
- Triggers: `set_updated_at`, auth profile creation, label soft-delete cleanup

RLS is enabled. Client writes should normally be made with the authenticated
anon client and satisfy `auth.uid() = user_id`.

## Time Handling

- Local DB stores event times as Unix milliseconds.
- Supabase stores event times as ISO 8601/timestamptz strings.
- `utils/datetime.ts` centralizes conversions such as `toUtcMs`,
  `toLocalDateString`, `dayBounds`, and display formatting.
- Despite names like `toUtcMs`, user-facing form inputs are interpreted in local
  time by `dayjs(...).valueOf()`.
- Google all-day events use date-only payloads and require care around end dates.

When changing recurrence or all-day behavior, inspect both
`WeekCalendarView.tsx` and `_shared/google_calendar.ts`.

## Native vs Web

Native is the real app surface. Web is constrained:

- `database/index.web.ts` exports `db = null as any`.
- `services/supabaseApi.web.ts` throws for real Supabase operations and returns
  empty results for sync helpers.
- `services/deviceSync.web.ts` returns only local events.
- `app/_layout.web.tsx` does not run the native auth/sync lifecycle.
- `(tabs)/index.web.tsx` redirects to the shared/demo view.

Do not assume a native module exists on web. If adding imports to shared files,
check whether a `.web` stub is needed.

## UI/Screen Flow

Main native tabs:

- `Home`: weekly calendar.
- `달력`: date picker that routes back to a selected week.
- `공유`: shared bundle comparison view.

Primary user flows:

```text
Login/signup
  -> Root auth guard
  -> Main weekly view
  -> Add/edit event
  -> Local SQLite pending row
  -> Supabase sync
  -> Optional Google sync
```

```text
Labels
  -> Local label CRUD
  -> Supabase sync
  -> Optional Google calendar creation/update
```

```text
Google screen
  -> Supabase Function auth-url/status/sync/disconnect
  -> OAuth callback
  -> Server-side Google sync
  -> Client syncAll pulls resulting Supabase changes
```

```text
Friends
  -> Supabase RPCs
  -> profiles_public/friendships
```

## Edge Function Environment

Google functions expect these Supabase/Google environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_CALLBACK_URL`
- `GOOGLE_OAUTH_STATE_SECRET`
- `GOOGLE_WEBHOOK_URL` optional but needed for push watches
- `GOOGLE_RENEW_SECRET` optional protection for renew endpoint

Client Expo env:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Do not commit real secrets.

## Agent Work Checklist

Before making changes:

1. Read this `CODEX.md`.
2. Check the specific files involved and their `.web` variants.
3. Check whether the change affects local SQLite, Supabase SQL, Edge Functions,
   or all three.
4. Preserve local-first write behavior unless the task explicitly changes it.
5. Keep user scoping in every query.
6. Respect `googleIsReadonly`.
7. Keep soft-delete filters in UI queries.
8. If changing schema, update all relevant layers:
   `database/schema.ts`, `database/index.ts`, `supabase/auth_profiles.sql`,
   remote/local mapping in `supabaseApi.ts` and `syncEngine.ts`, and any Edge
   Function payloads.
9. If changing Google behavior, inspect `_shared/google_calendar.ts` and the
   client `googleCalendarApi.ts` together.
10. If changing shared/demo behavior, inspect native and web shared screens.

## Testing Guidance

Minimum useful checks:

```bash
npm run lint
```

For app behavior:

- Native calendar CRUD: add/edit/delete event and label.
- Auth: login, signup callback if touched.
- Sync: local pending rows become `synced` after Supabase push.
- Google: status, connect, manual sync, disconnect if touched.
- Web: run `npm run web` if touching `.web` files or shared components.

Because this app depends on Supabase and Google external services, some checks
require valid environment variables and deployed Edge Functions.

## Known Sharp Edges

- `CLAUDE.md` is stale. Prefer this file.
- `initDb()` is a no-op even though old docs describe it as app startup work.
- Web stubs can hide native-only assumptions until runtime. Be explicit about
  platform splits.
- `syncEngine.ts` swallows sync errors with warnings so offline operation stays
  quiet. Debugging sync may require adding temporary logs.
- Local SQLite table creation is additive, not a full migration system. Existing
  devices may need `ALTER TABLE ... ADD COLUMN` paths in `database/index.ts`.
- Supabase `updated_at` is trigger-managed. Client-supplied `updatedAt` is local
  only; remote mappings must convert remote ISO strings back to milliseconds.
- Google Calendar full resync can mark existing Google-origin events deleted
  before re-importing. Be very careful with deletion logic in
  `_shared/google_calendar.ts`.
- Friend and profile features depend on SQL RPCs and grants in
  `supabase/auth_profiles.sql`.
- The development login screen contains a test-account shortcut. Treat it as
  development-only.

## When Updating This Document

Keep `CODEX.md` current whenever you change:

- app startup/auth routing
- local or remote schema
- sync status semantics
- Google Calendar Edge Functions
- web/native platform boundaries
- friend/profile/shared bundle behavior
- required environment variables

Future agents should be able to read this file and understand the live system
without relying on older assumptions from `CLAUDE.md`.
