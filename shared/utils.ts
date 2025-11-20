export type Grade = "D" | "C" | "B" | "A";

export const gradeThresholds: Record<Grade, number> = {
  D: 0,
  C: 55,
  B: 70,
  A: 85,
};

const orderedGrades: Grade[] = ["D", "C", "B", "A"];

export function calculateGrade(points: number): Grade {
  if (points < gradeThresholds.C) return "D";
  if (points < gradeThresholds.B) return "C";
  if (points < gradeThresholds.A) return "B";
  return "A";
}

export function calculateGradeProgress(points: number): {
  grade: Grade;
  nextGrade?: Grade;
  pointsToNext?: number;
} {
  const grade = calculateGrade(points);
  const currentIndex = orderedGrades.indexOf(grade);
  const nextGrade = orderedGrades[currentIndex + 1];

  if (!nextGrade) {
    return { grade };
  }

  const nextThreshold = gradeThresholds[nextGrade];
  const pointsToNext = Math.max(0, nextThreshold - points);

  return { grade, nextGrade, pointsToNext };
}

export type PositionType =
  | "admin"
  | "director"
  | "deputy"
  | "management_head"
  | "management_deputy"
  | "division_head"
  | "senior"
  | "employee";

const gradeByPosition: Record<PositionType, Grade> = {
  admin: "A",
  director: "A",
  deputy: "A",
  management_head: "A",
  management_deputy: "B",
  division_head: "B",
  senior: "C",
  employee: "D",
};

const startingPointsByGrade: Record<Grade, number> = {
  A: 85,
  B: 70,
  C: 55,
  D: 40,
};

export function getGradeByPosition(positionType: PositionType): Grade {
  return gradeByPosition[positionType];
}

export function getInitialPointsByPosition(positionType: PositionType): number {
  if (positionType === "admin") {
    return 0;
  }
  const grade = getGradeByPosition(positionType);
  return startingPointsByGrade[grade];
}

export function getTashkentTime(date: Date): Date {
  // Create a date object for the same instant
  const d = new Date(date);
  // Get the offset for Asia/Tashkent (UTC+5)
  // We use Intl to get the correct local time parts
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(d);

  const part = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0");
  
  // Construct a new Date object that represents the "local" time in Tashkent
  // Note: This date object's "UTC" methods will actually return Tashkent time components if we treat it as UTC,
  // but to keep it simple we just return a Date where getHours() etc return Tashkent time if run in +5 env,
  // OR we just use the parts.
  // Actually, the safest way to do math is to shift the timestamp by the offset difference.
  
  // Simpler approach: use the parts to build a string or just use the parts directly in logic.
  // Let's return a Date object that, when inspected with getUTCHours(), returns the Tashkent hours.
  // This is a "shifted" date.
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second")));
}

export function isWeekend(date: Date): boolean {
  const tashkentDate = getTashkentTime(date);
  const day = tashkentDate.getUTCDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

export function calculateOverdueDays(deadline: Date, completedAt: Date = new Date()): number {
  if (completedAt <= deadline) {
    return 0;
  }

  let days = 0;
  // Use Tashkent time for day boundaries
  const current = getTashkentTime(deadline);
  current.setUTCHours(0, 0, 0, 0);
  
  const end = getTashkentTime(completedAt);
  end.setUTCHours(0, 0, 0, 0);
  
  while (current.getTime() < end.getTime()) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) {
      days++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return days;
}

/**
 * Calculate difference in working hours between two dates, excluding weekends
 * Assumes 9 working hours per day (09:00 - 18:00)
 * @param startDate - Start date/time
 * @param endDate - End date/time
 * @returns Number of working hours (can be fractional)
 */
export function diffWorkingHours(startDate: Date, endDate: Date): number {
  if (endDate <= startDate) {
    return 0;
  }

  const msPerHour = 1000 * 60 * 60;
  const workdayStartHour = 9;
  const workdayEndHour = 18; // Changed from 17 to 18

  let totalHours = 0;
  
  // Convert to Tashkent "shifted" time (UTC methods return Tashkent components)
  const current = getTashkentTime(startDate);
  const end = getTashkentTime(endDate);

  while (current.getTime() < end.getTime()) {
    const day = current.getUTCDay();
    if (day === 0 || day === 6) {
      // Skip weekend
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(0, 0, 0, 0);
      continue;
    }

    const dayWorkStart = new Date(current);
    dayWorkStart.setUTCHours(workdayStartHour, 0, 0, 0);
    
    const dayWorkEnd = new Date(current);
    dayWorkEnd.setUTCHours(workdayEndHour, 0, 0, 0);

    const windowStartMs = Math.max(current.getTime(), dayWorkStart.getTime());
    const windowEndMs = Math.min(end.getTime(), dayWorkEnd.getTime());

    if (windowEndMs > windowStartMs) {
      totalHours += (windowEndMs - windowStartMs) / msPerHour;
    }

    // Move to the start of the next day
    current.setUTCDate(current.getUTCDate() + 1);
    current.setUTCHours(0, 0, 0, 0);
  }

  return totalHours;
}

/**
 * Add working hours to a date, excluding weekends
 * @param startDate - Start date/time
 * @param hours - Number of working hours to add (9-18 workday)
 * @returns New date/time after adding working hours
 */
export function addWorkingHours(startDate: Date, hours: number): Date {
  const msPerHour = 1000 * 60 * 60;
  const workdayStartHour = 9;
  const workdayEndHour = 18; // Changed from 17 to 18

  let remainingHours = hours;
  
  // Work with Tashkent time
  const current = getTashkentTime(startDate);

  while (remainingHours > 0) {
    const day = current.getUTCDay();
    if (day === 0 || day === 6) {
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(workdayStartHour, 0, 0, 0);
      continue;
    }

    const currentHour = current.getUTCHours() + current.getUTCMinutes() / 60;

    if (currentHour < workdayStartHour) {
      current.setUTCHours(workdayStartHour, 0, 0, 0);
      continue;
    }

    if (currentHour >= workdayEndHour) {
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(workdayStartHour, 0, 0, 0);
      continue;
    }

    const hoursUntilEndOfDay = workdayEndHour - currentHour;
    const hoursToAdd = Math.min(remainingHours, hoursUntilEndOfDay);
    
    current.setTime(current.getTime() + hoursToAdd * msPerHour);
    remainingHours -= hoursToAdd;

    if (remainingHours > 0) {
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(workdayStartHour, 0, 0, 0);
    }
  }

  // Convert back from Tashkent "shifted" time to real UTC timestamp
  // We need to reverse the shift. 
  // Since we don't know the exact offset (DST etc) easily without a library, 
  // we can use the difference between the original date and its Tashkent representation 
  // BUT wait, the offset might change if we crossed a DST boundary (though Uzbekistan doesn't observe DST currently).
  // Uzbekistan is fixed UTC+5.
  
  // Simple reverse for UTC+5:
  // The 'current' is effectively UTC time that LOOKS like Tashkent time.
  // So if 'current' says 18:00 UTC, it means 18:00 Tashkent.
  // 18:00 Tashkent is 13:00 UTC.
  // So we subtract 5 hours.
  
  return new Date(current.getTime() - 5 * 60 * 60 * 1000);
}
