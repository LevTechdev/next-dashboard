const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/(marketing)/pricing/page.tsx', 'utf8');

if (!code.includes("useTranslations('pricingPage')")) {
  code = code.replace(/export default function PricingPage\(\{(.*?)\}\) \{/, 'export default function PricingPage({$1}) {\n  const t = useTranslations(\'pricingPage\');');
}
if (!code.includes("import { useTranslations } from \"next-intl\"")) {
  code = code.replace(/import \{ use, useState \} from \"react\";/, 'import { use, useState } from "react";\nimport { useTranslations } from "next-intl";');
}

const replacements = {
  'Simple Pricing': 't(\'heroTag\')',
  'Pricing that scales with you': 't(\'heroTitle\')',
  'Start for free, upgrade when you need to. No hidden fees or surprise charges.': 't(\'heroSubtitle\')',
  'Monthly': 't(\'monthly\')',
  'Yearly': 't(\'yearly\')',
  'Save 20%': 't(\'yearlyDiscount\')',
  'Everything included:': 't(\'featuresIncluded\')',
  '>Most Popular<': '>{t(\'mostPopular\')}<',
  'Get Started': 't(\'getStarted\')',
  'Contact Sales': 't(\'contactSales\')',
  'Frequently Asked Questions': 't(\'faqTitle\')',
  'Everything you need to know about our pricing and billing.': 't(\'faqSubtitle\')',
  'Ready to start building?': 't(\'ctaTitle\')',
  'Join thousands of developers shipping faster with Next Dashboard.': 't(\'ctaDesc\')',
  'Start your free trial': 't(\'ctaButton\')'
};

for (const [key, value] of Object.entries(replacements)) {
  if (key.includes('>')) {
     code = code.split(key).join(value);
  } else {
     code = code.split('>' + key + '<').join('>{' + value + '}<');
     code = code.split('\"' + key + '\"').join('{' + value + '}');
  }
}

// Add animation
if (!code.includes("FlipFadeText")) {
  code = code.replace(/import \{ cn \} from \"@\/lib\/utils\";/, 'import { cn } from "@/lib/utils";\nimport { FlipFadeText } from "@/components/ui/flip-fade-text";');
  code = code.replace(/<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">([\s\S]*?)<\/h1>/, '<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6"><FlipFadeText text={$1} /></h1>');
}

fs.writeFileSync('src/app/[locale]/(marketing)/pricing/page.tsx', code);
console.log('Pricing page updated.');
