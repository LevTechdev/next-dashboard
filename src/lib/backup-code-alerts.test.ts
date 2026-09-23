import { describe, expect, it, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const update = vi.fn();
const create = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      update: (...args: unknown[]) => update(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

const { warnOnLowBackupCodes } = await import("./backup-code-alerts");

describe("warnOnLowBackupCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "n1" });
    update.mockResolvedValue({ id: "n1" });
  });

  it("stays silent while the set is healthy", async () => {
    await warnOnLowBackupCodes("user-1", 10);
    expect(create).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("raises a deep-linked alert once the set runs low", async () => {
    await warnOnLowBackupCodes("user-1", 2);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "alert",
        title: "Only 2 backup recovery codes left",
        // The link is what makes the alert actionable.
        link: "/security",
      }),
    });
  });

  it("escalates the copy when the last code is spent", async () => {
    await warnOnLowBackupCodes("user-1", 0);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: "No backup recovery codes left" }),
    });
  });

  it("refreshes the existing alert instead of stacking duplicates", async () => {
    findFirst.mockResolvedValue({ id: "existing" });
    await warnOnLowBackupCodes("user-1", 1);
    expect(create).not.toHaveBeenCalled();
    // Re-surfaces as unread so a user who dismissed it still sees the drop.
    expect(update).toHaveBeenCalledWith({
      where: { id: "existing" },
      data: expect.objectContaining({ read: false, readAt: null }),
    });
  });

  it("never throws into the sign-in path", async () => {
    create.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(warnOnLowBackupCodes("user-1", 0)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
