const fs = require('fs');
let code = fs.readFileSync('src/app/[locale]/(marketing)/integrations-overview/page.tsx', 'utf8');

if (!code.includes("useTranslations('integrationsPage')")) {
  code = code.replace(/export default function IntegrationsOverview\(\{(.*?)\}\) \{/, 'export default function IntegrationsOverview({$1}) {\n  const t = useTranslations(\'integrationsPage\');');
}
if (!code.includes("import { useTranslations } from \"next-intl\"")) {
  code = code.replace(/import \{ use \} from \"react\";/, 'import { use } from "react";\nimport { useTranslations } from "next-intl";');
}

const replacements = {
  'Seamless Connections': 't(\'heroTag\')',
  'Connect with your favorite tools': 't(\'heroTitle\')',
  "Next Dashboard comes pre-configured with the industry's best tools and platforms. Extend your application's capabilities with zero configuration.": 't(\'heroSubtitle\')',
  'Explore Documentation': 't(\'cta\')',
  'Browse by category': 't(\'categoriesTitle\')',
  'Find the perfect integration for your specific needs.': 't(\'categoriesSubtitle\')',
  'All Integrations': 't(\'allIntegrations\')',
  'Popular': 't(\'popularTag\')',
  'Build your own integration': 't(\'ctaTitle\')',
  'Need something specific? Use our robust API to build custom connections to any platform.': 't(\'ctaDesc\')',
  'View API Docs': 't(\'ctaButton\')'
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

fs.writeFileSync('src/app/[locale]/(marketing)/integrations-overview/page.tsx', code);
console.log('Integrations page updated.');
