const fs = require('fs');

const files = [
  'src/app/[locale]/(dashboard)/orders/page.tsx',
  'src/app/[locale]/(dashboard)/customers/page.tsx',
  'src/app/[locale]/(dashboard)/reports/page.tsx',
  'src/app/[locale]/(dashboard)/analytics/page.tsx',
  'src/app/[locale]/(dashboard)/sales/page.tsx',
  'src/app/[locale]/(dashboard)/products/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/page.tsx'
];

for (const f of files) {
  const file = 'd:/Project/next-dashboard/' + f;
  if (!fs.existsSync(file)) continue;
  
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Add truncate to large stat numbers
  if (content.includes('text-2xl font-bold') && !content.includes('text-2xl font-bold truncate')) {
    content = content.replace(/text-2xl font-bold(?! truncate)/g, 'text-2xl font-bold truncate');
    changed = true;
  }

  // Also replace formatCurrency with formatCompactCurrency for large numbers if possible, 
  // or just use compact logic in stat.format
  
  if (file.includes('orders/page.tsx')) {
    if (content.includes('format: (v: number) => formatMoney(v)')) {
      content = content.replace(/format: \(v: number\) => formatMoney\(v\)/g, 'format: (v: number) => (currency === "IDR" && v > 1000000) ? formatCompactMoney(v) : formatMoney(v)');
      changed = true;
    }
    if (content.includes('const { formatMoney } = useCurrency();')) {
      content = content.replace('const { formatMoney } = useCurrency();', 'const { formatMoney, formatCompactMoney, currency } = useCurrency();');
      changed = true;
    }
  }

  if (file.includes('customers/page.tsx') || file.includes('reports/page.tsx')) {
    if (content.includes('formatCurrency(v)') && !content.includes('formatCompactCurrency')) {
      content = content.replace(/import \{([^}]*)formatCurrency([^}]*)\} from "@\/lib\/utils";/, 'import {$1formatCurrency, formatCompactCurrency$2} from "@/lib/utils";');
      content = content.replace(/format: \(v: number\) => formatCurrency\(v\)/g, 'format: (v: number) => formatCompactCurrency(v)');
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
}
