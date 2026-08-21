/**
 * One-shot merge of email-verification i18n keys into the security namespace
 * of all 4 locale files. Only adds keys that do not already exist.
 * Usage: node scripts/add-email-verify-i18n.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: {
    emailVerification: "Email Verification",
    emailVerifiedStatus: "Email verified",
    emailUnverified: "Email Not Verified",
    emailVerifyDesc: "Verify your email to strengthen your account and recover access if you lose your password.",
    emailVerificationSent: "Verification email sent successfully",
    emailVerifiedToast: "Email verified successfully!",
    emailVerifyLinkInvalid: "This verification link is invalid or has expired.",
    sendVerificationEmail: "Send Verification Email",
    sendingVerification: "Sending...",
    verificationLink: "Verification link",
    verificationNote: "Open this link in the same browser to finish verifying your email. It expires in 1 hour.",
    linkCopied: "Link copied to clipboard",
    evt_EMAIL_VERIFIED: "Email verified",
  },
  id: {
    emailVerification: "Verifikasi Email",
    emailVerifiedStatus: "Email terverifikasi",
    emailUnverified: "Email Belum Terverifikasi",
    emailVerifyDesc: "Verifikasi email Anda untuk memperkuat akun dan memulihkan akses jika lupa kata sandi.",
    emailVerificationSent: "Email verifikasi berhasil dikirim",
    emailVerifiedToast: "Email berhasil diverifikasi!",
    emailVerifyLinkInvalid: "Tautan verifikasi ini tidak valid atau sudah kedaluwarsa.",
    sendVerificationEmail: "Kirim Email Verifikasi",
    sendingVerification: "Mengirim...",
    verificationLink: "Tautan verifikasi",
    verificationNote: "Buka tautan ini di browser yang sama untuk menyelesaikan verifikasi email. Kedaluwarsa dalam 1 jam.",
    linkCopied: "Tautan disalin ke clipboard",
    evt_EMAIL_VERIFIED: "Email terverifikasi",
  },
  ja: {
    emailVerification: "メール確認",
    emailVerifiedStatus: "メール確認済み",
    emailUnverified: "メール未確認",
    emailVerifyDesc: "メールを確認してアカウントを強化し、パスワードを紛失してもアクセスを回復できるようにしましょう。",
    emailVerificationSent: "確認メールを送信しました",
    emailVerifiedToast: "メールの確認に成功しました！",
    emailVerifyLinkInvalid: "この確認リンクは無効か、期限切れです。",
    sendVerificationEmail: "確認メールを送信",
    sendingVerification: "送信中...",
    verificationLink: "確認リンク",
    verificationNote: "同じブラウザでこのリンクを開いてメール確認を完了してください。1時間で期限切れになります。",
    linkCopied: "リンクをクリップボードにコピーしました",
    evt_EMAIL_VERIFIED: "メール確認済み",
  },
  zh: {
    emailVerification: "邮箱验证",
    emailVerifiedStatus: "邮箱已验证",
    emailUnverified: "邮箱未验证",
    emailVerifyDesc: "验证您的邮箱以增强账户安全，并在忘记密码时恢复访问。",
    emailVerificationSent: "验证邮件已成功发送",
    emailVerifiedToast: "邮箱验证成功！",
    emailVerifyLinkInvalid: "此验证链接无效或已过期。",
    sendVerificationEmail: "发送验证邮件",
    sendingVerification: "发送中...",
    verificationLink: "验证链接",
    verificationNote: "请在同一个浏览器中打开此链接以完成邮箱验证。链接 1 小时内有效。",
    linkCopied: "链接已复制到剪贴板",
    evt_EMAIL_VERIFIED: "邮箱已验证",
  },
};

for (const [locale, keys] of Object.entries(KEYS)) {
  const file = path.join(LOCALES_DIR, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let added = 0;
  const existed = [];
  if (!data.security) data.security = {};
  for (const [k, v] of Object.entries(keys)) {
    if (Object.prototype.hasOwnProperty.call(data.security, k)) {
      existed.push(k);
    } else {
      data.security[k] = v;
      added++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(
    `${locale}.json: security +${added} keys${existed.length ? ` (skipped: ${existed.join(", ")})` : ""}`,
  );
}
