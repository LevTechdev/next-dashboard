const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/(marketing)/features/page.tsx', 'utf8');

if (!code.includes("useTranslations('featuresPage')")) {
  code = code.replace(/export default function FeaturesPage\(\{(.*?)\}\) \{/, 'export default function FeaturesPage({$1}) {\n  const t = useTranslations(\'featuresPage\');');
}
if (!code.includes("import { useTranslations } from \"next-intl\"")) {
  code = code.replace(/import \{ use \} from \"react\";/, 'import { use } from "react";\nimport { useTranslations } from "next-intl";');
}

const replacements = {
  'Powerful Capabilities': 't(\'heroTag\')',
  'Everything you need to build a global product': 't(\'heroTitle\')',
  'Stop wasting weeks on boilerplate. Next Dashboard gives you production-ready features for authentication, payments, internationalization, and robust security—out of the box.': 't(\'heroSubtitle\')',
  'Start Building Now': 't(\'cta\')',
  
  'Enterprise-grade Authentication': 't(\'mainFeatures.auth.title\')',
  'Complete identity management with support for traditional credentials, magic links, social logins, and mandatory 2FA. Built on NextAuth.js for maximum security and flexibility.': 't(\'mainFeatures.auth.desc\')',
  
  'Global Payment Processing': 't(\'mainFeatures.payments.title\')',
  'Process subscriptions and one-off payments worldwide. Integrated with Stripe for international cards and Midtrans for Southeast Asian local payment methods (GoPay, QRIS, Virtual Accounts).': 't(\'mainFeatures.payments.desc\')',
  
  'First-class Internationalization': 't(\'mainFeatures.i18n.title\')',
  'Ship to global markets instantly. Fully localized routing, date/time formatting, and dictionary management powered by next-intl. Support for RTL languages and deep SEO optimization.': 't(\'mainFeatures.i18n.desc\')',
  
  'Beautiful Admin Dashboards': 't(\'mainFeatures.dashboard.title\')',
  'Pre-built, responsive admin interfaces with customizable data tables, interactive charts, metric cards, and advanced filtering. Ready for your business logic.': 't(\'mainFeatures.dashboard.desc\')',
  
  'More powerful features': 't(\'grid.title\')',
  "We've thought of everything so you don't have to.": 't(\'grid.subtitle\')',
  
  'Dark Mode Support': 't(\'grid.items\')[0].title',
  'Flawless dark mode out of the box with system-preference detection.': 't(\'grid.items\')[0].desc',
  
  'Role-Based Access': 't(\'grid.items\')[1].title',
  'Fine-grained permissions for users, admins, and custom roles.': 't(\'grid.items\')[1].desc',
  
  'API Routes': 't(\'grid.items\')[2].title',
  'Secure, rate-limited API endpoints ready for your mobile apps.': 't(\'grid.items\')[2].desc',
  
  'Email Templates': 't(\'grid.items\')[3].title',
  'Beautiful, responsive transactional emails built with React Email.': 't(\'grid.items\')[3].desc',
  
  'SEO Optimized': 't(\'grid.items\')[4].title',
  'Dynamic sitemaps, robots.txt, and optimized meta tags.': 't(\'grid.items\')[4].desc',
  
  'Type Safe': 't(\'grid.items\')[5].title',
  'End-to-end type safety with TypeScript, Prisma, and Zod.': 't(\'grid.items\')[5].desc',
  
  'Ready to ship faster?': 't(\'ctaTitle\')',
  'Join thousands of developers building the next generation of web applications.': 't(\'ctaDesc\')',
  'Get Started Today': 't(\'ctaButton\')'
};

// Next-Intl doesn't support arrays directly with `t()`, but we can just use `t('grid.items.X.title')`
// Let's modify the replacements for grid items to use valid next-intl keys instead of array indexing,
// assuming we change the en.json to use an object or `t.raw` for arrays.
// Actually, `t.raw` is supported or we can just change en.json grid.items to be accessed differently.
// Wait, for arrays, I can just use `t('grid.items.0.title')`. Wait, next-intl array elements can be accessed by index string!

const replacements2 = {
  ...replacements,
  "t('grid.items')[0].title": "t('grid.items.0.title')",
  "t('grid.items')[0].desc": "t('grid.items.0.desc')",
  "t('grid.items')[1].title": "t('grid.items.1.title')",
  "t('grid.items')[1].desc": "t('grid.items.1.desc')",
  "t('grid.items')[2].title": "t('grid.items.2.title')",
  "t('grid.items')[2].desc": "t('grid.items.2.desc')",
  "t('grid.items')[3].title": "t('grid.items.3.title')",
  "t('grid.items')[3].desc": "t('grid.items.3.desc')",
  "t('grid.items')[4].title": "t('grid.items.4.title')",
  "t('grid.items')[4].desc": "t('grid.items.4.desc')",
  "t('grid.items')[5].title": "t('grid.items.5.title')",
  "t('grid.items')[5].desc": "t('grid.items.5.desc')"
};

for (const [key, value] of Object.entries(replacements)) {
  let val = value;
  if (val.startsWith("t('grid.items')")) {
    val = val.replace("t('grid.items')[", "t('grid.items.");
    val = val.replace("].", ".");
    val = val.replace("'", "'"); // leave as is
  }
  
  if (key.includes('>')) {
     code = code.split(key).join(val);
  } else {
     code = code.split('>' + key + '<').join('>{' + val + '}<');
     code = code.split('\"' + key + '\"').join('{' + val + '}');
  }
}

// Add animation
if (!code.includes("FlipFadeText")) {
  code = code.replace(/import \{ cn \} from \"@\/lib\/utils\";/, 'import { cn } from "@/lib/utils";\nimport { FlipFadeText } from "@/components/ui/flip-fade-text";');
  code = code.replace(/<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">([\s\S]*?)<\/h1>/, '<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6"><FlipFadeText text={$1} /></h1>');
}

fs.writeFileSync('src/app/[locale]/(marketing)/features/page.tsx', code);
console.log('Features page updated.');
