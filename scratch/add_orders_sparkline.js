const fs = require('fs');
const path = require('path');

const filePath = path.join('d:/Project/next-dashboard/src/app/[locale]/(dashboard)/orders/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import { Sparkline }')) {
  content = content.replace('import { EmptyState }', 'import { EmptyState }\nimport { Sparkline }');
}

if (!content.includes('const sparkData')) {
  const insertIndex = content.indexOf('const totalRevenue =');
  const computeSpark = `
  const sparkData = useMemo(() => {
    if (!orders || orders.length === 0) return { orders: [], revenue: [] };
    
    // Sort orders by date first (oldest to newest)
    const sorted = [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    const grouped = {};
    sorted.forEach(o => {
      const d = new Date(o.createdAt).toLocaleDateString();
      if (!grouped[d]) grouped[d] = { count: 0, rev: 0 };
      grouped[d].count++;
      grouped[d].rev += (o.grandTotal || 0);
    });
    
    return {
      orders: Object.values(grouped).map(g => g.count),
      revenue: Object.values(grouped).map(g => g.rev)
    };
  }, [orders]);

  `;
  content = content.slice(0, insertIndex) + computeSpark + content.slice(insertIndex);
}

// Add to array
if (!content.includes('spark: sparkData.orders')) {
  content = content.replace(
    /label: torders\("totalOrders"\)[\s\S]*?bg: "bg-blue[^"]*",/m,
    `$& \n            spark: sparkData.orders,`
  );
}
if (!content.includes('spark: sparkData.revenue')) {
  content = content.replace(
    /label: torders\("totalRevenue"\)[\s\S]*?format: \(v: number\) => formatMoney\(v\),/m,
    `$& \n            spark: sparkData.revenue,`
  );
}

// Add sparkline component
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
                        strokeColor={stat.color.includes('emerald') ? "#10b981" : "#3b82f6"}
                        strokeWidth={2}
                      />
                    </div>
                  )}
                </div>`;

content = content.replace(cardContentTarget, cardContentReplace);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Orders sparklines added');
