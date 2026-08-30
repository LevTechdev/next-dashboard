/**
 * One-shot merge of the Midtrans local-payment keys (gateway chooser, channels,
 * payment-tab info) into the billing namespace of all 4 locale files. Only
 * adds keys that do not already exist (never overwrites).
 * Usage: node scripts/add-midtrans-i18n.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: {
    payWith: "Pay with",
    gatewayStripe: "Stripe (International card)",
    gatewayMidtrans: "Midtrans (Local payments)",
    midtransChannel: "Payment method",
    channelDana: "DANA (E-Wallet)",
    channelGopay: "GoPay (E-Wallet)",
    channelQris: "QRIS (QR scan)",
    channelBankTransfer: "Bank Transfer (Virtual Account)",
    channelCreditCard: "Credit / Debit Card",
    checkoutLocalRedirect: "Redirecting to local payment (Midtrans)...",
    localPaymentsTitle: "Local payment methods",
    localPaymentsDesc:
      "Pay via Midtrans using Indonesian payment methods — no international card required.",
    localPaymentsNote: "Select the payment method during plan checkout on the Plans tab.",
  },
  id: {
    payWith: "Bayar dengan",
    gatewayStripe: "Stripe (Kartu internasional)",
    gatewayMidtrans: "Midtrans (Pembayaran lokal)",
    midtransChannel: "Metode pembayaran",
    channelDana: "DANA (E-Wallet)",
    channelGopay: "GoPay (E-Wallet)",
    channelQris: "QRIS (Pindai QR)",
    channelBankTransfer: "Transfer Bank (Virtual Account)",
    channelCreditCard: "Kartu Kredit / Debit",
    checkoutLocalRedirect: "Mengalihkan ke pembayaran lokal (Midtrans)...",
    localPaymentsTitle: "Metode pembayaran lokal",
    localPaymentsDesc:
      "Bayar melalui Midtrans menggunakan metode pembayaran Indonesia — tanpa kartu internasional.",
    localPaymentsNote: "Pilih metode pembayaran saat checkout paket di tab Paket.",
  },
  ja: {
    payWith: "支払い方法",
    gatewayStripe: "Stripe（国際カード）",
    gatewayMidtrans: "Midtrans（ローカル決済）",
    midtransChannel: "決済方法",
    channelDana: "DANA（電子ウォレット）",
    channelGopay: "GoPay（電子ウォレット）",
    channelQris: "QRIS（QRスキャン）",
    channelBankTransfer: "銀行振込（バーチャル口座）",
    channelCreditCard: "クレジット／デビットカード",
    checkoutLocalRedirect: "ローカル決済（Midtrans）へ移動しています...",
    localPaymentsTitle: "ローカル決済方法",
    localPaymentsDesc:
      "Midtrans を利用したインドネシアの決済方法で支払えます — 国際カードは不要です。",
    localPaymentsNote: "プランタブのチェックアウト時に決済方法を選択できます。",
  },
  zh: {
    payWith: "支付方式",
    gatewayStripe: "Stripe（国际卡）",
    gatewayMidtrans: "Midtrans（本地支付）",
    midtransChannel: "支付方式",
    channelDana: "DANA（电子钱包）",
    channelGopay: "GoPay（电子钱包）",
    channelQris: "QRIS（扫码支付）",
    channelBankTransfer: "银行转账（虚拟账户）",
    channelCreditCard: "信用卡／借记卡",
    checkoutLocalRedirect: "正在跳转到本地支付（Midtrans）...",
    localPaymentsTitle: "本地支付方式",
    localPaymentsDesc: "通过 Midtrans 使用印尼本地支付方式付款 — 无需国际卡。",
    localPaymentsNote: "可在套餐页签的结账流程中选择支付方式。",
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
