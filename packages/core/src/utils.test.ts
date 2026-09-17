import { describe, expect, it } from "vitest";

import { clamp, formatDate } from "./index";

describe("clamp", () => {
  it("keeps values inside the requested range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("rejects an invalid range", () => {
    expect(() => clamp(1, 10, 0)).toThrow(RangeError);
  });
});

describe("formatDate", () => {
  it("formats a date with the requested locale", () => {
    expect(formatDate(new Date(2026, 8, 17), "en-CA")).toBe("2026-09-17");
  });

  it("rejects an invalid date", () => {
    expect(() => formatDate("not-a-date")).toThrow(RangeError);
  });
});
