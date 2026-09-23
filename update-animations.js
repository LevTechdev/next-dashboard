const fs = require('fs');

const pages = [
  'src/app/[locale]/(marketing)/page.tsx',
  'src/app/[locale]/(marketing)/features/page.tsx',
  'src/app/[locale]/(marketing)/integrations-overview/page.tsx',
  'src/app/[locale]/(marketing)/pricing/page.tsx'
];

for (const page of pages) {
  let code = fs.readFileSync(page, 'utf8');
  
  // Regex to match <h1 ...>...</h1>
  // We want to wrap the content inside the <h1> tag with <FlipFadeText text={...} />
  code = code.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/, (match, p1, p2) => {
    // If it's already using FlipFadeText or FlipRevealText, skip
    if (p2.includes('FlipFadeText') || p2.includes('FlipRevealText')) return match;
    
    // We want to pass the exact JS expression inside the text prop.
    // Since p2 might be `{t('heroTitle')}`, we can pass it to text without extra braces.
    const textContent = p2.trim().replace(/^{|}$/g, ''); // Removes outer braces if any
    
    return `<h1${p1}><FlipFadeText text={${textContent}} /></h1>`;
  });

  fs.writeFileSync(page, code);
}
console.log('Animations updated.');
