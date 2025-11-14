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
  | "director"
  | "deputy"
  | "management_head"
  | "management_deputy"
  | "division_head"
  | "senior"
  | "employee";

const gradeByPosition: Record<PositionType, Grade> = {
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
  const grade = getGradeByPosition(positionType);
  return startingPointsByGrade[grade];
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

export function calculateOverdueDays(deadline: Date, completedAt: Date = new Date()): number {
  if (completedAt <= deadline) {
    return 0;
  }

  let days = 0;
  const current = new Date(deadline);
  current.setHours(0, 0, 0, 0);
  const end = new Date(completedAt);
  end.setHours(0, 0, 0, 0);
  
  while (current < end) {
    if (!isWeekend(current)) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

/**
 * Calculate difference in working hours between two dates, excluding weekends
 * Assumes 8 working hours per day
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
  const workdayEndHour = 17;

  let totalHours = 0;
  const current = new Date(startDate);

  while (current < endDate) {
    if (isWeekend(current)) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }

    const dayWorkStart = new Date(current);
    dayWorkStart.setHours(workdayStartHour, 0, 0, 0);
    const dayWorkEnd = new Date(current);
    dayWorkEnd.setHours(workdayEndHour, 0, 0, 0);

    const windowStartMs = Math.max(current.getTime(), dayWorkStart.getTime());
    const windowEndMs = Math.min(endDate.getTime(), dayWorkEnd.getTime());

    if (windowEndMs > windowStartMs) {
      totalHours += (windowEndMs - windowStartMs) / msPerHour;
    }

    // Move to the start of the next day
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return totalHours;
}

/**
 * Add working hours to a date, excluding weekends
 * @param startDate - Start date/time
 * @param hours - Number of working hours to add (assumes 8 hour workday)
 * @returns New date/time after adding working hours
 */
export function addWorkingHours(startDate: Date, hours: number): Date {
  const msPerHour = 1000 * 60 * 60;
  const msPerDay = msPerHour * 24;
  const workingHoursPerDay = 8;

  let remainingHours = hours;
  const result = new Date(startDate);

  while (remainingHours > 0) {
    if (!isWeekend(result)) {
      const hoursToAdd = Math.min(remainingHours, workingHoursPerDay);
      result.setTime(result.getTime() + (hoursToAdd / workingHoursPerDay) * msPerDay);
      remainingHours -= hoursToAdd;
    } else {
      result.setDate(result.getDate() + 1);
    }
  }

  return result;
}
