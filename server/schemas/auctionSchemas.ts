import { z } from "zod";

export const decimalNumberSchema = z
  .union([z.number(), z.string()])
  .transform((value: number | string) => {
    if (typeof value === "number") {
      return value;
    }
    // Remove ALL whitespace (including internal spaces like "999 000")
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    return Number.parseFloat(normalized);
  })
  .pipe(z.number().positive("Значение должно быть больше нуля"));

export const placeBidSchema = z
  .object({
    valueMoney: decimalNumberSchema.optional(),
    valueTimeMinutes: z
      .union([z.string(), z.number()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === "number") return value;
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : NaN;
      })
      .pipe(z.number().int().positive("Значение должно быть больше нуля").optional()),
  })
  .refine((data) => data.valueMoney !== undefined || data.valueTimeMinutes !== undefined, {
    message: "Укажите значение ставки",
  });
