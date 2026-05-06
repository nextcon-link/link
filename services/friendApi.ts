import { supabase } from "@/services/supabaseApi";

export type FriendProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type FriendApiErrorCode =
  | "empty_username"
  | "user_not_found"
  | "cannot_add_self"
  | "already_friends"
  | "not_authenticated"
  | "unknown";

export class FriendApiError extends Error {
  code: FriendApiErrorCode;

  constructor(code: FriendApiErrorCode) {
    super(code);
    this.name = "FriendApiError";
    this.code = code;
  }
}

function toFriendApiError(error: { message?: string } | null): FriendApiError {
  const message = error?.message ?? "";

  if (message.includes("user_not_found")) {
    return new FriendApiError("user_not_found");
  }
  if (message.includes("cannot_add_self")) {
    return new FriendApiError("cannot_add_self");
  }
  if (message.includes("not_authenticated")) {
    return new FriendApiError("not_authenticated");
  }

  return new FriendApiError("unknown");
}

export async function listFriends(): Promise<FriendProfile[]> {
  const { data, error } = await supabase.rpc("get_friends");

  if (error) throw toFriendApiError(error);
  return (data ?? []) as FriendProfile[];
}

export async function addFriendByUsername(
  username: string,
): Promise<FriendProfile> {
  const trimmed = username.trim();
  if (!trimmed) throw new FriendApiError("empty_username");

  const existing = await listFriends();
  if (existing.some((friend) => friend.username === trimmed)) {
    throw new FriendApiError("already_friends");
  }

  const { data, error } = await supabase
    .rpc("add_friend_by_username", { p_username: trimmed })
    .single();

  if (error) throw toFriendApiError(error);
  return data as FriendProfile;
}

export async function removeFriend(friendId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_friend", {
    p_friend_id: friendId,
  });

  if (error) throw toFriendApiError(error);
}
