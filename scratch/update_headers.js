const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('src/app/[locale]/(dashboard)/**/page.tsx', { cwd: 'd:/Project/next-dashboard' });

for (const file of files) {
  const fullPath = path.join('d:/Project/next-dashboard', file);
  let content = fs.readFileSync(fullPath, 'utf8');

  // Change Header wrapper
  content = content.replace(
    /\{\/\*\s*Header\s*\*\/\}\s*<(div|motion\.div)\s+([^>]*?)className="flex items-center justify-between"/g,
    '{/* Header */}\n      <$1 $2className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"'
  );

  // Change action buttons wrapper (the next div inside header)
  // Usually looks like `<div className="flex items-center gap-2 sm:gap-3">` or `gap-3`
  // We'll replace it inside the header block specifically by targeting `gap-3` or `gap-2 sm:gap-3`
  // Actually, we can just replace `<div className="flex items-center gap-3">` with `<div className="flex flex-wrap items-center gap-2 sm:gap-3">`
  // And `gap-2 sm:gap-3` -> `flex flex-wrap items-center gap-2 sm:gap-3`
  
  // A safer regex: find the first `<div className="flex items-center gap...` after `flex flex-col sm:flex-row`
  let match = content.match(/className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"[^>]*>[\s\S]*?<div className="([^"]*flex items-center gap-[^"]*)"/);
  if (match) {
    let oldClass = match[1];
    if (!oldClass.includes('flex-wrap')) {
      let newClass = oldClass.replace('flex items-center', 'flex flex-wrap items-center').replace('gap-3', 'gap-2 sm:gap-3');
      content = content.replace(oldClass, newClass);
    }
  }

  fs.writeFileSync(fullPath, content, 'utf8');
}
console.log('Updated headers');
