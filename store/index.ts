import { create } from 'zustand';
import dayjs from 'dayjs';

export type ViewMode = 'month' | 'week' | 'day';

interface CalendarState {
  selectedDate: string;           // 'YYYY-MM-DD' in local time
  viewMode: ViewMode;
  activeFilterIds: string[];      // label IDs to show; empty = show all

  setSelectedDate: (date: string) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleFilter: (labelId: string) => void;
  clearFilters: () => void;
}

export const useCalendarStore = create<CalendarState>((set) => ({
  selectedDate: dayjs().format('YYYY-MM-DD'),
  viewMode: 'week',
  activeFilterIds: [],

  setSelectedDate: (date) => set({ selectedDate: date }),

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleFilter: (labelId) =>
    set((state) => ({
      activeFilterIds: state.activeFilterIds.includes(labelId)
        ? state.activeFilterIds.filter((id) => id !== labelId)
        : [...state.activeFilterIds, labelId],
    })),

  clearFilters: () => set({ activeFilterIds: [] }),
}));
