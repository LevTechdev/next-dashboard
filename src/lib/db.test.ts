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
  let prismaMod: typeof import("./db");

  beforeEach(async () => {
    vi.clearAllMocks();
    delete (globalThis as unknown as { prisma?: unknown }).prisma;
    // Only reset modules once at the start of each test to avoid slow
    // Vite module resolution on every import() call.
    vi.resetModules();
    prismaMod = await import("./db");
  });

  it("creates a new PrismaClient and exports it as prisma", () => {
    expect(prismaMod.prisma).toBeDefined();
    expect(mockPrismaClient).toHaveBeenCalledTimes(1);
    expect(mockPrismaClient).toHaveBeenCalledWith();
  });

  it("caches the PrismaClient on globalThis in non-production", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect((globalThis as GlobalWithPrisma).prisma).toBe(prismaMod.prisma);
  });

  it("does NOT cache on globalThis in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete (globalThis as GlobalWithPrisma).prisma;
    vi.resetModules();

    await import("./db");

    expect((globalThis as GlobalWithPrisma).prisma).toBeUndefined();
  });

  it("reuses cached instance on subsequent imports", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const first = prismaMod.prisma;
    mockPrismaClient.mockClear();

    // Second import should reuse the cached instance from globalThis
    vi.resetModules();
    const second = await import("./db");

    expect(mockPrismaClient).not.toHaveBeenCalled();
    expect(second.prisma).toBe(first);
  });

  it("exports prisma with ModelAccess shape", () => {
    expect(prismaMod.prisma).toHaveProperty("$connect");
    expect(prismaMod.prisma).toHaveProperty("$disconnect");
  });
});

// Restore env
afterEach(() => {
  vi.unstubAllEnvs();
});
