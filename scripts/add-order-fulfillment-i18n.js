/**
 * One-shot merge of the order fulfillment + refund keys into the orders
 * namespace of all 4 locale files. Only adds keys that do not already exist
 * (never overwrites). Usage: node scripts/add-order-fulfillment-i18n.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: {
    fulfillmentTitle: "Fulfillment",
    trackingNumber: "Tracking number",
    carrier: "Carrier",
    trackingNumberPlaceholder: "e.g. JNE00938827142",
    carrierPlaceholder: "e.g. JNE, J&T, SiCepat",
    trackingSave: "Save tracking",
    trackingSaved: "Tracking information saved",
    trackingSaveFailed: "Could not save tracking information",
    refundBtn: "Refund",
    refundConfirm:
      "Refund this order? The customer's payment will be refunded and the order will be closed.",
    refundedToast: "Order refunded",
    processedOn: "Processed on",
    shippedOn: "Shipped on",
    deliveredOn: "Delivered on",
    refundedOn: "Refunded on",
  },
  id: {
    fulfillmentTitle: "Pemenuhan",
    trackingNumber: "Nomor resi",
    carrier: "Kurir",
    trackingNumberPlaceholder: "cth. JNE00938827142",
    carrierPlaceholder: "cth. JNE, J&T, SiCepat",
    trackingSave: "Simpan pelacakan",
    trackingSaved: "Informasi pelacakan disimpan",
    trackingSaveFailed: "Gagal menyimpan informasi pelacakan",
    refundBtn: "Refund",
    refundConfirm:
      "Refund pesanan ini? Pembayaran pelanggan akan dikembalikan dan pesanan akan ditutup.",
    refundedToast: "Pesanan di-refund",
    processedOn: "Diproses pada",
    shippedOn: "Dikirim pada",
    deliveredOn: "Diterima pada",
    refundedOn: "Di-refund pada",
  },
  ja: {
    fulfillmentTitle: "フルフィルメント",
    trackingNumber: "追跡番号",
    carrier: "配送業者",
    trackingNumberPlaceholder: "例: JNE00938827142",
    carrierPlaceholder: "例: JNE、J&T、SiCepat",
    trackingSave: "追跡情報を保存",
    trackingSaved: "追跡情報を保存しました",
    trackingSaveFailed: "追跡情報を保存できませんでした",
    refundBtn: "返金",
    refundConfirm:
      "この注文を返金しますか？顧客の支払いは返金され、注文は終了します。",
    refundedToast: "注文を返金しました",
    processedOn: "処理日時",
    shippedOn: "発送日時",
    deliveredOn: "配達日時",
    refundedOn: "返金日時",
  },
  zh: {
    fulfillmentTitle: "履约",
    trackingNumber: "运单号",
    carrier: "承运商",
    trackingNumberPlaceholder: "例如 JNE00938827142",
    carrierPlaceholder: "例如 JNE、J&T、SiCepat",
    trackingSave: "保存跟踪信息",
    trackingSaved: "跟踪信息已保存",
    trackingSaveFailed: "无法保存跟踪信息",
    refundBtn: "退款",
    refundConfirm: "退款此订单？客户的付款将被退还，订单将关闭。",
    refundedToast: "订单已退款",
    processedOn: "处理于",
    shippedOn: "发货于",
    deliveredOn: "送达于",
    refundedOn: "退款于",
  },
};

for (const [locale, keys] of Object.entries(KEYS)) {
  const file = path.join(LOCALES_DIR, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let added = 0;
  const existed = [];

  for (const [k, v] of Object.entries(keys)) {
    if (Object.prototype.hasOwnProperty.call(data.orders, k)) {
      existed.push(k);
    } else {
      data.orders[k] = v;
      added++;
    }
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(
    `${locale}.json: +${added} keys${existed.length ? ` (skipped existing: ${existed.join(", ")})` : ""}`,
  );
}
