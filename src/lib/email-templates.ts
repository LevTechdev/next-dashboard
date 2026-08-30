/**
 * Localized email templates for OTP verification, password reset, and welcome emails.
 * Each template has localized heading, body, CTA label, and footer text.
 */

export type EmailLocale = "en" | "id" | "ja" | "zh";

interface EmailTemplateStrings {
  // Common
  brandName: string;
  // OTP
  otpHeading: string;
  otpBody: string;
  otpExpiry: string;
  otpIgnore: string;
  otpFooter: string;
  // Password Reset
  resetHeading: string;
  resetBody: string;
  resetExpiry: string;
  resetCta: string;
  resetIgnore: string;
  resetFooter: string;
  // Welcome
  welcomeHeading: string;
  welcomeBody: string;
  welcomeCta: string;
  welcomeFooter: string;
}

const templates: Record<EmailLocale, EmailTemplateStrings> = {
  en: {
    brandName: "Dashboard",
    otpHeading: "Verify your email",
    otpBody: "Use the code below to verify your email address.",
    otpExpiry: "It expires in 10 minutes.",
    otpIgnore: "If you didn't request this code, you can safely ignore this email.",
    otpFooter: "You received this email because you have an account on Dashboard.",
    resetHeading: "Reset your password",
    resetBody:
      "We received a request to reset your password. Click the button below to choose a new one.",
    resetExpiry: "This link expires in 1 hour.",
    resetCta: "Reset password",
    resetIgnore:
      "If you didn't request this, you can safely ignore this email — your password won't change.",
    resetFooter:
      "You received this email because you have an account on Dashboard.",
    welcomeHeading: "Welcome to Dashboard!",
    welcomeBody:
      "Your account has been created successfully. Click below to get started.",
    welcomeCta: "Go to Dashboard",
    welcomeFooter:
      "You received this email because you created an account on Dashboard.",
  },
  id: {
    brandName: "Dashboard",
    otpHeading: "Verifikasi email Anda",
    otpBody: "Gunakan kode di bawah ini untuk memverifikasi alamat email Anda.",
    otpExpiry: "Kode berlaku selama 10 menit.",
    otpIgnore:
      "Jika Anda tidak meminta kode ini, Anda dapat mengabaikan email ini.",
    otpFooter:
      "Anda menerima email ini karena memiliki akun di Dashboard.",
    resetHeading: "Atur ulang kata sandi",
    resetBody:
      "Kami menerima permintaan untuk mengatur ulang kata sandi Anda. Klik tombol di bawah untuk memilih yang baru.",
    resetExpiry: "Tautan ini berlaku selama 1 jam.",
    resetCta: "Atur ulang kata sandi",
    resetIgnore:
      "Jika Anda tidak meminta ini, Anda dapat mengabaikan email ini — kata sandi Anda tidak akan berubah.",
    resetFooter:
      "Anda menerima email ini karena memiliki akun di Dashboard.",
    welcomeHeading: "Selamat datang di Dashboard!",
    welcomeBody:
      "Akun Anda berhasil dibuat. Klik di bawah untuk memulai.",
    welcomeCta: "Buka Dashboard",
    welcomeFooter:
      "Anda menerima email ini karena membuat akun di Dashboard.",
  },
  ja: {
    brandName: "Dashboard",
    otpHeading: "メールアドレスを確認してください",
    otpBody: "以下のコードを使用してメールアドレスを確認してください。",
    otpExpiry: "有効期限は10分です。",
    otpIgnore: "このコードをリクエストしなかった場合は、このメールを無視してください。",
    otpFooter: "このメールはDashboardにアカウントをお持ちのため送信されました。",
    resetHeading: "パスワードをリセット",
    resetBody:
      "パスワードのリセットリクエストを受け取りました。以下のボタンをクリックして新しいパスワードを設定してください。",
    resetExpiry: "このリンクの有効期限は1時間です。",
    resetCta: "パスワードをリセット",
    resetIgnore:
      "リクエストしなかった場合は、このメールを無視してください。パスワードは変更されません。",
    resetFooter: "このメールはDashboardにアカウントをお持ちのため送信されました。",
    welcomeHeading: "Dashboardへようこそ！",
    welcomeBody:
      "アカウントが正常に作成されました。以下をクリックして開始してください。",
    welcomeCta: "Dashboardを開く",
    welcomeFooter: "このメールはDashboardにアカウントを作成したため送信されました。",
  },
  zh: {
    brandName: "Dashboard",
    otpHeading: "验证您的邮箱",
    otpBody: "请使用以下验证码来验证您的邮箱地址。",
    otpExpiry: "验证码有效期为10分钟。",
    otpIgnore: "如果您没有请求此验证码，请忽略此邮件。",
    otpFooter: "您收到此邮件是因为您在Dashboard上有账户。",
    resetHeading: "重置密码",
    resetBody:
      "我们收到了重置密码的请求。点击下方按钮设置新密码。",
    resetExpiry: "此链接有效期为1小时。",
    resetCta: "重置密码",
    resetIgnore:
      "如果您没有请求此操作，请忽略此邮件 — 您的密码不会更改。",
    resetFooter: "您收到此邮件是因为您在Dashboard上有账户。",
    welcomeHeading: "欢迎使用Dashboard！",
    welcomeBody: "您的账户已成功创建。点击下方开始使用。",
    welcomeCta: "打开Dashboard",
    welcomeFooter: "您收到此邮件是因为您在Dashboard上创建了账户。",
  },
};

