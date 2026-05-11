import { router, Stack, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import {
  fetchFriendSchedule,
  saveFriendScheduleBundle,
  type FriendScheduleEvent,
} from "@/services/friendScheduleService";
import { expandEventOccurrences } from "@/services/recurrence";
import { useAuthStore } from "@/store/auth";
import {
  addWeeks,
  formatDate,
  getCurrentWeekKey,
  getWeekDates,
} from "@/utils/date";
import WeekCalendarView, {
  type WeekCalendarEvent,
} from "@/components/WeekCalendarView";

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
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const [username, setUsername] = useState("");
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [friendWeekKey, setFriendWeekKey] = useState(getCurrentWeekKey());
  const [friendEvents, setFriendEvents] = useState<FriendScheduleEvent[]>([]);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [isSavingBundle, setIsSavingBundle] = useState(false);
  const friendWeekDates = useMemo(
    () => getWeekDates(friendWeekKey),
    [friendWeekKey],
  );
  const friendWeekStart = useMemo(
    () => friendWeekDates[0].getTime(),
    [friendWeekDates],
  );
  const friendWeekEnd = useMemo(
    () => {
      const lastDate = friendWeekDates[6];
      return new Date(
        lastDate.getFullYear(),
        lastDate.getMonth(),
        lastDate.getDate(),
        23,
        59,
        59,
        999,
      ).getTime();
    },
    [friendWeekDates],
  );
  const friendCalendarEvents = useMemo<WeekCalendarEvent[]>(
    () =>
      friendEvents
        .flatMap((event) =>
          expandEventOccurrences(
            event,
            new Date(friendWeekStart),
            new Date(friendWeekEnd),
          ),
        )
        .filter(
          (event) =>
            event.startTime <= friendWeekEnd && event.endTime >= friendWeekStart,
        )
        .map((event) => ({
          id: `friend:${event.id}`,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          color: event.color,
          source: "friend",
          editable: false,
          layoutGroupId: "friend",
        }))
        .sort((a, b) => a.startTime - b.startTime),
    [friendEvents, friendWeekEnd, friendWeekStart],
  );

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

  useEffect(() => {
    if (!selectedFriend) return;

    let isActive = true;
    setIsScheduleLoading(true);
    setFriendEvents([]);

    fetchFriendSchedule({
      friendId: selectedFriend.id,
      rangeStart: friendWeekStart,
      rangeEnd: friendWeekEnd,
    })
      .then((rows) => {
        if (isActive) setFriendEvents(rows);
      })
      .catch(() => {
        if (isActive) {
          setError("친구 일정을 불러오지 못했습니다.");
          setFriendEvents([]);
        }
      })
      .finally(() => {
        if (isActive) setIsScheduleLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [friendWeekEnd, friendWeekStart, selectedFriend]);

  const openFriendSchedule = (friend: FriendProfile) => {
    setError(null);
    setMessage(null);
    setSelectedFriend(friend);
    setFriendWeekKey(getCurrentWeekKey());
  };

  const closeFriendSchedule = () => {
    setSelectedFriend(null);
    setFriendEvents([]);
  };

  const handleSaveFriendBundle = async () => {
    if (!selectedFriend || isSavingBundle) return;

    if (!userId) {
      Alert.alert("로그인 필요", "공유탭에 추가하려면 로그인이 필요합니다.");
      return;
    }

    if (friendCalendarEvents.length === 0) {
      Alert.alert("추가할 일정 없음", "이 주에는 공유 가능한 친구 일정이 없습니다.");
      return;
    }

    setIsSavingBundle(true);
    try {
      const count = await saveFriendScheduleBundle({
        userId,
        friend: selectedFriend,
        weekKey: friendWeekKey,
        events: friendCalendarEvents,
      });

      Alert.alert(
        "공유탭에 추가됨",
        `${getProfileName(selectedFriend)}의 ${friendWeekKey} 일정 ${count}개를 일정 덩어리로 추가했습니다.`,
        [
          { text: "계속 보기", style: "cancel" },
          {
            text: "공유탭 보기",
            onPress: () => {
              closeFriendSchedule();
              router.push({ pathname: "/shared", params: { week: friendWeekKey } });
            },
          },
        ],
      );
    } catch {
      Alert.alert("추가 실패", "친구 일정을 공유탭에 추가하지 못했습니다.");
    } finally {
      setIsSavingBundle(false);
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
                onPress={() => openFriendSchedule(friend)}
                style={styles.scheduleButton}
              >
                <Text style={styles.scheduleButtonText}>일정</Text>
              </Pressable>
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

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(selectedFriend)}
        onRequestClose={closeFriendSchedule}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.scheduleSheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleBox}>
                <Text style={styles.sheetTitle}>
                  {selectedFriend ? getProfileName(selectedFriend) : "친구"} 일정
                </Text>
                <Text style={styles.sheetSubtitle}>
                  공유 허용된 일정만 표시됩니다.
                </Text>
              </View>
              <Pressable onPress={closeFriendSchedule}>
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>

            <View style={styles.weekBar}>
              <Pressable
                style={styles.weekButton}
                onPress={() => setFriendWeekKey((current) => addWeeks(current, -1))}
              >
                <Text style={styles.weekButtonText}>이전</Text>
              </Pressable>
              <View style={styles.weekTitleBox}>
                <Text style={styles.weekTitle}>{friendWeekKey}</Text>
                <Text style={styles.weekSubtitle}>
                  {formatDate(friendWeekDates[0])} - {formatDate(friendWeekDates[6])}
                </Text>
              </View>
              <Pressable
                style={styles.weekButton}
                onPress={() => setFriendWeekKey((current) => addWeeks(current, 1))}
              >
                <Text style={styles.weekButtonText}>다음</Text>
              </Pressable>
            </View>

            <View style={styles.scheduleCalendarBox}>
              {isScheduleLoading ? (
                <View style={styles.scheduleLoadingBox}>
                  <ActivityIndicator />
                  <Text style={styles.scheduleLoadingText}>일정을 불러오는 중...</Text>
                </View>
              ) : (
                <WeekCalendarView
                  weekKey={friendWeekKey}
                  events={friendCalendarEvents}
                  emptyText="공유 가능한 친구 일정이 없습니다."
                  minDayWidth={70}
                  hourHeight={48}
                  contentPaddingHorizontal={8}
                  nestedScrollEnabled
                  horizontalScrollEnabled
                />
              )}
            </View>

            <Pressable
              disabled={isSavingBundle || isScheduleLoading}
              onPress={handleSaveFriendBundle}
              style={[
                styles.saveBundleButton,
                (isSavingBundle || isScheduleLoading) && styles.disabledButton,
              ]}
            >
              {isSavingBundle ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBundleButtonText}>공유탭에 일정 덩어리 추가</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
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
  scheduleButton: {
    backgroundColor: "#111",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scheduleButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  scheduleSheet: {
    maxHeight: "92%",
    backgroundColor: "#FFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitleBox: {
    flex: 1,
    paddingRight: 12,
  },
  sheetTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "800",
  },
  sheetSubtitle: {
    color: "#666",
    fontSize: 13,
    marginTop: 3,
  },
  closeText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
  },
  weekBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  weekButton: {
    alignItems: "center",
    backgroundColor: "#F2F2F2",
    borderRadius: 17,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 54,
    paddingHorizontal: 12,
  },
  weekButtonText: {
    color: "#222",
    fontSize: 13,
    fontWeight: "700",
  },
  weekTitleBox: {
    alignItems: "center",
    flex: 1,
  },
  weekTitle: {
    color: "#111",
    fontSize: 15,
    fontWeight: "800",
  },
  weekSubtitle: {
    color: "#666",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  scheduleCalendarBox: {
    height: 420,
    borderColor: "#EEE",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  scheduleLoadingBox: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center",
  },
  scheduleLoadingText: {
    color: "#666",
    fontSize: 13,
    fontWeight: "700",
  },
  saveBundleButton: {
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 23,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 46,
  },
  saveBundleButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
