/**
 * Merge image-manager / fetch-tier / headless-toggle i18n keys into the
 * `affiliates` namespace of all 4 locale files. Adds missing keys only.
 * Run: node scripts/add-image-features-i18n.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: {
    fetchedVia: "Fetched via",
    tierShopeeApi: "Shopee API",
    tierDirect: "direct request",
    tierFacebook: "Facebook crawler",
    tierTwitter: "Twitter crawler",
    tierHeadless: "headless browser",
    tierManual: "manual entry",
    noImages: "No images",
    headlessFallback: "Headless fallback",
    settingsSaved: "Settings saved",
    productImages: "Product Images",
    cover: "Cover",
    setCover: "Set as cover",
    moveLeft: "Move left",
    moveRight: "Move right",
    addImage: "Add",
    uploadImage: "Upload image",
    imageUrlPlaceholder: "Paste image URL",
    imagesSaved: "Images saved",
    invalidImageUrl: "Enter a valid http(s) image URL",
    imageTooLarge: "Image too large (max 800KB)",
  },
  id: {
    fetchedVia: "Diambil via",
    tierShopeeApi: "API Shopee",
    tierDirect: "permintaan langsung",
    tierFacebook: "crawler Facebook",
    tierTwitter: "crawler Twitter",
    tierHeadless: "browser headless",
    tierManual: "input manual",
    noImages: "Tidak ada gambar",
    headlessFallback: "Fallback headless",
    settingsSaved: "Pengaturan disimpan",
    productImages: "Gambar Produk",
    cover: "Sampul",
    setCover: "Jadikan sampul",
    moveLeft: "Geser kiri",
    moveRight: "Geser kanan",
    addImage: "Tambah",
    uploadImage: "Unggah gambar",
    imageUrlPlaceholder: "Tempel URL gambar",
    imagesSaved: "Gambar disimpan",
    invalidImageUrl: "Masukkan URL gambar http(s) yang valid",
    imageTooLarge: "Gambar terlalu besar (maks 800KB)",
  },
  zh: {
    fetchedVia: "获取方式",
    tierShopeeApi: "Shopee API",
    tierDirect: "直接请求",
    tierFacebook: "Facebook 爬虫",
    tierTwitter: "Twitter 爬虫",
    tierHeadless: "无头浏览器",
    tierManual: "手动输入",
    noImages: "暂无图片",
    headlessFallback: "无头浏览器回退",
    settingsSaved: "设置已保存",
    productImages: "商品图片",
    cover: "封面",
    setCover: "设为封面",
    moveLeft: "左移",
    moveRight: "右移",
    addImage: "添加",
    uploadImage: "上传图片",
    imageUrlPlaceholder: "粘贴图片网址",
    imagesSaved: "图片已保存",
    invalidImageUrl: "请输入有效的 http(s) 图片网址",
    imageTooLarge: "图片过大（最大 800KB）",
  },
  ja: {
    fetchedVia: "取得方法",
    tierShopeeApi: "Shopee API",
    tierDirect: "直接リクエスト",
    tierFacebook: "Facebook クローラー",
    tierTwitter: "Twitter クローラー",
    tierHeadless: "ヘッドレスブラウザ",
    tierManual: "手動入力",
    noImages: "画像なし",
    headlessFallback: "ヘッドレスフォールバック",
    settingsSaved: "設定を保存しました",
    productImages: "商品画像",
    cover: "カバー",
    setCover: "カバーに設定",
    moveLeft: "左へ移動",
    moveRight: "右へ移動",
    addImage: "追加",
    uploadImage: "画像をアップロード",
    imageUrlPlaceholder: "画像URLを貼り付け",
    imagesSaved: "画像を保存しました",
    invalidImageUrl: "有効な http(s) 画像URLを入力してください",
    imageTooLarge: "画像が大きすぎます（最大800KB）",
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
