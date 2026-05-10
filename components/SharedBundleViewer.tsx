import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  canDelete?: boolean;
};

export type GeneratedShareQr = {
  url: string;
  qrMatrix: boolean[][];
  eventCount: number;
  title: string;
};

type Props = {
  weekKey: string;
  sources: SharedBundleSource[];
  events: WeekCalendarEvent[];
  emptyText?: string;
  defaultSelectedSourceIds?: string[];
  generatedQr?: GeneratedShareQr | null;
  isCreatingQr?: boolean;
  onCreateQr?: () => void;
  onCloseQr?: () => void;
  onDeleteSource?: (sourceId: string) => void;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  onToday?: () => void;
};

function QrMatrix({ matrix }: { matrix: boolean[][] }) {
  return (
    <View style={styles.qrMatrix}>
      {matrix.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.qrRow}>
          {row.map((cell, colIndex) => (
            <View
              key={`${rowIndex}:${colIndex}`}
              style={[
                styles.qrCell,
                cell ? styles.qrCellDark : styles.qrCellLight,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function SharedBundleViewer({
  weekKey,
  sources,
  events,
  emptyText = "표시할 일정 덩어리를 선택하세요.",
  defaultSelectedSourceIds = [],
  generatedQr,
  isCreatingQr = false,
  onCreateQr,
  onCloseQr,
  onDeleteSource,
  onPreviousWeek,
  onNextWeek,
  onToday,
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

  const confirmDelete = (source: SharedBundleSource) => {
    Alert.alert("일정 덩어리 삭제", `${source.title}을 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          setSelectedSourceIds((current) =>
            current.filter((sourceId) => sourceId !== source.id),
          );
          onDeleteSource?.(source.id);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.weekBar}>
        <Pressable style={styles.weekButton} onPress={onPreviousWeek}>
          <Text style={styles.weekButtonText}>이전</Text>
        </Pressable>
        <Pressable style={styles.todayButton} onPress={onToday}>
          <Text style={styles.todayButtonText}>오늘</Text>
        </Pressable>
        <Pressable style={styles.weekButton} onPress={onNextWeek}>
          <Text style={styles.weekButtonText}>다음</Text>
        </Pressable>
      </View>

      <WeekCalendarView
        weekKey={weekKey}
        events={calendarEvents}
        emptyText={emptyText}
      />

      <View style={styles.actionDock}>
        {onCreateQr && (
          <Pressable
            style={[styles.actionButton, styles.qrButton]}
            disabled={isCreatingQr}
            onPress={onCreateQr}
          >
            {isCreatingQr ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text style={styles.qrButtonText}>QR 공유</Text>
            )}
          </Pressable>
        )}

        <Pressable
          style={[styles.actionButton, styles.pickerButton]}
          onPress={() => setIsPickerOpen(true)}
        >
          <Text style={styles.pickerButtonText}>일정 추가</Text>
          <Text style={styles.pickerCountText}>{selectedSourceIds.length}</Text>
        </Pressable>
      </View>

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
                    {source.canDelete && (
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => confirmDelete(source)}
                      >
                        <Text style={styles.deleteButtonText}>삭제</Text>
                      </Pressable>
                    )}
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

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(generatedQr)}
        onRequestClose={onCloseQr}
      >
        <View style={styles.qrBackdrop}>
          <View style={styles.qrSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>딥링크 QR</Text>
                <Text style={styles.qrSubtitle}>
                  {generatedQr?.eventCount ?? 0}개 일정 포함
                </Text>
              </View>
              <Pressable onPress={onCloseQr}>
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>

            {generatedQr && (
              <>
                <QrMatrix matrix={generatedQr.qrMatrix} />
                <Text style={styles.qrTitle}>{generatedQr.title}</Text>
              </>
            )}
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
  weekBar: {
    position: "absolute",
    top: 44,
    left: 16,
    right: 16,
    zIndex: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    pointerEvents: "box-none",
  },
  weekButton: {
    minWidth: 54,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#F2F2F2",
    paddingHorizontal: 12,
  },
  weekButtonText: {
    color: "#222",
    fontSize: 13,
    fontWeight: "700",
  },
  todayButton: {
    minWidth: 58,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#111",
    paddingHorizontal: 14,
  },
  todayButtonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "800",
  },
  actionDock: {
    position: "absolute",
    right: 20,
    bottom: 30,
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  qrButton: {
    minWidth: 86,
    backgroundColor: "#F5D76E",
  },
  qrButtonText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "800",
  },
  pickerButton: {
    gap: 8,
    backgroundColor: "#111",
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
  deleteButton: {
    minHeight: 30,
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#F4E8E8",
    paddingHorizontal: 10,
  },
  deleteButtonText: {
    color: "#B3261E",
    fontSize: 12,
    fontWeight: "800",
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
  qrBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 24,
  },
  qrSheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: "#FFF",
    padding: 20,
  },
  qrSubtitle: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
  qrMatrix: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#FFF",
  },
  qrRow: {
    flex: 1,
    flexDirection: "row",
  },
  qrCell: {
    flex: 1,
  },
  qrCellDark: {
    backgroundColor: "#000",
  },
  qrCellLight: {
    backgroundColor: "#FFF",
  },
  qrTitle: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 14,
  },
});
