"use client";

import { useTranslations } from "next-intl";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export default function AccessibilityPage() {
  const t = useTranslations("legal");

  const sections: LegalSection[] = [
    { title: t("accessS1Title"), body: t("accessS1Body") },
    { title: t("accessS2Title"), body: t("accessS2Body") },
    { title: t("accessS3Title"), body: t("accessS3Body") },
    { title: t("accessS4Title"), body: t("accessS4Body") },
    { title: t("accessS5Title"), body: t("accessS5Body") },
  ];

  return (
    <LegalPage
      kind="accessibility"
      title={t("accessTitle")}
      updated={t("accessUpdated")}
      intro={t("accessIntro")}
      sections={sections}
    />
  );
}
