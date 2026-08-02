/**
 * Merge the product-image-gallery i18n keys into the `affiliates` namespace of
 * all 4 locale files. Only adds missing keys. Run: node scripts/add-image-i18n.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: { imagesFound: "images", chooseCover: "Choose cover image" },
  id: { imagesFound: "gambar", chooseCover: "Pilih gambar sampul" },
  zh: { imagesFound: "张图片", chooseCover: "选择封面图片" },
  ja: { imagesFound: "枚の画像", chooseCover: "カバー画像を選択" },
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
