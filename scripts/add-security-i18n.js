/**
 * One-shot merge of new security-center i18n keys (MFA verification status,
 * last-passkey warnings) into all 4 locale files. Only adds keys that do not
 * already exist (never overwrites).
 * Usage: node scripts/add-security-i18n.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: {
    mfaVerifiedRecent: "MFA verified recently",
    mfaNotVerifiedRecent: "MFA not verified in 30 days",
    passkeyBackupHint:
      "You have only one passkey. Add a second one as a backup so you can still sign in if this device is lost.",
    lastPasskeyWarning:
      "This is your only passkey. After removing it you will no longer be able to sign in with a passkey.",
    evt_MFA_VERIFIED: "Multi-factor verified",
  },
  id: {
    mfaVerifiedRecent: "MFA terverifikasi baru-baru ini",
    mfaNotVerifiedRecent: "MFA tidak diverifikasi dalam 30 hari",
    passkeyBackupHint:
      "Anda hanya memiliki satu passkey. Tambahkan satu lagi sebagai cadangan agar Anda tetap bisa masuk jika perangkat ini hilang.",
    lastPasskeyWarning:
      "Ini adalah satu-satunya passkey Anda. Setelah dihapus, Anda tidak akan bisa masuk menggunakan passkey lagi.",
    evt_MFA_VERIFIED: "Autentikasi multi-faktor terverifikasi",
  },
  ja: {
    mfaVerifiedRecent: "MFA 認証済み（直近）",
    mfaNotVerifiedRecent: "30 日以内に MFA 認証なし",
    passkeyBackupHint:
      "パスキーは 1 つだけです。このデバイスを紛失してもサインインできるよう、予備として 2 つ目を追加してください。",
    lastPasskeyWarning:
      "これは最後のパスキーです。削除すると、パスキーでサインインできなくなります。",
    evt_MFA_VERIFIED: "多要素認証が確認されました",
  },
  zh: {
    mfaVerifiedRecent: "最近已验证多因素认证",
    mfaNotVerifiedRecent: "30 天内未验证多因素认证",
    passkeyBackupHint:
      "您只有一个通行密钥。建议再添加一个作为备份，以防此设备丢失后无法登录。",
    lastPasskeyWarning: "这是您唯一的通行密钥。删除后将无法再使用通行密钥登录。",
    evt_MFA_VERIFIED: "多因素认证已验证",
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
