const fs = require('fs');
const path = 'd:/Project/next-dashboard/src/components/layout/mobile-nav.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `<span className="text-sm leading-none mr-0.5">{currentLang.flag}</span>
                <EarthIcon size={16} className="h-4 w-4" />
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-semibold leading-none transition-all duration-200",
                  showLangMenu ? "text-primary" : "text-gray-500 dark:text-gray-400",
                )}
              >
                {currentLang.label}
              </span>`;

const replacement = `<span className="text-sm font-bold uppercase">{currentLang.code === "zh" ? "cn" : currentLang.code === "ja" ? "jp" : currentLang.code}</span>
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-semibold leading-none transition-all duration-200",
                  showLangMenu ? "text-primary" : "text-gray-500 dark:text-gray-400",
                )}
              >
                Lang
              </span>`;

if (content.includes('<EarthIcon size={16}')) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Updated mobile nav language icon");
}
