// expo-sqlite is not supported on web.
// This stub prevents Metro bundler errors when building the web target.
export const db = null as any;
export async function initDb(): Promise<void> {}
