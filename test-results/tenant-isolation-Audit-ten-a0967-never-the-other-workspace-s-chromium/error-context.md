# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tenant-isolation.spec.ts >> Audit tenant isolation >> the default workspace sees its own audit rows but never the other workspace's
- Location: e2e\tenant-isolation.spec.ts:61:7

# Error details

```
Error: Command failed: npx tsx --tsconfig scripts/tsconfig.e2e.json scripts/seed-tenant-isolation.ts
npm warn Unknown env config "auto-install-peers". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown project config "auto-install-peers". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown project config "strict-peer-dependencies". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn allow-scripts .npmrc allow-scripts setting is being ignored because --allow-scripts was passed on the command line
PrismaClientKnownRequestError: 
Invalid `prisma.activityLog.create()` invocation in
D:\Project\next-dashboard\scripts\seed-tenant-isolation.ts:97:28

  94   }
  95 }
  96 
→ 97 await prisma.activityLog.create(
Server has closed the connection.
    at ei.handleRequestError (D:\Project\next-dashboard\node_modules\@prisma\client\src\runtime\RequestHandler.ts:228:13)
    at ei.handleAndLogRequestError (D:\Project\next-dashboard\node_modules\@prisma\client\src\runtime\RequestHandler.ts:174:12)
    at ei.request (D:\Project\next-dashboard\node_modules\@prisma\client\src\runtime\RequestHandler.ts:143:12)
    at async a (D:\Project\next-dashboard\node_modules\@prisma\client\src\runtime\getPrismaClient.ts:833:24)
    at async seedTenantIsolation (D:\Project\next-dashboard\scripts\seed-tenant-isolation.ts:97:3) {
  code: 'P1017',
  meta: { modelName: 'ActivityLog' },
  clientVersion: '6.19.3'
}

```

# Test source

