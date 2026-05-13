import { and, eq, isNull, ne } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
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
  "#DC143C", // 크림슨
  "#4A90E2", // 파랑
  "#E24A4A", // 빨강
  "#4AE27A", // 초록
  "#E2C74A", // 노랑
  "#9B4AE2", // 보라
  "#E2874A", // 주황
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
  return "Link";
}

export default function LabelsScreen() {
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [sharingMode, setSharingMode] = useState<sharingMode>("none")
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);

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
    setSharingMode(currentSharingMode);
  };

  const handleUpdate = async () => {
    if (!editingId || !editName.trim()) return;
    await updateLabel(editingId, { name: editName, color: editColor, sharingMode: sharingMode });
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
          <View key={lbl.id} style={styles.labelItem}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 8 }]}
              value={editName}
              onChangeText={setEditName}
            />
            <View style={styles.colorRow}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
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
              style={styles.visibilityBtn}
              onPress={() => toggleLabelVisibility(lbl.id)}
            >
              <Text style={styles.visibilityIcon}>
                {lbl.isVisible ? "👁" : "🙈"}
              </Text>
            </Pressable>
            <View
              style={[styles.colorDot, { backgroundColor: lbl.color }]}
            />
            <Text style={styles.labelName}>{lbl.name}</Text>
            <Text style={styles.storageBadge}>{labelStorageText(lbl)}</Text>
            <View style={styles.labelActions}>
              <Pressable
                style={styles.editButton}
                onPress={() => startEdit(lbl.id, lbl.name, lbl.color, lbl.sharingMode as sharingMode)}
              >
                <Text style={styles.editButtonText}>편집</Text>
              </Pressable>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDelete(lbl.id)}
              >
                <Text style={styles.deleteButtonText}>삭제</Text>
              </Pressable>
            </View>
          </View>
        ),
      )}

    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  googleButton: {
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 10,
    marginBottom: 10,
    padding: 13,
  },
  googleButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTitle: {
    marginTop: 30,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#111",
  },
  colorRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "#111",
  },
  createButton: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  createButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  labelItem: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  visibilityBtn: {
    padding: 2,
  },
  visibilityIcon: {
    fontSize: 18,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  labelName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "bold",
    color: "#111",
  },
  labelActions: {
    flexDirection: "row",
    gap: 8,
  },
  storageBadge: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 999,
    color: "#555",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editButton: {
    backgroundColor: "#555",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  editButtonText: {
    color: "#FFF",
    fontSize: 13,
  },
  deleteButton: {
    backgroundColor: "#D9534F",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: "#FFF",
    fontSize: 13,
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  saveEditButton: {
    backgroundColor: "#111",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveEditText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#999",
    paddingVertical: 8,
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
  },
  chipTextSelected: {
    color: "#FFF",
    fontWeight: "600",
  },
});
