"use client";

import { useTranslations } from "next-intl";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export default function PrivacyPage() {
  const t = useTranslations("legal");

  const sections: LegalSection[] = [
    { title: t("privacyS1Title"), body: t("privacyS1Body") },
    { title: t("privacyS2Title"), body: t("privacyS2Body") },
    { title: t("privacyS3Title"), body: t("privacyS3Body") },
    { title: t("privacyS4Title"), body: t("privacyS4Body") },
    { title: t("privacyS5Title"), body: t("privacyS5Body") },
    { title: t("privacyS6Title"), body: t("privacyS6Body") },
    { title: t("privacyS7Title"), body: t("privacyS7Body") },
  ];

  return (
    <LegalPage
      kind="privacy"
      title={t("privacyTitle")}
      updated={t("privacyUpdated")}
      intro={t("privacyIntro")}
      sections={sections}
    />
  );
}
