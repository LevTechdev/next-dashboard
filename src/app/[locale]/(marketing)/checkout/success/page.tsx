import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function CheckoutSuccessPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations("marketing.pricing");
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <CheckCircle2 className="w-24 h-24 text-primary relative z-10" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Payment Successful!</h1>
          <p className="text-muted-foreground text-lg">
            Thank you for your subscription. Your account has been upgraded and you now have access to all premium features.
          </p>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={`/${locale}/dashboard`}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
