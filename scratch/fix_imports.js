const fs = require('fs');

const fixFile = (path) => {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(
    'import { EmptyState }\nimport { Sparkline } from "@/components/ui/empty-state";',
    'import { EmptyState } from "@/components/ui/empty-state";\nimport { Sparkline } from "@/components/ui/sparkline";'
  );
  fs.writeFileSync(path, content, 'utf8');
}

fixFile('d:/Project/next-dashboard/src/app/[locale]/(dashboard)/orders/page.tsx');
fixFile('d:/Project/next-dashboard/src/app/[locale]/(dashboard)/customers/page.tsx');
console.log("Fixed imports");
