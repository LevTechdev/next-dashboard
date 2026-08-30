/**
 * Merge the URL-importer i18n keys into the `affiliates` namespace of all 4
 * locale files. Only adds missing keys (never overwrites).
 * Run: node scripts/add-import-i18n.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: {
    importFromUrl: "Import from URL",
    importHint:
      "Paste a product link from Shopee, TikTok Shop, Instagram, Lazada, or Tokopedia. We'll fetch the real title, image, and price.",
    fetchData: "Fetch",
    fetching: "Fetching...",
    importFailed: "Could not fetch product data from that link.",
    importManualHint: "You can still enter the details manually below.",
    productNamePlaceholder: "Product name",
    priceLabel: "Price",
    source: "Source",
  },
  id: {
    importFromUrl: "Impor dari URL",
    importHint:
      "Tempel tautan produk dari Shopee, TikTok Shop, Instagram, Lazada, atau Tokopedia. Kami akan mengambil judul, gambar, dan harga asli.",
    fetchData: "Ambil",
    fetching: "Mengambil...",
    importFailed: "Tidak dapat mengambil data produk dari tautan tersebut.",
    importManualHint: "Anda tetap dapat memasukkan detailnya secara manual di bawah.",
    productNamePlaceholder: "Nama produk",
    priceLabel: "Harga",
    source: "Sumber",
  },
  zh: {
    importFromUrl: "从链接导入",
    importHint:
      "粘贴来自 Shopee、TikTok Shop、Instagram、Lazada 或 Tokopedia 的商品链接，我们将获取真实的标题、图片和价格。",
    fetchData: "获取",
    fetching: "获取中...",
    importFailed: "无法从该链接获取商品数据。",
    importManualHint: "您仍可在下方手动填写详情。",
    productNamePlaceholder: "商品名称",
    priceLabel: "价格",
    source: "来源",
  },
  ja: {
    importFromUrl: "URLからインポート",
    importHint:
      "Shopee、TikTok Shop、Instagram、Lazada、Tokopedia の商品リンクを貼り付けてください。実際のタイトル・画像・価格を取得します。",
    fetchData: "取得",
    fetching: "取得中...",
    importFailed: "そのリンクから商品データを取得できませんでした。",
    importManualHint: "下で手動で詳細を入力することもできます。",
    productNamePlaceholder: "商品名",
    priceLabel: "価格",
    source: "ソース",
  },
};

for (const locale of ["en", "id", "zh", "ja"]) {
  const file = path.join(LOCALES_DIR, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!data.affiliates) data.affiliates = {};
  let added = 0;
  for (const [k, v] of Object.entries(KEYS[locale])) {
    if (!Object.prototype.hasOwnProperty.call(data.affiliates, k)) {
      data.affiliates[k] = v;
      added++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`${locale}.json: +${added} keys`);
}
