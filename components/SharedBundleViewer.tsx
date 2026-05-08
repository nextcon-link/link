import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import WeekCalendarView, {
  type WeekCalendarEvent,
} from "@/components/WeekCalendarView";

export type SharedBundleSource = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
};

type Props = {
  weekKey: string;
  sources: SharedBundleSource[];
  events: WeekCalendarEvent[];
  emptyText?: string;
  defaultSelectedSourceIds?: string[];
};

export default function SharedBundleViewer({
  weekKey,
  sources,
  events,
  emptyText = "표시할 일정 덩어리를 선택하세요.",
  defaultSelectedSourceIds = [],
}: Props) {
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(
    defaultSelectedSourceIds,
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const calendarEvents = useMemo(() => {
    if (selectedSourceIds.length === 0) return [];

    const selected = new Set(selectedSourceIds);
    const isStacked = selectedSourceIds.length > 1;
    const eventOpacity = isStacked ? 0.55 : 1;

    return events
      .filter((event) => event.source && selected.has(event.source))
      .map((event) => ({
        ...event,
        opacity: event.opacity ?? eventOpacity,
      }))
      .sort((a, b) => a.startTime - b.startTime);
  }, [events, selectedSourceIds]);

  const toggleSource = (id: string) => {
    setSelectedSourceIds((current) =>
      current.includes(id)
        ? current.filter((sourceId) => sourceId !== id)
        : [...current, id],
    );
  };

  return (
    <View style={styles.container}>
      <WeekCalendarView
        weekKey={weekKey}
        events={calendarEvents}
        emptyText={emptyText}
      />

      <Pressable
        style={styles.pickerButton}
        onPress={() => setIsPickerOpen(true)}
      >
        <Text style={styles.pickerButtonText}>일정 선택</Text>
        <Text style={styles.pickerCountText}>{selectedSourceIds.length}</Text>
      </Pressable>

      <Modal
        animationType="slide"
        transparent
        visible={isPickerOpen}
        onRequestClose={() => setIsPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>일정 덩어리</Text>
              <Pressable onPress={() => setIsPickerOpen(false)}>
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>

            <ScrollView>
              {sources.map((source) => {
                const selected = selectedSourceIds.includes(source.id);
                return (
                  <Pressable
                    key={source.id}
                    style={styles.sourceRow}
                    onPress={() => toggleSource(source.id)}
                  >
                    <View
                      style={[
                        styles.sourceColor,
                        { backgroundColor: source.color },
                      ]}
                    />
                    <View style={styles.sourceTextBox}>
                      <Text style={styles.sourceTitle}>{source.title}</Text>
                      <Text style={styles.sourceSubtitle}>
                        {source.subtitle}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        selected && styles.checkboxSelected,
                      ]}
                    >
                      {selected && <Text style={styles.checkText}>✓</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  pickerButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111",
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  pickerButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pickerCountText: {
    minWidth: 22,
    overflow: "hidden",
    borderRadius: 11,
    backgroundColor: "#FFF",
    color: "#111",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 2,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: {
    maxHeight: "70%",
    backgroundColor: "#FFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: "800",
  },
  closeText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    paddingVertical: 14,
  },
  sourceColor: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  sourceTextBox: {
    flex: 1,
  },
  sourceTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "700",
  },
  sourceSubtitle: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BBB",
    borderRadius: 13,
  },
  checkboxSelected: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  checkText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
