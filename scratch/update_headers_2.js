const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('src/app/[locale]/(dashboard)/**/page.tsx', { cwd: 'd:/Project/next-dashboard' });

for (const file of files) {
  const fullPath = path.join('d:/Project/next-dashboard', file);
  let content = fs.readFileSync(fullPath, 'utf8');

  // We want to find the first `<div className="flex items-center justify-between">` that comes AFTER `{/* Header */}`.
  let lines = content.split('\n');
  let inHeader = false;
  let replacedWrapper = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* Header */}')) {
      inHeader = true;
      replacedWrapper = false;
    }
    
    if (inHeader) {
      if (!replacedWrapper && lines[i].includes('className="flex items-center justify-between"')) {
        lines[i] = lines[i].replace('className="flex items-center justify-between"', 'className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"');
        replacedWrapper = true;
      }
      else if (replacedWrapper && lines[i].includes('className="flex items-center gap-')) {
        // Change the action buttons flex container
        lines[i] = lines[i].replace('className="flex items-center gap-', 'className="flex flex-wrap items-center gap-');
        inHeader = false; // Done with this header block
      }
      else if (replacedWrapper && lines[i].includes('className="flex gap-')) {
        lines[i] = lines[i].replace('className="flex gap-', 'className="flex flex-wrap items-center gap-');
        inHeader = false;
      }
    }
  }

  fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
}
console.log('Done replacing headers');
