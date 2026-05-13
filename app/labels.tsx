import { and, eq, isNull, ne } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { db } from "@/database";
import { labels } from "@/database/schema";
import { useAuthStore } from "@/store/auth";
import { sharingMode } from "@/utils/events";
import {
  createLabel,
  deleteLabel,
  toggleLabelVisibility,
  updateLabel,
} from "@/utils/labelService";

const PRESET_COLORS = [
  "#6C8AE4", // 파랑
  "#CF554F", // 빨강
  "#7CDA86", // 초록
  "#E0CF5B", // 노랑
  "#8E4EDB", // 보라
  "#D18A4B", // 주황
];

type VisibilityOption = { label: string, visibility: sharingMode }
const VISIBILITY_LEVEL: VisibilityOption[] = [
  {label:"없음",visibility:"none"},
  {label:"공개",visibility:"visible"},
  {label:"비공개",visibility:"invisible"},
  {label:"부분 공개",visibility:"blind"},
];

function labelStorageText(label: { googleCalendarId: string | null; googleIsReadonly: boolean }) {
  if (label.googleCalendarId) {
    return label.googleIsReadonly ? "Google 읽기전용" : "Google";
  }
  return null;
}

export default function LabelsScreen() {
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [sharingMode, setSharingMode] = useState<sharingMode>("none")
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [editSharingMode, setEditSharingMode] = useState<sharingMode>("none");

  const { data: labelList = [] } = useLiveQuery(
    db
      .select()
      .from(labels)
      .where(and(
        eq(labels.userId, userId),
        ne(labels.syncStatus, "pending_delete"),
        isNull(labels.deletedAt),
      ))
      .orderBy(labels.name),
    [userId],
  );

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createLabel({ name, color, sharingMode });
    setName("");
    setColor(PRESET_COLORS[0]);
    setSharingMode("none");
  };

  const startEdit = (id: string, currentName: string, currentColor: string, currentSharingMode: sharingMode) => {
    setEditingId(id);
    setEditName(currentName);
    setEditColor(currentColor);
    setEditSharingMode(currentSharingMode);
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    await updateLabel(editingId, { name: editName, color: editColor, sharingMode: editSharingMode });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteLabel(id);
    if (editingId === id) setEditingId(null);
  };

  return (
    <>
      <Stack.Screen options={{ title: "라벨 관리" }} />
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>라벨 관리</Text>
        <Pressable
          style={styles.googleButton}
          onPress={() => router.push("/google")}
        >
          <Text style={styles.googleButtonText}>Google Calendar 연동</Text>
        </Pressable>

        {/* ── 라벨 추가 폼 ───────────────────────────────── */}
        <Text style={styles.sectionLabel}>새 라벨</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="예: 수업, 개인, 동아리"
          placeholderTextColor="#999"
        />
        <Text style={styles.sectionLabel}>색상 선택</Text>
        <View style={styles.colorRow}>
          {PRESET_COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityLabel={`${c} 색상 선택`}
              style={[
                styles.colorSwatch,
                { backgroundColor: c },
                color === c && styles.colorSwatchSelected,
              ]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>
        <Text style={styles.sectionLabel}>노출도 설정</Text>
        <View style={styles.row}>
          {VISIBILITY_LEVEL.map((opt) => {
            const selected = sharingMode === opt.visibility;
            return (
              <Pressable
                key={opt.label}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setSharingMode(opt.visibility)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable style={styles.createButton} onPress={handleCreate}>
          <Text style={styles.createButtonText}>라벨 만들기</Text>
        </Pressable>

        {/* ── 라벨 목록 ──────────────────────────────────── */}
        <Text style={styles.sectionTitle}>내 라벨</Text>

        {labelList.map((lbl) =>
          editingId === lbl.id ? (
            // 편집 모드
            <View key={lbl.id} style={[styles.labelItem, styles.editingItem]}>
              <TextInput
                style={[styles.input, styles.editInput]}
                value={editName}
                onChangeText={setEditName}
              />
              <View style={styles.colorRow}>
                {PRESET_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    accessibilityLabel={`${c} 색상 선택`}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      editColor === c && styles.colorSwatchSelected,
                    ]}
                    onPress={() => setEditColor(c)}
                  />
                ))}
              </View>
              <View style={styles.row}>
                {VISIBILITY_LEVEL.map((opt) => {
                  const selected = editSharingMode === opt.visibility;
                  return (
                    <Pressable
                      key={opt.label}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setEditSharingMode(opt.visibility)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.editActions}>
                <Pressable style={styles.saveEditButton} onPress={handleUpdate}>
                  <Text style={styles.saveEditText}>저장</Text>
                </Pressable>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setEditingId(null)}
                >
                  <Text style={styles.cancelText}>취소</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            // 표시 모드
            <View key={lbl.id} style={styles.labelItem}>
              <Pressable
                accessibilityLabel={lbl.isVisible ? "라벨 숨기기" : "라벨 보이기"}
                style={styles.iconButton}
                onPress={() => toggleLabelVisibility(lbl.id)}
              >
                <MaterialCommunityIcons
                  name={lbl.isVisible ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color={lbl.isVisible ? "#171717" : "#9A9A9A"}
                />
              </Pressable>
              <View
                style={[styles.colorDot, { backgroundColor: lbl.color }]}
              />
              <Text numberOfLines={1} style={styles.labelName}>{lbl.name}</Text>
              {labelStorageText(lbl) && (
                <View style={styles.storageBadge}>
                  <Text style={styles.storageBadgeText}>{labelStorageText(lbl)}</Text>
                </View>
              )}
              <View style={styles.labelActions}>
                <Pressable
                  accessibilityLabel="라벨 편집"
                  style={styles.iconButton}
                  onPress={() => startEdit(lbl.id, lbl.name, lbl.color, lbl.sharingMode as sharingMode)}
                >
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={22}
                    color="#171717"
                  />
                </Pressable>
                <Pressable
                  accessibilityLabel="라벨 삭제"
                  style={[styles.iconButton, styles.dangerIconButton]}
                  onPress={() => handleDelete(lbl.id)}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={24}
                    color="#FFFFFF"
                  />
                </Pressable>
              </View>
            </View>
          ),
        )}
      </View>
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
    paddingBottom: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111",
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  googleButton: {
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 10,
    justifyContent: "center",
    marginBottom: 14,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  googleButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionTitle: {
    marginTop: 30,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#111",
    backgroundColor: "#FFF",
  },
  editInput: {
    width: "100%",
  },
  colorRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "#111",
  },
  createButton: {
    backgroundColor: "#111",
    minHeight: 54,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  createButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
  labelItem: {
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 10,
    backgroundColor: "#FFF",
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  editingItem: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  labelName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#111",
  },
  labelActions: {
    flexDirection: "row",
    gap: 6,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  dangerIconButton: {
    backgroundColor: "#CF554F",
  },
  storageBadge: {
    borderWidth: 1,
    borderColor: "#DCDCDC",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#FFF",
  },
  storageBadgeText: {
    color: "#555",
    fontSize: 11,
    fontWeight: "800",
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  saveEditButton: {
    backgroundColor: "#111",
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveEditText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#A0A0A0",
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelText: {
    color: "#FFF",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 13,
    backgroundColor: "#FAFAFA",
  },
  chipSelected: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "700",
  },
  chipTextSelected: {
    color: "#FFF",
    fontWeight: "600",
  },
});
