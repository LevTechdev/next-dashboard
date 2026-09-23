const fs = require('fs');
const path = require('path');

const filePath = path.join('d:/Project/next-dashboard/src/app/[locale]/(dashboard)/customers/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import { Sparkline }')) {
  content = content.replace('import { EmptyState }', 'import { EmptyState }\nimport { Sparkline }');
}

if (!content.includes('const sparkData')) {
  const insertIndex = content.indexOf('const totalCustomers =');
  const computeSpark = `
  const sparkData = useMemo(() => {
    if (!customers || customers.length === 0) return [];
    
    const sorted = [...customers].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    const grouped = {};
    sorted.forEach(c => {
      const d = new Date(c.createdAt).toLocaleDateString();
      if (!grouped[d]) grouped[d] = 0;
      grouped[d]++;
    });
    
    return Object.values(grouped);
  }, [customers]);

  `;
  content = content.slice(0, insertIndex) + computeSpark + content.slice(insertIndex);
}

if (!content.includes('spark: sparkData')) {
  content = content.replace(
    /label: tcustomers\("totalCustomers"\)[\s\S]*?bg: "bg-blue[^"]*",/m,
    `$& \n            spark: sparkData,`
  );
}

const cardContentTarget = `<div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "p-2.5 rounded-lg transition-transform group-hover:scale-110 duration-300",
                      stat.bg,
                    )}
                  >
                    <stat.icon size={20} className={cn("h-5 w-5", stat.color)} />
                  </div>
                </div>`;

const cardContentReplace = `<div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "p-2.5 rounded-lg transition-transform group-hover:scale-110 duration-300",
                      stat.bg,
                    )}
                  >
                    <stat.icon size={20} className={cn("h-5 w-5", stat.color)} />
                  </div>
                  {stat.spark && stat.spark.length > 1 && (
                    <div className="w-16 h-8 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Sparkline
                        data={stat.spark}
                        width={64}
                        height={32}
                        strokeColor={"#3b82f6"}
                        strokeWidth={2}
                      />
                    </div>
                  )}
                </div>`;

content = content.replace(cardContentTarget, cardContentReplace);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Customers sparklines added');
