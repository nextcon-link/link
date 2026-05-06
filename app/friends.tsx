import { Stack, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  addFriendByUsername,
  FriendApiError,
  listFriends,
  removeFriend,
  type FriendProfile,
} from "@/services/friendApi";

function getErrorMessage(error: unknown): string {
  if (error instanceof FriendApiError) {
    switch (error.code) {
      case "empty_username":
        return "친구의 아이디를 입력하세요.";
      case "user_not_found":
        return "해당 아이디의 사용자를 찾을 수 없습니다.";
      case "cannot_add_self":
        return "자기 자신은 친구로 추가할 수 없습니다.";
      case "already_friends":
        return "이미 친구로 추가된 사용자입니다.";
      case "not_authenticated":
        return "로그인이 필요합니다.";
      default:
        return "친구 정보를 처리하지 못했습니다.";
    }
  }

  return "친구 정보를 처리하지 못했습니다.";
}

function getProfileName(friend: FriendProfile): string {
  return friend.display_name || friend.username || "이름 없음";
}

export default function FriendsScreen() {
  const [username, setUsername] = useState("");
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshFriends = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const rows = await listFriends();
      setFriends(rows);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshFriends();
    }, [refreshFriends]),
  );

  const handleAddFriend = async () => {
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const added = await addFriendByUsername(username);
      setFriends((current) => {
        const withoutDuplicate = current.filter(
          (friend) => friend.id !== added.id,
        );
        return [...withoutDuplicate, added].sort((a, b) =>
          getProfileName(a).localeCompare(getProfileName(b)),
        );
      });
      setUsername("");
      setMessage("친구를 추가했습니다.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    setMessage(null);
    setError(null);
    setFriends((current) => current.filter((friend) => friend.id !== friendId));

    try {
      await removeFriend(friendId);
      setMessage("친구를 삭제했습니다.");
    } catch (e) {
      setError(getErrorMessage(e));
      refreshFriends();
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "친구" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.container}
      >
        <Text style={styles.title}>친구</Text>
        <Text style={styles.subtitle}>친구의 아이디를 정확히 입력하세요.</Text>

        <View style={styles.addBox}>
          <TextInput
            autoCapitalize="none"
            onChangeText={setUsername}
            placeholder="친구 아이디"
            placeholderTextColor="#999"
            style={styles.input}
            value={username}
          />
          <Pressable
            disabled={isSubmitting}
            onPress={handleAddFriend}
            style={[
              styles.addButton,
              isSubmitting && styles.disabledButton,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.addButtonText}>친구 추가</Text>
            )}
          </Pressable>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
        {message && <Text style={styles.messageText}>{message}</Text>}

        <Text style={styles.sectionTitle}>친구 목록</Text>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
          </View>
        ) : friends.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>아직 추가한 친구가 없습니다.</Text>
          </View>
        ) : (
          friends.map((friend) => (
            <View key={friend.id} style={styles.friendItem}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getProfileName(friend).slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{getProfileName(friend)}</Text>
                {friend.username && (
                  <Text style={styles.friendUsername}>@{friend.username}</Text>
                )}
              </View>
              <Pressable
                onPress={() => handleRemoveFriend(friend.id)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteButtonText}>삭제</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: "#111",
    fontSize: 26,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#666",
    fontSize: 14,
    marginTop: 6,
    marginBottom: 20,
  },
  addBox: {
    gap: 10,
  },
  input: {
    backgroundColor: "#FAFAFA",
    borderColor: "#CCC",
    borderRadius: 10,
    borderWidth: 1,
    color: "#111",
    fontSize: 16,
    padding: 12,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 48,
  },
  disabledButton: {
    opacity: 0.7,
  },
  addButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: "#D9534F",
    fontSize: 13,
    marginTop: 12,
  },
  messageText: {
    color: "#2E7D32",
    fontSize: 13,
    marginTop: 12,
  },
  sectionTitle: {
    color: "#111",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    marginTop: 30,
  },
  loadingBox: {
    alignItems: "center",
    padding: 30,
  },
  emptyBox: {
    borderColor: "#DDD",
    borderRadius: 10,
    borderWidth: 1,
    padding: 18,
  },
  emptyText: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
  },
  friendItem: {
    alignItems: "center",
    borderColor: "#DDD",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    padding: 12,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    color: "#111",
    fontSize: 16,
    fontWeight: "700",
  },
  friendUsername: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
  deleteButton: {
    backgroundColor: "#D9534F",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
