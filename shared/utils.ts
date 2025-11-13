export type Grade = "D" | "C" | "B" | "A";

export function calculateGrade(points: number): Grade {
  if (points < 45) return "D";
  if (points < 65) return "C";
  if (points < 85) return "B";
  return "A";
}

export function getInitialPointsByPosition(positionType: string): number {
  switch (positionType) {
    case "department_director":
      return 85;
    case "department_deputy":
    case "management_head":
      return 80;
    case "management_deputy":
      return 80;
    case "division_head":
      return 65;
    case "division_senior":
      return 50;
    case "division_employee":
    default:
      return 35;
  }
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
  const msPerDay = msPerHour * 24;
  const workingHoursPerDay = 8;

  let totalHours = 0;
  const current = new Date(startDate);

  while (current < endDate) {
    const dayStart = new Date(current);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    if (!isWeekend(dayStart)) {
      const rangeStart = current < dayStart ? dayStart : current;
      const rangeEnd = endDate < dayEnd ? endDate : dayEnd;
      const msInDay = rangeEnd.getTime() - rangeStart.getTime();
      const fractionOfDay = msInDay / msPerDay;
      totalHours += fractionOfDay * workingHoursPerDay;
    }

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
