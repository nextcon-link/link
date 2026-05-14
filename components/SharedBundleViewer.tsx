import React, { useEffect, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import WeekCalendarView, {
  type WeekCalendarEvent,
} from "@/components/WeekCalendarView";

export type SharedBundleSource = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  canDelete?: boolean;
  canChangeColor?: boolean;
};

export type GeneratedShareQr = {
  url: string;
  qrMatrix: boolean[][];
  events: {
    title: string;
    startTime: number;
    endTime: number;
    isAllDay: boolean;
  }[];
  eventCount: number;
  expiresAt: number | null;
  title: string;
};

export type ShareLabelOption = {
  id: string;
  name: string;
  color: string;
};

export type ShareRangePreset = "this_week" | "two_weeks" | "custom";
export type ShareExpiryPreset = "none" | "1" | "7" | "14" | "custom";
export type ShareVisibilityOverride = "visible" | "blind" | "invisible";

export type ShareQrSettings = {
  bundleTitle: string;
  selectedLabelIds: string[];
  includeUnlabeled: boolean;
  eventVisibilityOverrides: Record<string, ShareVisibilityOverride>;
  rangePreset: ShareRangePreset;
  customStartDate: string;
  customEndDate: string;
  expiryPreset: ShareExpiryPreset;
  customExpiryDays: string;
};

type Props = {
  weekKey: string;
  sources: SharedBundleSource[];
  events: WeekCalendarEvent[];
  emptyText?: string;
  defaultSelectedSourceIds?: string[];
  generatedQr?: GeneratedShareQr | null;
  isCreatingQr?: boolean;
  shareLabelOptions?: ShareLabelOption[];
  shareSettings?: ShareQrSettings;
  sharePreviewEvents?: WeekCalendarEvent[];
  sharePreviewWeekKey?: string;
  shareRangeSummary?: string;
  shareExpirySummary?: string;
  shareSettingsError?: string | null;
  canSharePreviewPreviousWeek?: boolean;
  canSharePreviewNextWeek?: boolean;
  shareIncludedEventCount?: number;
  onShareSettingsChange?: (settings: ShareQrSettings) => void;
  onSharePreviewPreviousWeek?: () => void;
  onSharePreviewNextWeek?: () => void;
  onSharePreviewEventPress?: (event: WeekCalendarEvent) => void;
  onCreateQr?: (settings: ShareQrSettings) => void;
  onCloseQr?: () => void;
  onDeleteSource?: (sourceId: string) => void;
  onChangeSourceColor?: (sourceId: string, color: string) => void | Promise<void>;
  onOpenApp?: () => void;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  onToday?: () => void;
  onOpenCalendar?: () => void;
};

type DatePickerTarget = "start" | "end" | null;

const BUNDLE_COLORS = [
  "#DC143C",
  "#6C8AE4",
  "#E27A5F",
  "#3BAF7A",
  "#F5D76E",
  "#C184D8",
];

const RANGE_OPTIONS: { value: ShareRangePreset; label: string }[] = [
  { value: "this_week", label: "이번주" },
  { value: "two_weeks", label: "이번주+다음주" },
  { value: "custom", label: "기타" },
];

const EXPIRY_OPTIONS: { value: ShareExpiryPreset; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "1", label: "1일" },
  { value: "7", label: "7일" },
  { value: "14", label: "14일" },
  { value: "custom", label: "기타" },
];
const SOURCE_DRAWER_HEIGHT = 430;
const SOURCE_DRAWER_HANDLE_HEIGHT = 58;
const SOURCE_DRAWER_CLOSED_Y =
  SOURCE_DRAWER_HEIGHT - SOURCE_DRAWER_HANDLE_HEIGHT;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

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

