import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";

import type { LabelItem, LabelType } from "../utils/events";
import {
  loadLabels,
  saveLabels,
  loadEvents,
  saveEvents,
} from "../utils/storage";

const LABEL_TYPES: { type: LabelType; text: string }[] = [
  { type: "normal", text: "기본" },
  { type: "blind", text: "블라인드" },
  { type: "private", text: "비공개" },
];

export default function LabelsScreen() {
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState<LabelType>("normal");

  const refreshLabels = async () => {
    const labelsById = await loadLabels();
    setLabels(Object.values(labelsById));
  };

  useEffect(() => {
    refreshLabels();
  }, []);

  const createLabel = async () => {
    if (!name.trim()) return;

    const id = Date.now().toString();

    const newLabel: LabelItem = {
      id,
      name: name.trim(),
      type: selectedType,
    };

    const labelsById = await loadLabels();
    labelsById[id] = newLabel;

    await saveLabels(labelsById);

    setName("");
    setSelectedType("normal");

    const nextLabelsById = await loadLabels();
    setLabels(Object.values(nextLabelsById));
  };

  const deleteLabel = async (id: string) => {
    const labelsById = await loadLabels();
    delete labelsById[id];
    await saveLabels(labelsById);

    const eventsByWeek = await loadEvents();

    Object.values(eventsByWeek).forEach((weekEvents) => {
      Object.values(weekEvents).forEach((event) => {
        if (event.labelId === id) {
          event.labelId = null;
        }
      });
    });

    await saveEvents(eventsByWeek);

    const nextLabelsById = await loadLabels();
    setLabels(Object.values(nextLabelsById));
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>라벨 관리</Text>

      <Text style={styles.label}>라벨 이름</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="예: 수업, 개인, 동아리"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>라벨 타입</Text>
      <View style={styles.row}>
        {LABEL_TYPES.map((item) => {
          const selected = selectedType === item.type;

          return (
            <Pressable
              key={item.type}
              style={[styles.typeButton, selected && styles.selectedButton]}
              onPress={() => setSelectedType(item.type)}
            >
              <Text style={[styles.typeText, selected && styles.selectedText]}>
                {item.text}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.createButton} onPress={createLabel}>
        <Text style={styles.createButtonText}>라벨 만들기</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>내 라벨</Text>

      {labels.map((label) => (
        <View key={label.id} style={styles.labelItem}>
          <View>
            <Text style={styles.labelName}>{label.name}</Text>
            <Text style={styles.labelType}>{label.type}</Text>
          </View>

          <Pressable
            style={styles.deleteButton}
            onPress={() => deleteLabel(label.id)}
          >
            <Text style={styles.deleteButtonText}>삭제</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
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

  label: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    marginTop: 18,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#111",
  },

  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  typeButton: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  selectedButton: {
    backgroundColor: "#111",
    borderColor: "#111",
  },

  typeText: {
    color: "#111",
  },

  selectedText: {
    color: "#FFF",
    fontWeight: "bold",
  },

  createButton: {
    marginTop: 24,
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  createButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },

  sectionTitle: {
    marginTop: 30,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "bold",
  },

  labelItem: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  labelName: {
    fontSize: 16,
    fontWeight: "bold",
  },

  labelType: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },

  deleteButton: {
    backgroundColor: "#D9534F",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  deleteButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});