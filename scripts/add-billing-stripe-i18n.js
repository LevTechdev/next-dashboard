/**
 * One-shot merge of the Stripe billing keys (checkout/portal/gating) into the
 * billing namespace of all 4 locale files. Only adds keys that do not already
 * exist (never overwrites). Usage: node scripts/add-billing-stripe-i18n.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: {
    manageBilling: "Manage Billing",
    portalDesc:
      "Securely manage your payment methods, invoices, and subscription details via the Stripe Customer Portal.",
    downgradeToFree: "Downgrade to Free",
    checkoutRedirect: "Redirecting to secure checkout...",
    checkoutError: "Could not start checkout. Please try again.",
    portalError: "Could not open the billing portal. Please try again.",
    paymentAfterSubscribe: "Payment methods can be managed after subscribing to a paid plan.",
  },
  id: {
    manageBilling: "Kelola Tagihan",
    portalDesc:
      "Kelola metode pembayaran, faktur, dan detail langganan Anda dengan aman melalui Portal Pelanggan Stripe.",
    downgradeToFree: "Turun ke Gratis",
    checkoutRedirect: "Mengalihkan ke pembayaran aman...",
    checkoutError: "Tidak dapat memulai pembayaran. Silakan coba lagi.",
    portalError: "Tidak dapat membuka portal tagihan. Silakan coba lagi.",
    paymentAfterSubscribe: "Metode pembayaran dapat dikelola setelah berlangganan paket berbayar.",
  },
  ja: {
    manageBilling: "請求管理",
    portalDesc:
      "Stripe カスタマーポータルで、支払い方法・請求書・サブスクリプションの詳細を安全に管理できます。",
    downgradeToFree: "無料プランにダウングレード",
    checkoutRedirect: "安全なチェックアウトへ移動しています...",
    checkoutError: "チェックアウトを開始できませんでした。もう一度お試しください。",
    portalError: "請求ポータルを開けませんでした。もう一度お試しください。",
    paymentAfterSubscribe: "支払い方法は有料プランへの登録後に管理できます。",
  },
  zh: {
    manageBilling: "管理账单",
    portalDesc: "通过 Stripe 客户门户安全地管理您的支付方式、发票和订阅详情。",
    downgradeToFree: "降级到免费版",
    checkoutRedirect: "正在跳转到安全结账...",
    checkoutError: "无法开始结账，请重试。",
    portalError: "无法打开账单门户，请重试。",
    paymentAfterSubscribe: "订阅付费套餐后即可管理支付方式。",
  },
};

for (const [locale, keys] of Object.entries(KEYS)) {
  const file = path.join(LOCALES_DIR, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let added = 0;
  const existed = [];

  for (const [k, v] of Object.entries(keys)) {
    if (Object.prototype.hasOwnProperty.call(data.billing, k)) {
      existed.push(k);
    } else {
      data.billing[k] = v;
      added++;
    }
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(
    `${locale}.json: +${added} keys${existed.length ? ` (skipped existing: ${existed.join(", ")})` : ""}`,
  );
}
