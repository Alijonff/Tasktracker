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
      return 95;
    case "department_deputy":
    case "management_head":
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
