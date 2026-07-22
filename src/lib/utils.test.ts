import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  getInitials,
  getStatusColor,
  generateId,
  salesChannels,
} from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats amount in IDR", () => {
    const result = formatCurrency(50000);
    expect(result).toContain("50");
    expect(result).toContain("0");
  });

  it("formats zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0");
  });

  it("formats large numbers", () => {
    const result = formatCurrency(1000000);
    expect(result).toContain("1");
    expect(result).toContain("0");
  });
});

describe("formatNumber", () => {
  it("formats numbers below 1000", () => {
    expect(formatNumber(500)).toBe("500");
  });

  it("formats thousands as K", () => {
    expect(formatNumber(1500)).toBe("1.5K");
  });

  it("formats millions as M", () => {
    expect(formatNumber(2500000)).toBe("2.5M");
  });

  it("handles zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatDate", () => {
  it("formats a Date object", () => {
    const date = new Date("2024-06-15");
    const result = formatDate(date);
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  it("formats a date string", () => {
    const result = formatDate("2024-01-01");
    expect(result).toContain("Jan");
    expect(result).toContain("1");
    expect(result).toContain("2024");
  });
});

describe("formatDateTime", () => {
  it("formats date and time", () => {
    const date = new Date("2024-06-15T14:30:00");
    const result = formatDateTime(date);
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("2024");
    expect(result).toContain("2");
    expect(result).toContain("30");
  });

  it("handles string input", () => {
    const result = formatDateTime("2024-01-01T10:00:00");
    expect(result).toContain("10");
  });
});

describe("getInitials", () => {
  it("extracts initials from full name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("handles single name", () => {
    expect(getInitials("Admin")).toBe("A");
  });

  it("handles triple names", () => {
    expect(getInitials("Sarah Johnson Smith")).toBe("SJ");
  });

  it("returns uppercase initials", () => {
    expect(getInitials("john doe")).toBe("JD");
  });

  it("handles empty string", () => {
    expect(getInitials("")).toBe("");
  });
});

describe("getStatusColor", () => {
  it("returns yellow for PENDING", () => {
    const result = getStatusColor("PENDING");
    expect(result).toContain("yellow");
  });

  it("returns green for DELIVERED", () => {
    const result = getStatusColor("DELIVERED");
    expect(result).toContain("green");
  });

  it("returns red for CANCELLED", () => {
    const result = getStatusColor("CANCELLED");
    expect(result).toContain("red");
  });

  it("returns gray default for unknown status", () => {
    const result = getStatusColor("UNKNOWN_STATUS");
    expect(result).toContain("gray");
  });

  it("returns purple for VIP", () => {
    const result = getStatusColor("VIP");
    expect(result).toContain("purple");
  });
});

describe("generateId", () => {
  it("generates a string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
  });

  it("generates unique ids", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it("generates ids of reasonable length", () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(5);
    expect(id.length).toBeLessThan(20);
  });
});

describe("salesChannels", () => {
  it("contains 6 predefined channels", () => {
    expect(salesChannels).toHaveLength(6);
  });

  it("includes Online Store", () => {
    expect(salesChannels.map((c) => c.name)).toContain("Online Store");
  });

  it("each channel has required fields", () => {
    for (const channel of salesChannels) {
      expect(channel).toHaveProperty("id");
      expect(channel).toHaveProperty("name");
      expect(channel).toHaveProperty("slug");
      expect(channel).toHaveProperty("icon");
    }
  });
});
