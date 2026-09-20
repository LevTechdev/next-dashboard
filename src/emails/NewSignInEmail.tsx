import { Text, Section, Row, Column } from "@react-email/components";
import * as React from "react";
import EmailLayout, { EmailHeading, EmailNote, BRAND_NAME } from "./EmailLayout";

/**
 * Why the alert fired — a localized one-liner supplied by the caller
 * (device-recognition.ts), e.g. "This is the first time this device has
 * signed in to your account."
 */
interface NewSignInEmailProps {
  /** Which surface the sign-in happened on, e.g. "Next Dashboard Web". */
  appName?: string;
  /** "14:05 WIB" — a single Indonesian civil-zone stamp. */
  timeText: string;
  /** Precise IP-resolved location (CDN headers, ip-api fallback), or "Unavailable". */
  location: string;
  /** Parsed device/OS line, e.g. "Windows · Chrome". */
  device: string;
  locale?: string;
  /** Localized reason this alert fired (new device / new IP). */
  reasonText?: string;
  /** Whether the caller determined this is an unrecognized sign-in. */
  isNewDevice?: boolean;
}

const DETAIL_LABEL: Record<string, string> = {
  en: "Details of this sign-in",
  id: "Detail login ini",
  ja: "このログインの詳細",
  zh: "本次登录详情",
};

const LABELS: Record<string, Record<"app" | "time" | "location" | "device", string>> = {
  en: { app: "App", time: "Time", location: "Location", device: "Device" },
  id: { app: "Aplikasi", time: "Waktu", location: "Lokasi", device: "Perangkat" },
  ja: { app: "アプリ", time: "日時", location: "場所", device: "デバイス" },
  zh: { app: "应用", time: "时间", location: "位置", device: "设备" },
};

/**
 * Security alert fired on a successful sign-in from a device the account
 * hasn't used before (or every sign-in — see the caller). Lists app, local
 * time across the three Indonesian zones, approximate location, and device.
 */
export default function NewSignInEmail({
  appName = "Next Dashboard Web",
  timeText,
  location,
  device,
  locale = "en",
  reasonText,
  isNewDevice = true,
}: NewSignInEmailProps) {
  const l = LABELS[locale] ?? LABELS.en;
  const rows: Array<[string, string]> = [
    [l.app, appName],
    [l.time, timeText],
    [l.location, location],
    [l.device, device],
  ];

  return (
    <EmailLayout previewText={`New sign-in to your ${BRAND_NAME} account`}>
      <EmailHeading>New sign-in detected</EmailHeading>
      {reasonText ? (
        <Text className="text-zinc-700 text-[14px] leading-[24px] m-0" style={{ fontWeight: 600 }}>
          {reasonText}
        </Text>
      ) : null}
      <Text className="text-zinc-700 text-[14px] leading-[24px]">
        Your {BRAND_NAME} account was just signed in to. If this was you, no action is needed. If
        you don&apos;t recognize this sign-in, secure your account from Settings → Security: sign
        out all sessions and change your password.
      </Text>

      <Section className="bg-zinc-100 rounded-xl my-[24px] px-[24px] py-[16px]">
        <Text className="text-zinc-900 text-[13px] font-semibold m-0 mb-[8px]">
          {DETAIL_LABEL[locale] ?? DETAIL_LABEL.en}
        </Text>
        {rows.map(([label, value]) => (
          <Row key={label}>
            <Column className="w-[180px] align-top">
              <Text className="text-zinc-500 text-[13px] leading-[22px] m-0">{label}</Text>
            </Column>
            <Column align="left">
              <Text className="text-zinc-900 text-[13px] font-medium leading-[22px] m-0">
                {value}
              </Text>
            </Column>
          </Row>
        ))}
      </Section>

      <EmailNote>
        This alert is part of {BRAND_NAME}&apos;s account-protection features. You can review all
        recent activity in Settings → Security.
      </EmailNote>
    </EmailLayout>
  );
}
