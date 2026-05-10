export const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDate(dateString: string) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getWeekKey(dateString: string) {
  const date = parseDate(dateString);
  const day = date.getDay();

  date.setDate(date.getDate() - day);

  return formatDate(date);
}

export function getWeekDates(weekKey: string) {
  const baseDate = parseDate(weekKey);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function getCurrentWeekKey() {
  return getWeekKey(formatDate(new Date()));
}

export function addWeeks(weekKey: string, amount: number) {
  const date = parseDate(weekKey);
  date.setDate(date.getDate() + amount * 7);
  return formatDate(date);
}
