import { AppearanceInit } from "@/components/appearance-init";

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppearanceInit />
      {children}
    </>
  );
}
