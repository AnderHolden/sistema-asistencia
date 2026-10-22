import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getFullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`;
}

export function calculateAge(dateOfBirth: string) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function formatPercentage(value: number, total: number) {
  if (total === 0) return "0.0";
  return ((value / total) * 100).toFixed(1);
}

export function sanitizeHtml(str: string) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function generateId() {
  return crypto.randomUUID();
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function isToday(dateStr: string) {
  const today = getTodayDate();
  return dateStr === today;
}

export function getDayName(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CO", { weekday: "long" });
}

export function getMonthName(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CO", { month: "long" });
}

export function isWeekday(dateStr: string): boolean {
  const date = new Date(dateStr + "T12:00:00");
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function getWeekdaysBetween(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const current = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  while (current <= end) {
    const day = current.getDay();
    if (day >= 1 && day <= 5) {
      days.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function moveToNextMonday(date: Date): Date {
  const day = date.getDay();
  if (day === 1) return date;
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  return addDays(date, daysUntilMonday);
}

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Retorna el conjunto de días festivos oficiales de Colombia (Ley 51 de 1983 / Ley Emiliani)
 * para un año calendario dado en formato YYYY-MM-DD.
 */
export function getColombianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  // 1. Festivos de fecha fija
  const fixed = ["01-01", "05-01", "07-20", "08-07", "12-08", "12-25"];
  for (const mmdd of fixed) {
    holidays.add(`${year}-${mmdd}`);
  }

  // 2. Festivos trasladables al lunes (Ley Emiliani)
  const emilianiDates = [
    [1, 6],   // Reyes Magos
    [3, 19],  // San José
    [6, 29],  // San Pedro y San Pablo
    [8, 15],  // Asunción de la Virgen
    [10, 12], // Día de la Raza
    [11, 1],  // Todos los Santos
    [11, 11], // Independencia de Cartagena
  ];
  for (const [month, day] of emilianiDates) {
    const moved = moveToNextMonday(new Date(year, month - 1, day, 12, 0, 0));
    holidays.add(formatYMD(moved));
  }

  // 3. Festivos relativos al Domingo de Pascua
  const easter = getEasterSunday(year);
  holidays.add(formatYMD(addDays(easter, -3))); // Jueves Santo
  holidays.add(formatYMD(addDays(easter, -2))); // Viernes Santo
  holidays.add(formatYMD(moveToNextMonday(addDays(easter, 39)))); // Ascensión del Señor
  holidays.add(formatYMD(moveToNextMonday(addDays(easter, 60)))); // Corpus Christi
  holidays.add(formatYMD(moveToNextMonday(addDays(easter, 68)))); // Sagrado Corazón de Jesús

  return holidays;
}

/**
 * Obtiene los días hábiles reales del calendario entre startDate y endDate (inclusive),
 * excluyendo sábados, domingos, festivos oficiales de Colombia y festivos institucionales adicionales.
 */
export function getBusinessDaysBetween(
  startDate: string,
  endDate: string,
  extraHolidays: string[] = []
): { businessDays: string[]; holidaysInPeriod: string[]; totalWeekdays: number } {
  if (!startDate || !endDate || startDate > endDate) {
    return { businessDays: [], holidaysInPeriod: [], totalWeekdays: 0 };
  }

  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  const holidaySet = new Set<string>(extraHolidays);

  for (let y = startYear; y <= endYear; y++) {
    for (const h of getColombianHolidays(y)) {
      holidaySet.add(h);
    }
  }

  const weekdays = getWeekdaysBetween(startDate, endDate);
  const businessDays: string[] = [];
  const holidaysInPeriod: string[] = [];

  for (const dayStr of weekdays) {
    if (holidaySet.has(dayStr)) {
      holidaysInPeriod.push(dayStr);
    } else {
      businessDays.push(dayStr);
    }
  }

  return {
    businessDays,
    holidaysInPeriod,
    totalWeekdays: weekdays.length,
  };
}