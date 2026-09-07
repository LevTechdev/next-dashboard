"use client";

import { useTranslations } from "next-intl";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export default function CookiesPage() {
  const t = useTranslations("legal");

  const sections: LegalSection[] = [
    { title: t("cookiesS1Title"), body: t("cookiesS1Body") },
    { title: t("cookiesS2Title"), body: t("cookiesS2Body") },
    { title: t("cookiesS3Title"), body: t("cookiesS3Body") },
    { title: t("cookiesS4Title"), body: t("cookiesS4Body") },
    { title: t("cookiesS5Title"), body: t("cookiesS5Body") },
  ];

  return (
    <LegalPage
      kind="cookies"
      title={t("cookiesTitle")}
      updated={t("cookiesUpdated")}
      intro={t("cookiesIntro")}
      sections={sections}
    />
  );
}
