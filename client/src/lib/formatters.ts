const moneyFormatter = new Intl.NumberFormat("ru-RU");

export function formatMoney(value: number | null | undefined, suffix = "сум"): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return `0 ${suffix}`;
  }
  return `${moneyFormatter.format(Math.round(value))} ${suffix}`.trim();
}

function pluralize(value: number, forms: [string, string, string]): string {
  const abs = Math.abs(value) % 100;
  const mod10 = abs % 10;

  if (abs > 10 && abs < 20) {
    return forms[2];
  }

  if (mod10 > 1 && mod10 < 5) {
    return forms[1];
  }

  if (mod10 === 1) {
    return forms[0];
  }

  return forms[2];
}

export function formatTimeRemaining(value: string | Date): string {
  const target = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(target.getTime())) {
    return "—";
  }

  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) {
    return "Завершено";
  }

  const totalMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  const minutesInDay = 60 * 24;
  const days = Math.floor(totalMinutes / minutesInDay);
  const hours = Math.floor((totalMinutes % minutesInDay) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ${pluralize(days, ["день", "дня", "дней"])}`);
  }

  if (hours > 0 && parts.length < 2) {
    parts.push(`${hours} ${pluralize(hours, ["час", "часа", "часов"])}`);
  }

  if (parts.length < 2 && minutes > 0) {
    parts.push(`${minutes} ${pluralize(minutes, ["минута", "минуты", "минут"])}`);
  }

  if (parts.length === 0) {
    return "менее минуты";
  }

  return parts.slice(0, 2).join(" ");
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
