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

export function calculateOverdueHours(deadline: Date, completedAt: Date = new Date()): number {
  let hours = 0;
  const current = new Date(deadline);
  
  while (current < completedAt) {
    if (!isWeekend(current)) {
      hours++;
    }
    current.setHours(current.getHours() + 1);
  }
  
  return hours;
}
