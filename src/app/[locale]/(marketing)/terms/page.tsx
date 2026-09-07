"use client";

import { useTranslations } from "next-intl";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export default function TermsPage() {
  const t = useTranslations("legal");

  const sections: LegalSection[] = [
    { title: t("termsS1Title"), body: t("termsS1Body") },
    { title: t("termsS2Title"), body: t("termsS2Body") },
    { title: t("termsS3Title"), body: t("termsS3Body") },
    { title: t("termsS4Title"), body: t("termsS4Body") },
    { title: t("termsS5Title"), body: t("termsS5Body") },
    { title: t("termsS6Title"), body: t("termsS6Body") },
    { title: t("termsS7Title"), body: t("termsS7Body") },
  ];

  return (
    <LegalPage
      kind="terms"
      title={t("termsTitle")}
      updated={t("termsUpdated")}
      intro={t("termsIntro")}
      sections={sections}
    />
  );
}
