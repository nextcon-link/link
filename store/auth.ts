import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { eq } from "drizzle-orm";

import { db } from "@/database";
import { events, labels } from "@/database/schema";
import { supabase } from "@/services/supabaseApi";

const DEVICE_USER_KEY = "device_user_id";
const ADOPTED_USER_KEY = "adopted_auth_user_id";

type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    username: string,
    displayName: string,
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
};

let unsubscribeAuth: (() => void) | null = null;

async function adoptLegacyDeviceData(userId: string): Promise<void> {
  const adoptedUserId = await AsyncStorage.getItem(ADOPTED_USER_KEY);
  if (adoptedUserId) return;

  const legacyUserId = await AsyncStorage.getItem(DEVICE_USER_KEY);
  if (!legacyUserId || legacyUserId === userId) {
    await AsyncStorage.setItem(ADOPTED_USER_KEY, userId);
    return;
  }

  const legacyLabels = await db
    .select()
    .from(labels)
    .where(eq(labels.userId, legacyUserId));
  for (const label of legacyLabels) {
    await db
      .update(labels)
      .set({
        userId,
        syncStatus:
          label.syncStatus === "pending_create" ||
          label.syncStatus === "pending_delete"
            ? label.syncStatus
            : "pending_update",
        updatedAt: Date.now(),
      })
      .where(eq(labels.id, label.id));
  }

  const legacyEvents = await db
    .select()
    .from(events)
    .where(eq(events.userId, legacyUserId));
  for (const event of legacyEvents) {
    await db
      .update(events)
      .set({
        userId,
        syncStatus:
          event.syncStatus === "pending_create" ||
          event.syncStatus === "pending_delete"
            ? event.syncStatus
            : "pending_update",
        updatedAt: Date.now(),
      })
      .where(eq(events.id, event.id));
  }

  await AsyncStorage.setItem(ADOPTED_USER_KEY, userId);
}

async function applySession(session: Session | null): Promise<void> {
  if (session?.user) {
    await adoptLegacyDeviceData(session.user.id);
  }

  useAuthStore.setState({
    session,
    user: session?.user ?? null,
    isLoading: false,
    isInitialized: true,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({
        session: null,
        user: null,
        isLoading: false,
        isInitialized: true,
      });
    } else {
      await applySession(data.session);
    }

    if (!unsubscribeAuth) {
      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          applySession(session);
        },
      );
      unsubscribeAuth = () => listener.subscription.unsubscribe();
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      set({ isLoading: false });
      return error.message;
    }

    await applySession(data.session);
    return null;
  },

  signUp: async (email, password, username, displayName) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: Linking.createURL("auth-callback"),
        data: {
          username: username.trim(),
          display_name: displayName.trim(),
        },
      },
    });

    set({ isLoading: false });
    if (error) return error.message;

    if (data.session) {
      await applySession(data.session);
    }

    return null;
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      isLoading: false,
      isInitialized: true,
    });
  },
}));