function formatExpiry(expiresAt: number | null | undefined) {
  if (!expiresAt) return "사라지지 않음";

  const date = new Date(expiresAt);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} 이후 사라짐`;
}

export default function SharedBundleViewer({
  weekKey,
  sources,
  events,
  emptyText = "표시할 일정 덩어리를 선택하세요.",
  defaultSelectedSourceIds = [],
  generatedQr,
  isCreatingQr = false,
  shareLabelOptions = [],
  shareSettings,
  sharePreviewEvents = [],
  sharePreviewWeekKey,
  shareRangeSummary,
  shareExpirySummary,
  shareSettingsError,
  canSharePreviewPreviousWeek = false,
  canSharePreviewNextWeek = false,
  shareIncludedEventCount,
  onShareSettingsChange,
  onSharePreviewPreviousWeek,
  onSharePreviewNextWeek,
  onSharePreviewEventPress,
  onCreateQr,
  onCloseQr,
  onDeleteSource,
  onChangeSourceColor,
  onOpenApp,
  onPreviousWeek,
  onNextWeek,
  onOpenCalendar,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(
    defaultSelectedSourceIds,
  );
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isQrVisible, setIsQrVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] =
    useState<DatePickerTarget>(null);
  const drawerTranslateY = useRef(
    new Animated.Value(SOURCE_DRAWER_CLOSED_Y),
  ).current;
  const drawerYRef = useRef(SOURCE_DRAWER_CLOSED_Y);
  const drawerDragStartYRef = useRef(SOURCE_DRAWER_CLOSED_Y);

  const animateSourceDrawer = (open: boolean) => {
    Animated.spring(drawerTranslateY, {
      toValue: open ? 0 : SOURCE_DRAWER_CLOSED_Y,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  };

  const listSwipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);

        return absDy > 8 && absDy > absDx * 1.15;
      },
      onPanResponderGrant: () => {
        drawerDragStartYRef.current = drawerYRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextY = clamp(
          drawerDragStartYRef.current + gestureState.dy,
          0,
          SOURCE_DRAWER_CLOSED_Y,
        );
        drawerTranslateY.setValue(nextY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldOpen =
          drawerYRef.current < SOURCE_DRAWER_CLOSED_Y * 0.58 ||
          gestureState.vy < -0.45;
        const shouldClose = gestureState.vy > 0.45;

        animateSourceDrawer(shouldClose ? false : shouldOpen);
      },
    }),
  ).current;

  useEffect(() => {
    if (generatedQr) setIsQrVisible(true);
  }, [generatedQr]);

  useEffect(() => {
    const id = drawerTranslateY.addListener(({ value }) => {
      drawerYRef.current = value;
    });

    return () => drawerTranslateY.removeListener(id);
  }, [drawerTranslateY]);

  const calendarEvents = useMemo(() => {
    if (selectedSourceIds.length === 0) return [];

    const selected = new Set(selectedSourceIds);
    const sourceColors = new Map(
      sources.map((source) => [source.id, source.color]),
    );
    const isStacked = selectedSourceIds.length > 1;
    const eventOpacity = isStacked ? 0.55 : 1;

    return events
      .filter((event) => event.source && selected.has(event.source))
      .map((event) => ({
        ...event,
        color: event.source ? sourceColors.get(event.source) ?? event.color : event.color,
        opacity: event.opacity ?? eventOpacity,
      }))
      .sort((a, b) => a.startTime - b.startTime);
  }, [events, selectedSourceIds, sources]);

  const toggleSource = (id: string) => {
    setSelectedSourceIds((current) =>
      current.includes(id)
        ? current.filter((sourceId) => sourceId !== id)
        : [...current, id],
    );
  };

  const updateShareSettings = (patch: Partial<ShareQrSettings>) => {
    if (!shareSettings) return;
    onShareSettingsChange?.({ ...shareSettings, ...patch });
  };

  const toggleShareLabel = (id: string) => {
    if (!shareSettings) return;

    const selected = shareSettings.selectedLabelIds.includes(id);
    updateShareSettings({
      selectedLabelIds: selected
        ? shareSettings.selectedLabelIds.filter((labelId) => labelId !== id)
        : [...shareSettings.selectedLabelIds, id],
    });
  };

  const closeShareModal = () => {
    setIsShareModalOpen(false);
    setIsQrVisible(false);
    onCloseQr?.();
  };

  const deleteSource = (source: SharedBundleSource) => {
    setSelectedSourceIds((current) =>
      current.filter((sourceId) => sourceId !== source.id),
    );
    onDeleteSource?.(source.id);
  };

  const confirmDelete = (source: SharedBundleSource) => {
    if (Platform.OS === "web") {
      if (window.confirm(`${source.title}을 삭제할까요?`)) {
        deleteSource(source);
      }
      return;
    }

    Alert.alert("일정 덩어리 삭제", `${source.title}을 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => deleteSource(source),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar} pointerEvents="box-none">
        {onOpenCalendar && (
          <Pressable
            accessibilityLabel="월간 캘린더"
            style={styles.topIconButton}
            onPress={onOpenCalendar}
          >
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={29}
              color="#1B1B20"
            />
          </Pressable>
        )}
      </View>

      <View style={styles.calendarSpacer}>
        <WeekCalendarView
          weekKey={weekKey}
          events={calendarEvents}
          emptyText={emptyText}
          showOverlapHatching
          onPreviousWeek={onPreviousWeek}
          onNextWeek={onNextWeek}
        />
      </View>

      <View style={[styles.actionDock, { bottom: 58 + insets.bottom }]}>
        {onOpenApp && (
          <Pressable
            style={[styles.actionButton, styles.appButton]}
            onPress={onOpenApp}
          >
            <Text style={styles.appButtonText}>앱에서 열기</Text>
          </Pressable>
        )}

        {onCreateQr && shareSettings && (
          <Pressable
            style={[styles.actionButton, styles.qrButton]}
            disabled={isCreatingQr}
            onPress={() => {
              setIsQrVisible(false);
              setIsShareModalOpen(true);
            }}
          >
            {isCreatingQr ? (
              <ActivityIndicator color="#111" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="qrcode"
                  size={23}
                  color="#111"
                />
                <MaterialCommunityIcons
                  name="share-variant"
                  size={22}
                  color="#111"
                />
              </>
            )}
          </Pressable>
        )}
      </View>

      <Animated.View
        accessibilityLabel="표시할 일정 목록"
        style={[
          styles.sourceDrawer,
          { transform: [{ translateY: drawerTranslateY }] },
        ]}
      >
          <View
            style={styles.sourceDrawerHandle}
            {...listSwipeResponder.panHandlers}
          >
            <View style={styles.sourceDrawerGrip} />
            <View style={styles.sourceDrawerLabelRow}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.86}
                numberOfLines={1}
                style={styles.sourceDrawerLabel}
              >
                표시할 일정 추가
              </Text>
              <Text style={styles.sourceDrawerCount}>
                {selectedSourceIds.length}
              </Text>
            </View>
          </View>

          <View style={styles.sourceDrawerHeader}>
            <Text style={styles.sheetTitle}>일정 덩어리</Text>
            <Pressable
              accessibilityLabel="목록 내리기"
              style={styles.drawerCloseButton}
              onPress={() => animateSourceDrawer(false)}
            >
              <MaterialCommunityIcons
                name="chevron-down"
                size={28}
                color="#111"
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sourceDrawerList}
            contentContainerStyle={styles.sourceDrawerListContent}
          >
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
                    <Text style={styles.sourceSubtitle}>{source.subtitle}</Text>
                    {onChangeSourceColor && source.canChangeColor !== false && (
                      <View style={styles.bundleColorRow}>
                        {BUNDLE_COLORS.map((color) => {
                          const isSelected = source.color === color;

                          return (
                            <Pressable
                              key={`${source.id}:${color}`}
                              style={[
                                styles.bundleColorSwatch,
                                { backgroundColor: color },
                                isSelected && styles.bundleColorSwatchSelected,
                              ]}
                              onPress={(event) => {
                                event.stopPropagation();
                                onChangeSourceColor(source.id, color);
                              }}
                            />
                          );
                        })}
                      </View>
                    )}
                  </View>
                  {source.canDelete && (
                    <Pressable
                      style={styles.deleteButton}
                      onPress={(event) => {
                        event.stopPropagation();
                        confirmDelete(source);
                      }}
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
      </Animated.View>

      <Modal
        animationType="fade"
        transparent
        visible={isShareModalOpen}
        onRequestClose={closeShareModal}
      >
        <View style={styles.qrBackdrop}>
          <View style={styles.qrSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {isQrVisible ? "QR 코드 생성됨" : "공유 미리보기"}
                </Text>
                <Text style={styles.qrSubtitle}>
                  {isQrVisible
                    ? formatExpiry(generatedQr?.expiresAt)
                    : `${shareIncludedEventCount ?? sharePreviewEvents.length}개 일정 포함`}
                </Text>
              </View>
              <Pressable onPress={closeShareModal}>
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>

            {!isQrVisible && shareSettings && (
              <>
                <ScrollView style={styles.shareSettingsScroll}>
                  <Text style={styles.settingLabel}>일정 덩어리 이름</Text>
                  <TextInput
                    style={styles.titleInput}
                    value={shareSettings.bundleTitle}
                    onChangeText={(bundleTitle) =>
                      updateShareSettings({ bundleTitle })
                    }
                    placeholder="예: 민서의 시험 주간 일정"
                    placeholderTextColor="#999"
                  />

                  <View style={styles.previewCalendarHeader}>
                    <Pressable
                      style={[
                        styles.miniWeekButton,
                        !canSharePreviewPreviousWeek && styles.disabledButton,
                      ]}
                      disabled={!canSharePreviewPreviousWeek}
                      onPress={onSharePreviewPreviousWeek}
                    >
                      <Text style={styles.miniWeekButtonText}>이전</Text>
                    </Pressable>
                    <View style={styles.previewCalendarTitleBox}>
                      <Text style={styles.previewTitle}>시간표</Text>
                      <Text style={styles.previewMeta}>
                        {sharePreviewWeekKey ?? weekKey}
                      </Text>
                    </View>
                    <Pressable
                      style={[
                        styles.miniWeekButton,
                        !canSharePreviewNextWeek && styles.disabledButton,
                      ]}
                      disabled={!canSharePreviewNextWeek}
                      onPress={onSharePreviewNextWeek}
                    >
                      <Text style={styles.miniWeekButtonText}>다음</Text>
                    </Pressable>
                  </View>
                  <View style={styles.previewCalendarBox}>
                    <WeekCalendarView
                      weekKey={sharePreviewWeekKey ?? weekKey}
                      events={sharePreviewEvents}
                      emptyText="공유 가능한 일정이 없습니다."
                      minDayWidth={70}
                      hourHeight={44}
                      contentPaddingHorizontal={8}
                      nestedScrollEnabled
                      horizontalScrollEnabled
                      onEventPress={onSharePreviewEventPress}
                    />
                  </View>
                  <Text style={styles.previewHint}>
                    일정을 눌러 이 QR에서만 공개 상태를 바꿀 수 있어요.
                  </Text>

                  <Text style={styles.settingLabel}>공유할 기간</Text>
                  <Text style={styles.previewMeta}>{shareRangeSummary}</Text>
                  <View style={styles.optionRow}>
                    {RANGE_OPTIONS.map((option) => {
                      const selected = shareSettings.rangePreset === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.optionChip,
                            selected && styles.optionChipSelected,
                          ]}
                          onPress={() =>
                            updateShareSettings({ rangePreset: option.value })
                          }
                        >
                          <Text
                            style={[
                              styles.optionText,
                              selected && styles.optionTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {shareSettings.rangePreset === "custom" && (
                    <View style={styles.inputRow}>
                      <Pressable
                        style={styles.dateInput}
                        onPress={() => setDatePickerTarget("start")}
                      >
                        <Text style={styles.dateInputText}>
                          {shareSettings.customStartDate || "시작일 선택"}
                        </Text>
                      </Pressable>
                      <Text style={styles.inputDash}>-</Text>
                      <Pressable
                        style={styles.dateInput}
                        onPress={() => setDatePickerTarget("end")}
                      >
                        <Text style={styles.dateInputText}>
                          {shareSettings.customEndDate || "종료일 선택"}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  <Text style={styles.settingLabel}>상대방 화면에서 사라지는 기간</Text>
                  <Text style={styles.previewMeta}>{shareExpirySummary}</Text>
                  <View style={styles.optionRow}>
                    {EXPIRY_OPTIONS.map((option) => {
                      const selected = shareSettings.expiryPreset === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.optionChip,
                            selected && styles.optionChipSelected,
                          ]}
                          onPress={() =>
                            updateShareSettings({ expiryPreset: option.value })
                          }
                        >
                          <Text
                            style={[
                              styles.optionText,
                              selected && styles.optionTextSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {shareSettings.expiryPreset === "custom" && (
                    <TextInput
                      style={styles.daysInput}
                      value={shareSettings.customExpiryDays}
                      onChangeText={(customExpiryDays) =>
                        updateShareSettings({ customExpiryDays })
                      }
                      keyboardType="number-pad"
                      placeholder="일수"
                      placeholderTextColor="#999"
                    />
                  )}

                  {shareSettingsError && (
                    <Text style={styles.previewError}>{shareSettingsError}</Text>
                  )}

                  <Text style={styles.settingLabel}>공유할 라벨</Text>
                  <View style={styles.shareLabelGrid}>
                    {shareLabelOptions.map((label) => {
                      const selected = shareSettings.selectedLabelIds.includes(label.id);

                      return (
                        <Pressable
                          key={label.id}
                          style={[
                            styles.shareLabelChip,
                            selected && styles.shareLabelChipSelected,
                          ]}
                          onPress={() => toggleShareLabel(label.id)}
                        >
                          <View
                            style={[
                              styles.sourceColor,
                              { backgroundColor: label.color },
                            ]}
                          />
                          <Text
                            style={[
                              styles.shareLabelText,
                              selected && styles.shareLabelTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {label.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      style={[
                        styles.shareLabelChip,
                        shareSettings.includeUnlabeled && styles.shareLabelChipSelected,
                      ]}
                      onPress={() =>
                        updateShareSettings({
                          includeUnlabeled: !shareSettings.includeUnlabeled,
                        })
                      }
                    >
                      <View style={[styles.sourceColor, styles.unlabeledDot]} />
                      <Text
                        style={[
                          styles.shareLabelText,
                          shareSettings.includeUnlabeled &&
                            styles.shareLabelTextSelected,
                        ]}
                      >
                        라벨 없음
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>

                <Pressable
                  style={[
                    styles.primaryShareButton,
                    Boolean(shareSettingsError) && styles.primaryShareButtonDisabled,
                  ]}
                  disabled={Boolean(shareSettingsError) || isCreatingQr}
                  onPress={() => onCreateQr?.(shareSettings)}
                >
                  {isCreatingQr ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryShareButtonText}>QR 보기</Text>
                  )}
                </Pressable>
              </>
            )}

            {generatedQr && isQrVisible && (
              <>
                <QrMatrix matrix={generatedQr.qrMatrix} />
                <Text style={styles.qrTitle}>{generatedQr.title}</Text>
                <Text style={styles.qrSubtitle}>
                  {generatedQr.eventCount}개 일정 포함
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(datePickerTarget)}
        onRequestClose={() => setDatePickerTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.datePickerSheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {datePickerTarget === "start" ? "시작일 선택" : "종료일 선택"}
              </Text>
              <Pressable onPress={() => setDatePickerTarget(null)}>
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>
            <Calendar
              monthFormat="yyyy년 MM월"
              hideArrows={false}
              enableSwipeMonths
              markedDates={
                shareSettings
                  ? {
                      ...(shareSettings.customStartDate
                        ? {
                            [shareSettings.customStartDate]: {
                              selected: true,
                              selectedColor: "#111",
                            },
                          }
                        : {}),
                      ...(shareSettings.customEndDate
                        ? {
                            [shareSettings.customEndDate]: {
                              selected: true,
                              selectedColor: "#6C8AE4",
                            },
                          }
                        : {}),
                    }
                  : {}
              }
              onDayPress={(day: { dateString: string }) => {
                if (datePickerTarget === "start") {
                  updateShareSettings({ customStartDate: day.dateString });
                }
                if (datePickerTarget === "end") {
                  updateShareSettings({ customEndDate: day.dateString });
                }
                setDatePickerTarget(null);
              }}
              theme={{
                backgroundColor: "#FFFFFF",
                calendarBackground: "#FFFFFF",
                textSectionTitleColor: "#111111",
                monthTextColor: "#111111",
                arrowColor: "#111111",
                todayTextColor: "#DC143C",
                dayTextColor: "#111111",
              }}
            />
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
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 116,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingRight: 28,
    paddingBottom: 20,
  },
  calendarSpacer: {
    flex: 1,
    paddingTop: 116,
  },
  topIconButton: {
    width: 31,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  actionDock: {
    position: "absolute",
    right: 20,
    bottom: 58,
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
    minWidth: 92,
    gap: 10,
    backgroundColor: "#F5D76E",
  },
  appButton: {
    minWidth: 96,
    backgroundColor: "#E8F0FF",
  },
  appButtonText: {
    color: "#1C3F8C",
    fontSize: 15,
    fontWeight: "800",
  },
  sourceDrawer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SOURCE_DRAWER_HEIGHT,
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  sourceDrawerHandle: {
    height: SOURCE_DRAWER_HANDLE_HEIGHT,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 8,
    paddingHorizontal: 18,
  },
  sourceDrawerGrip: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CFCFCF",
    marginBottom: 6,
  },
  sourceDrawerLabelRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sourceDrawerLabel: {
    color: "#111",
    fontSize: 14,
    fontWeight: "800",
  },
  sourceDrawerCount: {
    minWidth: 22,
    overflow: "hidden",
    borderRadius: 11,
    backgroundColor: "#111",
    color: "#FFF",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 2,
  },
  sourceDrawerHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    paddingHorizontal: 20,
  },
  drawerCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceDrawerList: {
    flex: 1,
  },
  sourceDrawerListContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  datePickerSheet: {
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
  bundleColorRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  bundleColorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  bundleColorSwatchSelected: {
    borderColor: "#111",
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
    padding: 14,
  },
  qrSheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "92%",
    borderRadius: 18,
    backgroundColor: "#FFF",
    padding: 18,
  },
  qrSubtitle: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
    textAlign: "center",
  },
  shareSettingsScroll: {
    maxHeight: 560,
  },
  previewTitle: {
    color: "#111",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  previewMeta: {
    color: "#666",
    fontSize: 13,
    fontWeight: "700",
  },
  previewHint: {
    color: "#777",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  titleInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 12,
  },
  settingLabel: {
    color: "#111",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 8,
  },
  shareLabelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  shareLabelChip: {
    minHeight: 34,
    maxWidth: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 17,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 11,
  },
  shareLabelChipSelected: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  shareLabelText: {
    color: "#333",
    fontSize: 13,
    fontWeight: "700",
  },
  shareLabelTextSelected: {
    color: "#FFF",
  },
  unlabeledDot: {
    backgroundColor: "#AAA",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 17,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 12,
  },
  optionChipSelected: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  optionText: {
    color: "#333",
    fontSize: 13,
    fontWeight: "700",
  },
  optionTextSelected: {
    color: "#FFF",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  dateInput: {
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  dateInputText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "700",
  },
  inputDash: {
    color: "#666",
    fontSize: 14,
    fontWeight: "800",
  },
  daysInput: {
    width: 100,
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    color: "#111",
    fontSize: 14,
    marginTop: 8,
    paddingHorizontal: 10,
  },
  previewError: {
    color: "#B3261E",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  previewCalendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
  },
  previewCalendarTitleBox: {
    alignItems: "center",
  },
  miniWeekButton: {
    minHeight: 30,
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#F2F2F2",
    paddingHorizontal: 12,
  },
  miniWeekButtonText: {
    color: "#222",
    fontSize: 12,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.35,
  },
  previewCalendarBox: {
    height: 280,
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 8,
  },
  primaryShareButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: "#111",
    marginTop: 16,
  },
  primaryShareButtonDisabled: {
    opacity: 0.4,
  },
  primaryShareButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
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