export function getEmailStrings(locale?: string): EmailTemplateStrings {
  return templates[(locale as EmailLocale) || "en"] || templates.en;
}

// ── OTP Email ──────────────────────────────────────────────────────────────

export function renderOtpEmail(
  otp: string,
  locale?: string,
): { subject: string; html: string; text: string } {
  const s = getEmailStrings(locale);

  const codeHtml = otp
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;min-width:34px;padding:10px 6px;margin:0 3px;font-size:24px;font-weight:700;letter-spacing:4px;color:#111827;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;text-align:center;">${d}</span>`,
    )
    .join("");

  const text = `${s.otpBody}\n\n${otp}\n\n${s.otpExpiry}\n\n${s.otpIgnore}`;

  const html = `<!DOCTYPE html>
<html lang="${locale || "en"}">
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:28px 32px;background:#4f46e5;">
              <span style="color:#ffffff;font-size:18px;font-weight:700;">${s.brandName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${s.otpHeading}</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">${s.otpBody} ${s.otpExpiry}</p>
              <div style="margin:0 0 24px;text-align:center;">${codeHtml}</div>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${s.otpIgnore}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">${s.otpFooter}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const subjects: Record<string, string> = {
    en: `Your verification code — ${s.brandName}`,
    id: `Kode verifikasi Anda — ${s.brandName}`,
    ja: `確認コード — ${s.brandName}`,
    zh: `您的验证码 — ${s.brandName}`,
  };

  return {
    subject: subjects[locale || "en"] || subjects.en,
    html,
    text,
  };
}

// ── Password Reset Email ───────────────────────────────────────────────────

export function renderPasswordResetEmail(
  url: string,
  locale?: string,
): { subject: string; html: string; text: string } {
  const s = getEmailStrings(locale);

  const text = `${s.resetBody}\n\n${url}\n\n${s.resetExpiry}\n\n${s.resetIgnore}`;

  const html = `<!DOCTYPE html>
<html lang="${locale || "en"}">
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:28px 32px;background:#4f46e5;">
              <span style="color:#ffffff;font-size:18px;font-weight:700;">${s.brandName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${s.resetHeading}</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">${s.resetBody} ${s.resetExpiry}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:8px;background:#4f46e5;">
                    <a href="${url.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${s.resetCta}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${s.resetIgnore}</p>
              <p style="margin:16px 0 0;font-size:12px;color:#4f46e5;word-break:break-all;">${url.replace(/&/g, "&amp;")}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">${s.resetFooter}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const subjects: Record<string, string> = {
    en: `Reset your password — ${s.brandName}`,
    id: `Atur ulang kata sandi — ${s.brandName}`,
    ja: `パスワードのリセット — ${s.brandName}`,
    zh: `重置密码 — ${s.brandName}`,
  };

  return {
    subject: subjects[locale || "en"] || subjects.en,
    html,
    text,
  };
}

// ── Welcome Email ──────────────────────────────────────────────────────────

export function renderWelcomeEmail(
  url: string,
  locale?: string,
): { subject: string; html: string; text: string } {
  const s = getEmailStrings(locale);

  const text = `${s.welcomeBody}\n\n${url}\n\n${s.welcomeFooter}`;

  const html = `<!DOCTYPE html>
<html lang="${locale || "en"}">
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);">
              <span style="color:#ffffff;font-size:18px;font-weight:700;">${s.brandName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${s.welcomeHeading}</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">${s.welcomeBody}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:8px;background:#4f46e5;">
                    <a href="${url.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${s.welcomeCta}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">${s.welcomeFooter}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const subjects: Record<string, string> = {
    en: `Welcome to ${s.brandName}!`,
    id: `Selamat datang di ${s.brandName}!`,
    ja: `${s.brandName}へようこそ！`,
    zh: `欢迎使用${s.brandName}！`,
  };

  return {
    subject: subjects[locale || "en"] || subjects.en,
    html,
    text,
  };
}