```ts
  1   | import { prisma } from "@/lib/db";
  2   | import { computeHash, GENESIS_HASH } from "@/lib/audit-hash";
  3   | import { logSecurityEvent, type SecurityEventType } from "@/lib/security-events";
  4   | import { pathToFileURL } from "node:url";
  5   | import bcrypt from "bcryptjs";
  6   | 
  7   | /**
  8   |  * Tenant-isolation fixture for e2e/tenant-isolation.spec.ts.
  9   |  *
  10  |  * Creates a SECOND workspace ("tenant-b") plus a STAFF actor inside it, then
  11  |  * stamps distinguishable audit markers on each side:
  12  |  *   - activityLog A/B rows (ActivityLog has no hash chain → plain inserts)
  13  |  *   - SecurityEvents via the REAL logSecurityEvent write path, so the
  14  |  *     tamper-evident hash chain stays intact (see src/lib/audit-chain.ts)
  15  |  *   - a "poisoned" security event carrying the DEFAULT workspace's userId but
  16  |  *     TENANT B's tenantId — the read-side tenant scope must hide it from both
  17  |  *     feeds (this is the sharpest proof the tenant layer, not just the userId
  18  |  *     filter, is enforced)
  19  |  *
  20  |  * Idempotent: prior-run markers (matching action/type names) are cleared first.
  21  |  * The script is run under tsx with scripts/tsconfig.e2e.json, which aliases
  22  |  * "server-only" to the empty stub exactly like the vitest configs do.
  23  |  */
  24  | export const ISOLATION = {
  25  |   tenantSlug: "tenant-b",
  26  |   email: `isolation-b-${Date.now()}@example.com`,
  27  |   password: "Iso#B-2026-xQ7",
  28  |   actionA: "ISOLATION_TENANT_A_ACTION",
  29  |   actionB: "ISOLATION_TENANT_B_ACTION",
  30  |   eventA: "ISOLATION_TENANT_A_EVENT" as SecurityEventType,
  31  |   eventB: "ISOLATION_TENANT_B_EVENT" as SecurityEventType,
  32  |   contaminated: "ISOLATION_CONTAMINATED_EVENT" as SecurityEventType,
  33  | };
  34  | 
  35  | export async function seedTenantIsolation() {
  36  |   const defaultTenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  37  |   const admin = await prisma.user.findUnique({ where: { email: "nextdashboards@gmail.com" } });
  38  |   if (!defaultTenant || !admin) {
  39  |     throw new Error("Seed not present — run `npm run db:seed` first");
  40  |   }
  41  | 
  42  |   const tenantB = await prisma.tenant.upsert({
  43  |     where: { slug: ISOLATION.tenantSlug },
  44  |     update: {},
  45  |     create: { name: "Tenant B (Isolation)", slug: ISOLATION.tenantSlug },
  46  |   });
  47  | 
  48  |   // Fresh actor in tenant B with a known password (bcrypt is accepted by the
  49  |   // login route via passwordAlgo: "bcrypt").
  50  |   const bUser = await prisma.user.create({
  51  |     data: {
  52  |       name: "Isolation B",
  53  |       email: ISOLATION.email,
  54  |       password: bcrypt.hashSync(ISOLATION.password, 10),
  55  |       passwordAlgo: "bcrypt",
  56  |       role: "STAFF",
  57  |       isActive: true,
  58  |       tenantId: tenantB.id,
  59  |     },
  60  |   });
  61  | 
  62  |   // Clear any prior-run markers so the assertions stay deterministic.
  63  |   await prisma.activityLog.deleteMany({
  64  |     where: { OR: [{ action: ISOLATION.actionA }, { action: ISOLATION.actionB }] },
  65  |   });
  66  |   await prisma.securityEvent.deleteMany({
  67  |     where: {
  68  |       OR: [
  69  |         { type: ISOLATION.eventA },
  70  |         { type: ISOLATION.eventB },
  71  |         { type: ISOLATION.contaminated },
  72  |       ],
  73  |     },
  74  |   });
  75  | 
  76  |   // The deleteMany above removes PREVIOUS runs' markers from the middle of the
  77  |   // tamper-evident chain, which breaks every subsequent link — that's the
  78  |   // chain doing its job, but the fixture must not leave a false-positive
  79  |   // break behind (CI's `npm run check:audit-chain` walks the whole chain).
  80  |   // Re-chain the remaining rows, exactly like prisma/seed.ts does after
  81  |   // wiping users, so the fresh markers below link onto a consistent tail.
  82  |   {
  83  |     const events = await prisma.securityEvent.findMany({ orderBy: { seq: "asc" } });
  84  |     let prevHash = GENESIS_HASH;
  85  |     for (const e of events) {
  86  |       const hash = computeHash(prevHash, e);
  87  |       if (e.hash !== hash || (e.prevHash ?? GENESIS_HASH) !== prevHash) {
  88  |         await prisma.securityEvent.update({
  89  |           where: { id: e.id },
  90  |           data: { prevHash, hash },
  91  |         });
  92  |       }
  93  |       prevHash = hash;
  94  |     }
  95  |   }
  96  | 
> 97  |   await prisma.activityLog.create({
      |                            ^ Error: Command failed: npx tsx --tsconfig scripts/tsconfig.e2e.json scripts/seed-tenant-isolation.ts
  98  |     data: {
  99  |       action: ISOLATION.actionA,
  100 |       entity: "Isolation",
  101 |       details: "Tenant A marker",
  102 |       userId: admin.id,
  103 |       tenantId: defaultTenant.id,
  104 |     },
  105 |   });
  106 |   await prisma.activityLog.create({
  107 |     data: {
  108 |       action: ISOLATION.actionB,
  109 |       entity: "Isolation",
  110 |       details: "Tenant B marker",
  111 |       userId: bUser.id,
  112 |       tenantId: tenantB.id,
  113 |     },
  114 |   });
  115 | 
  116 |   await logSecurityEvent({ userId: admin.id, type: ISOLATION.eventA, tenantId: defaultTenant.id });
  117 |   await logSecurityEvent({ userId: bUser.id, type: ISOLATION.eventB, tenantId: tenantB.id });
  118 |   // Poisoned: admin's userId, tenant B's id — must be invisible to BOTH.
  119 |   await logSecurityEvent({ userId: admin.id, type: ISOLATION.contaminated, tenantId: tenantB.id });
  120 | 
  121 |   return ISOLATION;
  122 | }
  123 | 
  124 | const isMain =
  125 |   process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
  126 | if (isMain) {
  127 |   seedTenantIsolation()
  128 |     .then((result) => console.log(JSON.stringify(result)))
  129 |     .catch((err) => {
  130 |       console.error(err);
  131 |       process.exit(1);
  132 |     });
  133 | }
  134 | 
```