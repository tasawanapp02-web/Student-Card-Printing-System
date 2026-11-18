export const THAI_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

/**
 * Returns current Buddhist Era year (พ.ศ.)
 */
export function getCurrentBuddhistYear(): number {
  const currentCE = new Date().getFullYear();
  return currentCE + 543;
}

/**
 * Safely parses YYYY-MM-DD as local calendar Date to avoid UTC offset day-shift
 */
function parseDateSafe(dateInput?: string | Date | null): Date | null {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    const match = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const d = parseInt(match[3], 10);
      return new Date(y, m, d);
    }
    const parsed = new Date(dateInput);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return isNaN(dateInput.getTime()) ? null : dateInput;
}

/**
 * Convert Date or date string (YYYY-MM-DD) to Thai Full Date format:
 * e.g. "31 มีนาคม 2572"
 */
export function formatThaiDateFull(dateInput?: string | Date | null): string {
  const d = parseDateSafe(dateInput);
  if (!d) return '-';

  const day = d.getDate();
  const monthName = THAI_MONTHS_FULL[d.getMonth()];
  const buddhistYear = d.getFullYear() + 543;

  return `${day} ${monthName} ${buddhistYear}`;
}

/**
 * Convert Date or date string to Thai Short Date format:
 * e.g. "31 มี.ค. 2572"
 */
export function formatThaiDateShort(dateInput?: string | Date | null): string {
  const d = parseDateSafe(dateInput);
  if (!d) return '-';

  const day = d.getDate();
  const monthName = THAI_MONTHS_SHORT[d.getMonth()];
  const buddhistYear = d.getFullYear() + 543;

  return `${day} ${monthName} ${buddhistYear}`;
}

/**
 * Convert Date or date string to Thai Numeric Date format:
 * e.g. "31/03/2572"
 */
export function formatThaiDateNumeric(dateInput?: string | Date | null): string {
  const d = parseDateSafe(dateInput);
  if (!d) return '-';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const buddhistYear = d.getFullYear() + 543;

  return `${day}/${month}/${buddhistYear}`;
}

/**
 * Format Thai date by requested format style
 */
export function formatThaiDateByFormat(
  dateInput?: string | Date | null,
  format: 'short' | 'full' | 'numeric' = 'short'
): string {
  if (format === 'full') return formatThaiDateFull(dateInput);
  if (format === 'numeric') return formatThaiDateNumeric(dateInput);
  return formatThaiDateShort(dateInput);
}

/**
 * Convert Date with Thai Time:
 * e.g. "12 พ.ย. 2569 14:35 น."
 */
export function formatThaiDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';

  const shortDate = formatThaiDateShort(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${shortDate} ${hours}:${minutes} น.`;
}

/**
 * Parses YYYY-MM-DD string into components { day, monthIndex, buddhistYear }
 */
export function parseDateToThaiComponents(dateStr: string): { day: number; month: number; buddhistYear: number } {
  if (!dateStr) {
    const now = new Date();
    return {
      day: now.getDate(),
      month: now.getMonth(),
      buddhistYear: now.getFullYear() + 543,
    };
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return { day: d, month: m, buddhistYear: y + 543 };
  }
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.getMonth(),
    buddhistYear: now.getFullYear() + 543,
  };
}

/**
 * Constructs YYYY-MM-DD from Thai Day, Month Index (0-11), and Buddhist Year
 */
export function constructDateFromThai(day: number, monthIndex: number, buddhistYear: number): string {
  const ceYear = buddhistYear - 543;
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${ceYear}-${mm}-${dd}`;
}

/**
 * Automatic Grade Calculation:
 * Calculate student's current grade (e.g. ม.1, ม.2, ม.3 or ม.4, ม.5, ม.6)
 * based on entry year and current academic year.
 */
export function calculateCurrentGrade(
  level: 'มัธยมศึกษาตอนต้น' | 'มัธยมศึกษาตอนปลาย',
  entryYear: number,
  currentAcademicYear: number = getCurrentBuddhistYear()
): {
  gradeNumber: number;
  gradeLabel: string;
  isGraduated: boolean;
  yearsStudied: number;
} {
  const yearDiff = currentAcademicYear - entryYear;

  if (level === 'มัธยมศึกษาตอนต้น') {
    if (yearDiff === 0) {
      return { gradeNumber: 1, gradeLabel: 'ม.1', isGraduated: false, yearsStudied: 1 };
    } else if (yearDiff === 1) {
      return { gradeNumber: 2, gradeLabel: 'ม.2', isGraduated: false, yearsStudied: 2 };
    } else if (yearDiff === 2) {
      return { gradeNumber: 3, gradeLabel: 'ม.3', isGraduated: false, yearsStudied: 3 };
    } else {
      return { gradeNumber: 3, gradeLabel: 'ม.3 (จบการศึกษาแล้ว)', isGraduated: true, yearsStudied: yearDiff + 1 };
    }
  } else {
    // มัธยมศึกษาตอนปลาย
    if (yearDiff === 0) {
      return { gradeNumber: 4, gradeLabel: 'ม.4', isGraduated: false, yearsStudied: 1 };
    } else if (yearDiff === 1) {
      return { gradeNumber: 5, gradeLabel: 'ม.5', isGraduated: false, yearsStudied: 2 };
    } else if (yearDiff === 2) {
      return { gradeNumber: 6, gradeLabel: 'ม.6', isGraduated: false, yearsStudied: 3 };
    } else {
      return { gradeNumber: 6, gradeLabel: 'ม.6 (จบการศึกษาแล้ว)', isGraduated: true, yearsStudied: yearDiff + 1 };
    }
  }
}

/**
 * Calculate 3-Academic-Year Card Expiry Date (End of academic year: 30 เมษายน)
 * Year 1 (M.1 / M.4) -> valid until end of Year 3 (M.3 / M.6)
 * Expiry date is 30 April of (entryYear + 3) in Buddhist Era
 */
export function calculateCardExpiryDate(entryYear: number): string {
  const expiryBuddhistYear = entryYear + 3;
  const expiryCeYear = expiryBuddhistYear - 543;
  return `${expiryCeYear}-04-30`;
}

/**
 * Default issue date string for today (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
