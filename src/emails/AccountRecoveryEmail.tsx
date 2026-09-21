import { Text, Section, Heading, Button, Hr } from "@react-email/components";
import * as React from "react";
import EmailLayout from "./EmailLayout";

interface AccountRecoveryEmailProps {
  url?: string;
  name?: string;
  locale?: string;
}

/**
 * Last-resort account recovery: the recipient lost the authenticator AND every
 * backup code. The mail says exactly what completing it will do (2FA off, other
 * devices signed out), because that is what the link does — the user should not
 * be surprised by it.
 *
 * Localized for the four supported locales. This one matters more than most:
 * it arrives exactly when someone is locked out and least able to work around
 * copy they cannot read.
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
    note: string;
    footer: string;
  }
> = {
  en: {
    preview: "Recover access to your account",
    heading: "Recover access to your account",
    hi: (name) => `Hi ${name}, `,
    line1:
      "you asked to recover this account because you no longer have your authenticator app or any of your backup codes.",
    line2:
      "The button below turns off two-factor authentication and signs out every device currently using the account, so you can sign in with your password and set up a new authenticator.",
    cta: "Recover Access",
    note: "This link works once and expires in 30 minutes.",
    footer:
      "If you didn't ask for this, your password may be known to someone else — change it immediately and review the security activity on your account.",
  },
  id: {
    preview: "Pulihkan akses ke akun Anda",
    heading: "Pulihkan akses ke akun Anda",
    hi: (name) => `Halo ${name}, `,
    line1:
      "Anda meminta pemulihan akun ini karena aplikasi autentikator dan semua kode cadangan Anda sudah tidak dapat diakses.",
    line2:
      "Tombol di bawah ini mematikan autentikasi dua faktor dan mengeluarkan semua perangkat yang sedang menggunakan akun ini, sehingga Anda dapat masuk dengan kata sandi dan menyiapkan autentikator baru.",
    cta: "Pulihkan Akses",
    note: "Tautan ini hanya berlaku sekali dan kedaluwarsa dalam 30 menit.",
    footer:
      "Jika Anda tidak memintanya, kata sandi Anda mungkin diketahui orang lain — segera ubah dan tinjau aktivitas keamanan akun Anda.",
  },
  ja: {
    preview: "アカウントへのアクセスを復旧",
    heading: "アカウントへのアクセスを復旧",
    hi: (name) => `${name} 様、`,
    line1:
      "認証アプリとバックアップコードのいずれも使用できないため、このアカウントの復旧がリクエストされました。",
    line2:
      "下のボタンを押すと二段階認証が無効になり、このアカウントを使用中のすべての端末がサインアウトされます。その後、パスワードでサインインし、新しい認証アプリを設定できます。",
    cta: "アクセスを復旧",
    note: "このリンクは一度だけ有効で、30 分後に失効します。",
    footer:
      "心当たりがない場合、パスワードが第三者に知られている可能性があります。すぐに変更し、アカウントのセキュリティ履歴を確認してください。",
  },
  zh: {
    preview: "恢复账户访问权限",
    heading: "恢复账户访问权限",
    hi: (name) => `${name}，您好：`,
    line1: "由于您已无法使用身份验证器应用和任何恢复代码，因此请求恢复此账户。",
    line2:
      "点击下方按钮将关闭两步验证，并让当前使用该账户的所有设备退出登录，之后您可以使用密码登录并重新设置身份验证器。",
    cta: "恢复访问",
    note: "此链接仅可使用一次，30 分钟后失效。",
    footer: "如果您并未申请恢复，您的密码可能已被他人知晓——请立即修改并检查账户的安全活动。",
  },
};

export default function AccountRecoveryEmail({
  url = "https://example.com",
  name,
  locale = "en",
}: AccountRecoveryEmailProps) {
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
      <Text className="text-zinc-700 text-[14px] leading-[24px]">{c.line2}</Text>
      <Section className="mt-[32px] mb-[32px]">
        <Button
          className="bg-[#F25C38] rounded-xl text-white text-[14px] font-semibold no-underline text-center px-6 py-3"
          href={url}
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
