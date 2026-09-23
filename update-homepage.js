const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/(marketing)/page.tsx', 'utf8');

if (!code.includes("useTranslations('homepage')")) {
  code = code.replace(/export default function MarketingPage\(\{(.*?)\}\) \{/, 'export default function MarketingPage({$1}) {\n  const t = useTranslations(\'homepage\');');
}
if (!code.includes("import { useTranslations } from \"next-intl\"")) {
  code = code.replace(/import \{ use, useState, useEffect \} from \"react\";/, 'import { use, useState, useEffect } from "react";\nimport { useTranslations } from "next-intl";');
}

const replacements = {
  'The Complete Next.js SaaS Starter Kit': 't(\'heroTag\')',
  'Ship your next SaaS in days, not months': 't(\'heroTitle\')',
  'Everything you need to build a modern SaaS: Authentication, Stripe & Midtrans payments, internationalization, dark mode, dashboard, and more. Ready to deploy.': 't(\'heroSubtitle\')',
  'Start Building': 't(\'ctaPrimary\')',
  'View Dashboard': 't(\'ctaSecondary\')',
  '10K+': 't(\'stats.downloads\')',
  'Developers': 't(\'stats.downloadsLabel\')',
  '4.9/5': 't(\'stats.rating\')',
  'Reviews': 't(\'stats.ratingLabel\')',
  '99.9%': 't(\'stats.uptime\')',
  'Uptime': 't(\'stats.uptimeLabel\')',
  'TRUSTED BY INNOVATIVE TEAMS WORLDWIDE': 't(\'trustedBy\')',
  'Total Revenue': 't(\'demo.revenue\')',
  'Total Orders': 't(\'demo.orders\')',
  'Total Customers': 't(\'demo.customers\')',
  'Total Products': 't(\'demo.products\')',
  'Recent Orders': 't(\'demoOrders.title\')',
  'You received 24 orders today': 't(\'demoOrders.desc\')',
  '>Customer<': '>{t(\'demoOrders.customer\')}<',
  '>Status<': '>{t(\'demoOrders.status\')}<',
  '>Amount<': '>{t(\'demoOrders.amount\')}<',
  'Everything you need to scale': 't(\'featuresTitle\')',
  'Stop building the same boilerplate over and over. Get straight to your business logic with our pre-built modules.': 't(\'featuresSubtitle\')',
  'Secure Authentication': 't(\'auth.title\')',
  'Email/password, social logins, and multi-factor authentication built-in.': 't(\'auth.desc\')',
  'Global Payments': 't(\'payments.title\')',
  'Accept credit cards via Stripe and local payment methods via Midtrans.': 't(\'payments.desc\')',
  'Internationalization': 't(\'i18n.title\')',
  'Built-in support for multiple languages with Next-Intl.': 't(\'i18n.desc\')',
  'UI Components': 't(\'components.title\')',
  'Beautiful, accessible components built with Radix UI and Tailwind CSS.': 't(\'components.desc\')',
  'Dark Mode': 't(\'theme.title\')',
  'First-class dark mode support with next-themes.': 't(\'theme.desc\')',
  'Admin Dashboard': 't(\'dashboard.title\')',
  'Comprehensive admin dashboard with charts, tables, and metrics.': 't(\'dashboard.desc\')',
  'Enterprise Security': 't(\'security.title\')',
  'Role-based access control, session management, and API route protection.': 't(\'security.desc\')',
  'High Performance': 't(\'performance.title\')',
  'Optimized for Core Web Vitals with Next.js App Router and React Server Components.': 't(\'performance.desc\')',
  'Loved by developers': 't(\'socialProof.title\')',
  'See what our community has to say about Next Dashboard.': 't(\'socialProof.subtitle\')',
  'Read all reviews': 't(\'socialProof.seeMore\')'
};

for (const [key, value] of Object.entries(replacements)) {
  if (key.includes('>')) {
     code = code.split(key).join(value);
  } else {
     code = code.split('>' + key + '<').join('>{' + value + '}<');
     code = code.split('\"' + key + '\"').join('{' + value + '}');
  }
}

// Ensure animated text is used
if (!code.includes("FlipFadeText")) {
  code = code.replace(/import \{ cn \} from \"@\/lib\/utils\";/, 'import { cn } from "@/lib/utils";\nimport { FlipFadeText } from "@/components/ui/flip-fade-text";');
  code = code.replace(/<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">([\s\S]*?)<\/h1>/, '<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6"><FlipFadeText text={$1} /></h1>');
}

fs.writeFileSync('src/app/[locale]/(marketing)/page.tsx', code);
console.log('Homepage updated.');
