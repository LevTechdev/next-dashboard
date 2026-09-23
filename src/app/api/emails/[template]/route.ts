import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import * as React from "react";
import VerifyEmail from "@/emails/VerifyEmail";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";
import NewSignInEmail from "@/emails/NewSignInEmail";
import WelcomeEmail from "@/emails/WelcomeEmail";
import InvoiceEmail from "@/emails/InvoiceEmail";
import { formatSingleZoneTime } from "@/lib/geo-ip";

/**
 * Email template preview endpoint — renders one transactional template with
 * representative sample data as standalone HTML. Consumed by the /emails
 * design-review gallery (which shows it inside a sandboxed iframe), and
 * usable directly for snapshot tooling (e.g. `npx create-email`-style
 * previews or email-client linting).
 *
 * NOT a security surface: it renders static sample data only — no user rows,
 * no PII, no real OTPs — so it stays unauthenticated.
 */

export const dynamic = "force-dynamic";

const SAMPLE_LOCALES = ["en", "id", "ja", "zh"] as const;
type SampleLocale = (typeof SAMPLE_LOCALES)[number];

function normalizeLocale(raw: string | null): SampleLocale {
  return SAMPLE_LOCALES.includes((raw ?? "") as SampleLocale) ? (raw as SampleLocale) : "en";
}

function buildTemplate(name: string, locale: SampleLocale): React.ReactElement | null {
  switch (name) {
    case "verify-email":
      return React.createElement(VerifyEmail, { otp: "482913", locale });
    case "reset-password":
      return React.createElement(ResetPasswordEmail, {
        resetLink: "https://nextdashboards.id/en/reset-password?token=sample-token",
        locale,
      });
    case "new-sign-in":
      return React.createElement(NewSignInEmail, {
        appName: "Next Dashboard Web",
        timeText: formatSingleZoneTime(new Date(), "WIB"),
        location: "Jakarta, Jakarta, ID",
        device: "Windows · Chrome",
        locale,
        reasonText:
          locale === "id"
            ? "Ini pertama kalinya perangkat ini masuk ke akun Anda."
            : locale === "ja"
              ? "このデバイスからのサインインは初めてです。"
              : locale === "zh"
                ? "这是该设备首次登录您的账号。"
                : "This is the first time this device has signed in to your account.",
        isNewDevice: true,
      });
    case "welcome":
      return React.createElement(WelcomeEmail, { name: "Rizky" });
    case "invoice":
      return React.createElement(InvoiceEmail, {
        invoiceNumber: "INV-2026-09-0042",
        amount: "Rp 499.000",
        date: "15/09/2026",
        planName: "Professional",
      });
    default:
      return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ template: string }> }) {
  const { template } = await params;
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));

  const element = buildTemplate(template, locale);
  if (!element) {
    return NextResponse.json(
      {
        error: "Unknown template",
        available: ["verify-email", "reset-password", "new-sign-in", "welcome", "invoice"],
      },
      { status: 404 },
    );
  }

  const html = await render(element);
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
