export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError("The minimum value cannot be greater than the maximum value.");
  }

  return Math.min(Math.max(value, min), max);
}

export function formatDate(input: Date | string | number, locale = "zh-CN"): string {
  const date = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Cannot format an invalid date.");
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
