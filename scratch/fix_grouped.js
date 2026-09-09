const fs = require('fs');

const fixOrders = () => {
  const path = 'd:/Project/next-dashboard/src/app/[locale]/(dashboard)/orders/page.tsx';
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(
    'const grouped = {};',
    'const grouped: Record<string, { count: number, rev: number }> = {};'
  );
  content = content.replace(
    'Object.values(grouped).map(g => g.count)',
    'Object.values(grouped).map((g: any) => g.count)'
  );
  content = content.replace(
    'Object.values(grouped).map(g => g.rev)',
    'Object.values(grouped).map((g: any) => g.rev)'
  );
  fs.writeFileSync(path, content, 'utf8');
}

const fixCustomers = () => {
  const path = 'd:/Project/next-dashboard/src/app/[locale]/(dashboard)/customers/page.tsx';
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(
    'const grouped = {};',
    'const grouped: Record<string, number> = {};'
  );
  fs.writeFileSync(path, content, 'utf8');
}

fixOrders();
fixCustomers();
console.log("Fixed types");
