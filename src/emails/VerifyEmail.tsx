import { Text, Section, Button } from "@react-email/components";
import * as React from "react";
import EmailLayout, {
  EmailHeading,
  EmailHighlight,
  EmailNote,
  BRAND_NAME,
  BRAND_PRIMARY,
  EMAIL_APP_URL,
} from "./EmailLayout";

interface VerifyEmailProps {
  locale?: string;
  otp: string;
}

/** The 10-minute verification code email — localized where copy exists. */
const COPY: Record<string, { heading: string; body: string; note: string }> = {
  en: {
    heading: "Verify your email",
    body: `Thank you for signing up for ${BRAND_NAME}. Enter this code to verify your email address:`,
    note: "If you didn't request this code, you can safely ignore this email.",
  },
  id: {
    heading: "Verifikasi email Anda",
    body: `Terima kasih telah mendaftar di ${BRAND_NAME}. Masukkan kode ini untuk memverifikasi alamat email Anda:`,
    note: "Jika Anda tidak meminta kode ini, abaikan email ini.",
  },
  ja: {
    heading: "メールアドレスの確認",
    body: `${BRAND_NAME} にご登録いただきありがとうございます。このコードを入力してメールアドレスを確認してください：`,
    note: "このコードに心当たりがない場合は、このメールは無視していただけます。",
  },
  zh: {
    heading: "验证您的邮箱",
    body: `感谢您注册 ${BRAND_NAME}。输入此代码以验证您的邮箱地址：`,
    note: "如果您没有请求此代码，可以放心忽略这封邮件。",
  },
};

export default function VerifyEmail({ otp = "000000", locale }: VerifyEmailProps) {
  const c = COPY[locale ?? "en"] ?? COPY.en;
  return (
    <EmailLayout previewText={c.heading}>
      <EmailHeading>{c.heading}</EmailHeading>
      <Text className="text-zinc-700 text-[14px] leading-[24px]">{c.body}</Text>
      <EmailHighlight>
        <Text className="text-[32px] font-mono font-bold tracking-widest text-[#16a34a] m-0 text-center">
          {otp}
        </Text>
      </EmailHighlight>
      <EmailNote>{c.note}</EmailNote>
    </EmailLayout>
  );
}
