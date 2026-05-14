import { getPersistedAuthSession, supabase } from "@/services/supabaseApi";
import { useAuthStore } from "@/store/auth";

export async function getCurrentUserId(): Promise<string> {
  const currentUserId = useAuthStore.getState().user?.id;
  if (currentUserId) return currentUserId;

  const persistedSession = await getPersistedAuthSession();
  if (persistedSession?.user?.id) return persistedSession.user.id;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.user) throw new Error("Not authenticated");
  return session.user.id;
}
