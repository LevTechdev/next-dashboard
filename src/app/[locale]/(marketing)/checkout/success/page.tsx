import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { TierRefreshOnSuccess } from "@/components/billing/tier-refresh-on-success";

export default async function CheckoutSuccessPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  // Was `getTranslations("marketing.pricing")` — a namespace no locale defines,
  // so this page rendered hardcoded English to every locale. Bound to its own
  // namespace now; src/i18n/__tests__/referenced-keys.test.ts fails if the
  // binding or any key goes missing again.
  const t = await getTranslations("checkoutSuccess");
  return (
    <>
      <TierRefreshOnSuccess />
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <CheckCircle2 className="w-24 h-24 text-primary relative z-10" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground text-lg">{t("body")}</p>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/dashboard`}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              {t("cta")}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
