import { Text, Section, Heading, Button, Hr } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./EmailLayout";

interface SecurityAlertEmailProps {
  /** The "This wasn't me" revoke link. */
  revokeUrl?: string;
  name?: string;
  locale?: string;
  /** When the 2FA change happened, already formatted for the recipient. */
  happenedAt?: string;
}

/**
 * Sent the moment an emailed account recovery turns two-factor authentication
 * off. The person whose account it is needs to know immediately, and needs one
 * action that actually helps — so the mail states plainly what changed and
 * offers a single "This wasn't me" button that evicts every session and forces
 * a password reset (see src/lib/security-alert.ts).
 *
 * Copy is localized for the four supported locales, matching the rest of the
 * product: a user who cannot read English must still be able to recognize this
 * as a security warning.
 */
const COPY: Record<
  string,
  {
    preview: string;
    heading: string;
    hi: (name: string) => string;
    line1: string;
    line2: string;
    cta: string;
    when: (at: string) => string;
    note: string;
    footer: string;
  }
> = {
  en: {
    preview: "Two-factor authentication was turned off",
    heading: "Two-factor authentication was turned off",
    hi: (name) => `Hi ${name}, `,
    line1:
      "an account recovery was completed for this account, which turned off two-factor authentication and signed out every device.",
    line2:
      "If this was you, sign in with your password and set up a new authenticator. If it was not, secure the account now — this signs out everyone, including whoever did this, and requires a new password.",
    cta: "Review this sign-in change",
    when: (at) => `When: ${at}`,
    note: "This link opens a confirmation page and expires in 7 days. Nothing happens to your account until you confirm there.",
    footer:
      "Turning off two-factor authentication is the one change an attacker makes to keep access. If you were not expecting this email, do not ignore it.",
  },
  id: {
    preview: "Autentikasi dua faktor dinonaktifkan",
    heading: "Autentikasi dua faktor dinonaktifkan",
    hi: (name) => `Halo ${name}, `,
    line1:
      "pemulihan akun telah diselesaikan untuk akun ini, yang mematikan autentikasi dua faktor dan mengeluarkan semua perangkat.",
    line2:
      "Jika ini memang Anda, masuk dengan kata sandi Anda dan siapkan autentikator baru. Jika bukan, amankan akun sekarang — ini mengeluarkan semua orang, termasuk yang melakukannya, dan mewajibkan kata sandi baru.",
    cta: "Tinjau perubahan masuk ini",
    when: (at) => `Waktu: ${at}`,
    note: "Tautan ini membuka halaman konfirmasi dan kedaluwarsa dalam 7 hari. Tidak ada yang terjadi pada akun Anda sampai Anda mengonfirmasi di sana.",
    footer:
      "Mematikan autentikasi dua faktor adalah satu perubahan yang dilakukan penyerang agar tetap bisa masuk. Jika Anda tidak mengharapkan email ini, jangan abaikan.",
  },
  ja: {
    preview: "二段階認証が無効になりました",
    heading: "二段階認証が無効になりました",
    hi: (name) => `${name} 様、`,
    line1:
      "このアカウントでアカウント復旧が完了し、二段階認証が無効になり、すべてのデバイスがサインアウトされました。",
    line2:
      "心当たりがある場合は、パスワードでサインインし、新しい認証アプリを設定してください。心当たりがない場合は、いますぐアカウントを保護してください。実行した人物を含むすべてのセッションが無効になり、新しいパスワードが必要になります。",
    cta: "このサインイン変更を確認",
    when: (at) => `日時: ${at}`,
    note: "このリンクは確認ページを開き、7日後に失効します。そこで確認するまでアカウントには何も起こりません。",
    footer:
      "二段階認証の無効化は、攻撃者がアクセスを維持するために行う変更です。このメールに心当たりがない場合は、無視しないでください。",
  },
  zh: {
    preview: "两步验证已被关闭",
    heading: "两步验证已被关闭",
    hi: (name) => `${name}，您好：`,
    line1: "此账户完成了一次账户恢复，导致两步验证被关闭，并且所有设备都已退出登录。",
    line2:
      "如果是您本人操作，请使用密码登录并重新设置身份验证器。如果不是，请立即保护账户——这会退出所有人的登录（包括操作者），并要求设置新密码。",
    cta: "查看此次登录变更",
    when: (at) => `时间：${at}`,
    note: "此链接会打开确认页面，7 天后失效。在您确认之前，账户不会发生任何变化。",
    footer:
      "关闭两步验证是攻击者为了保持访问权限而做的改动。如果您没有预期收到此邮件，请不要忽视。",
  },
};

export default function SecurityAlertEmail({
  revokeUrl = "https://example.com",
  name,
  locale = "en",
  happenedAt,
}: SecurityAlertEmailProps) {
  const c = COPY[locale] ?? COPY.en;
  return (
    <EmailLayout previewText={c.preview}>
      <Heading className="text-zinc-900 text-[24px] font-bold p-0 my-[30px] mx-0">
        {c.heading}
      </Heading>
      <Text className="text-zinc-700 text-[14px] leading-[24px]">
        {name ? c.hi(name) : ""}
        {c.line1}
      </Text>
      {happenedAt ? (
        <Text className="text-zinc-500 text-[13px] leading-[20px]">{c.when(happenedAt)}</Text>
      ) : null}
      <Text className="text-zinc-700 text-[14px] leading-[24px]">{c.line2}</Text>
      <Section className="mt-[32px] mb-[32px]">
        <Button
          className="bg-[#F25C26] rounded-xl text-white text-[14px] font-semibold no-underline text-center px-6 py-3"
          href={revokeUrl}
        >
          {c.cta}
        </Button>
      </Section>
      <Text className="text-zinc-500 text-[14px] leading-[24px]">{c.note}</Text>
      <Hr className="border-zinc-200 my-[24px]" />
      <Text className="text-zinc-500 text-[14px] leading-[24px]">{c.footer}</Text>
    </EmailLayout>
  );
}
