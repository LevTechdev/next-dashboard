import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiFiles = [
  "src/app/api/audit-log/route.ts",
  "src/app/api/auth/totp/disable/route.ts",
  "src/app/api/auth/totp/setup/route.ts",
  "src/app/api/auth/totp/verify/route.ts",
  "src/app/api/auth/verify-email/send/route.ts",
  "src/app/api/orders/route.ts",
  "src/app/api/profile/avatar/route.ts",
  "src/app/api/profile/password/route.ts",
  "src/app/api/profile/route.ts",
  "src/app/api/search/route.ts"
];

for (const file of apiFiles) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf-8');
  
  content = content.replace(/import\s+\{\s*auth\s*\}\s+from\s+["']@\/lib\/auth["'];?/g, 'import { auth0 } from "@/lib/auth0";');
  content = content.replace(/await\s+auth\(\)/g, 'await auth0.getSession()');
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
}
