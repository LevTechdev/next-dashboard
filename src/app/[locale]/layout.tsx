import { AppearanceInit } from "@/components/appearance-init";
import { CurrencyProvider } from "@/components/currency-provider";

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrencyProvider>
      <AppearanceInit />
      {children}
    </CurrencyProvider>
  );
}
