import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToUpdate = [
  "src/app/[locale]/(dashboard)/customers/page.tsx",
  "src/app/[locale]/(dashboard)/discounts/page.tsx",
  "src/app/[locale]/(dashboard)/marketing/page.tsx",
  "src/app/[locale]/(dashboard)/products/page.tsx",
  "src/app/[locale]/(dashboard)/profile/page.tsx",
  "src/app/[locale]/(dashboard)/team/page.tsx",
  "src/app/[locale]/(marketing)/features/page.tsx",
  "src/app/[locale]/(marketing)/layout.tsx",
  "src/app/[locale]/(marketing)/page.tsx",
  "src/app/[locale]/(marketing)/pricing/page.tsx",
  "src/app/[locale]/login/page.tsx",
  "src/components/layout/header.tsx",
  "src/components/layout/sidebar.tsx"
];

for (const file of filesToUpdate) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace import
  content = content.replace(/import\s+\{\s*useSession\s*\}\s+from\s+["']next-auth\/react["'];?/g, 'import { useAuth } from "@/hooks/use-auth";');
  
  // Replace hook usage
  content = content.replace(/const\s+\{\s*data\s*:\s*session\s*\}\s*=\s*useSession\(\);?/g, 'const { user: session } = useAuth();');
  content = content.replace(/const\s+\{\s*data\s*:\s*session,\s*status\s*\}\s*=\s*useSession\(\);?/g, 'const { user: session, isLoading: status } = useAuth();');
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
}
