import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockPrismaClient = vi.fn(function () {
  return {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
  };
});

type GlobalWithPrisma = typeof globalThis & { prisma?: ReturnType<typeof mockPrismaClient> };

vi.mock("@prisma/client", () => ({
  PrismaClient: mockPrismaClient,
}));

describe("db PrismaClient singleton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the cached instance on globalThis between tests
    delete (globalThis as unknown as { prisma?: unknown }).prisma;
    // Reload modules fresh
    vi.resetModules();
  });

  it("creates a new PrismaClient and exports it as prisma", async () => {
    const { prisma } = await import("./db");
    expect(prisma).toBeDefined();
    expect(mockPrismaClient).toHaveBeenCalledTimes(1);
    expect(mockPrismaClient).toHaveBeenCalledWith();
  });

  it("caches the PrismaClient on globalThis in non-production", async () => {
    // Ensure NODE_ENV is not "production"
    vi.stubEnv("NODE_ENV", "test");

    const { prisma: instance1 } = await import("./db");
    expect((globalThis as GlobalWithPrisma).prisma).toBe(instance1);
  });

  it("does NOT cache on globalThis in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    // Delete cached global and module first
    delete (globalThis as GlobalWithPrisma).prisma;
    vi.resetModules();

    await import("./db");

    // In production, globalForPrisma.prisma is not set
    // Check that the global cache is NOT set
    // Actually looking at the code: `if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;`
    // So in production, globalThis.prisma should NOT be set

    expect((globalThis as GlobalWithPrisma).prisma).toBeUndefined();
  });

  it("reuses cached instance on subsequent imports", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const { prisma: first } = await import("./db");

    // Clear the call count (first import called constructor)
    mockPrismaClient.mockClear();

    // Second import should reuse the cached instance from globalThis
    vi.resetModules();
    const { prisma: second } = await import("./db");

    // Constructor should NOT have been called again
    expect(mockPrismaClient).not.toHaveBeenCalled();
    expect(second).toBe(first);
  });

  it("exports prisma with ModelAccess shape", async () => {
    const { prisma } = await import("./db");
    expect(prisma).toHaveProperty("$connect");
    expect(prisma).toHaveProperty("$disconnect");
  });
});

// Restore env
afterEach(() => {
  vi.unstubAllEnvs();
});
