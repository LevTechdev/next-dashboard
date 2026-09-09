const fs = require('fs');
const path = 'd:/Project/next-dashboard/src/middleware.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('canAccessPage')) {
  // Add import
  content = content.replace(
    'import { routing } from "./i18n/routing";',
    'import { routing } from "./i18n/routing";\nimport { canAccessPage, type Role } from "@/lib/permissions";'
  );
  
  // Replace the jwt verification and add RBAC
  const target = `    if (!token) throw new Error("no token");
    await jwtVerify(token, JWT_SECRET);
    return withSecurityHeaders(intlMiddleware(req));`;

  const replacement = `    if (!token) throw new Error("no token");
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = payload.role as Role;
    
    // RBAC: Check if user can access this page
    const page = pathname.replace(/^\\/[a-z]{2}(?:-\\w{2})?/, "").split("/")[1] || "dashboard";
    
    // Some routes aren't governed by PAGE_ACCESS directly but are protected
    // If canAccessPage returns false and the page is in PAGE_ACCESS, deny access.
    import { PAGE_ACCESS } from "@/lib/permissions";
    // Wait, dynamic import or just statically checking if it's governed.
    // It's safer to just check:
    const isGoverned = ["dashboard", "analytics", "sales", "orders", "customers", "products", "inventory", "marketing", "affiliates", "discounts", "reports", "team", "settings", "profile", "audit-log", "security", "roles", "integrations", "sso", "billing", "notifications"].includes(page);
    
    if (isGoverned && !canAccessPage(page, role)) {
      // User is not authorized to access this page
      const locale = pathname.split("/")[1] || "en";
      const unauthorizedUrl = new URL(\`/\${locale}/dashboard\`, req.url);
      unauthorizedUrl.searchParams.set("error", "unauthorized");
      return withSecurityHeaders(NextResponse.redirect(unauthorizedUrl));
    }
    
    return withSecurityHeaders(intlMiddleware(req));`;
  
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Updated middleware.ts with RBAC");
}
