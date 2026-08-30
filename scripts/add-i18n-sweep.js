/**
 * One-shot merge of remaining hardcoded dashboard strings into all 4 locale files.
 * Adds: status namespace (shared order-status labels), export namespace
 * (DataExportButton internals), common.selectAll, and page-specific keys for
 * sales / inventory / customers / marketing. Only adds keys that do not already
 * exist (never overwrites).
 * Usage: node scripts/add-i18n-sweep.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: {
    status: {
      pending: "Pending",
      processing: "Processing",
      shipped: "Shipped",
      delivered: "Delivered",
      cancelled: "Cancelled",
    },
    export: {
      exportCsv: "Export CSV",
      exportCsvDesc: "Comma-separated values — opens in Excel",
      exportExcel: "Export Excel",
      exportExcelDesc: "Formatted .xlsx spreadsheet",
      copyClipboard: "Copy to Clipboard",
      copyClipboardDesc: "Copy as tabular text",
      printView: "Print View",
      printViewDesc: "Open a print-friendly table",
      exported: "Exported!",
      exportAs: "Export as",
      customizeColumns: "Customize columns...",
      showingRows: "Showing {shown} of {total} rows",
      selectColumns: "Select Columns to Export",
      chooseColumns: "Choose which columns to include in the export.",
      selectedOf: "{selected} of {total} selected",
      reset: "Reset",
      exportCount: "Export ({count} columns)",
    },
    common: {
      selectAll: "Select all",
    },
    sales: {
      orderNumber: "Order #",
      payment: "Payment",
      guest: "Guest",
    },
    inventory: {
      needsRestock: "Needs Restock",
      totalValue: "Total Value",
      productsByCategory: "Products by category",
      noCategories: "No categories found",
      tryAdjustingSearch: "Try adjusting your search",
      uncategorized: "Uncategorized",
      units: "{count} units",
      showingOf: "Showing {shown} of {total} products",
    },
    customers: {
      regular: "Regular",
      new: "New",
    },
    marketing: {
      emailType: "Email",
      socialType: "Social Media",
      adsType: "Paid Ads",
    },
  },
  id: {
    status: {
      pending: "Tertunda",
      processing: "Diproses",
      shipped: "Dikirim",
      delivered: "Terkirim",
      cancelled: "Dibatalkan",
    },
    export: {
      exportCsv: "Ekspor CSV",
      exportCsvDesc: "Nilai yang dipisahkan koma — terbuka di Excel",
      exportExcel: "Ekspor Excel",
      exportExcelDesc: "Spreadsheet .xlsx terformat",
      copyClipboard: "Salin ke Clipboard",
      copyClipboardDesc: "Salin sebagai teks tabel",
      printView: "Tampilan Cetak",
      printViewDesc: "Buka tabel yang ramah cetak",
      exported: "Diekspor!",
      exportAs: "Ekspor sebagai",
      customizeColumns: "Sesuaikan kolom...",
      showingRows: "Menampilkan {shown} dari {total} baris",
      selectColumns: "Pilih Kolom untuk Diekspor",
      chooseColumns: "Pilih kolom yang ingin disertakan dalam ekspor.",
      selectedOf: "{selected} dari {total} dipilih",
      reset: "Atur Ulang",
      exportCount: "Ekspor ({count} kolom)",
    },
    common: {
      selectAll: "Pilih semua",
    },
    sales: {
      orderNumber: "Pesanan #",
      payment: "Pembayaran",
      guest: "Tamu",
    },
    inventory: {
      needsRestock: "Perlu Isi Ulang",
      totalValue: "Total Nilai",
      productsByCategory: "Produk berdasarkan kategori",
      noCategories: "Tidak ada kategori ditemukan",
      tryAdjustingSearch: "Coba sesuaikan pencarian Anda",
      uncategorized: "Tanpa Kategori",
      units: "{count} unit",
      showingOf: "Menampilkan {shown} dari {total} produk",
    },
    customers: {
      regular: "Reguler",
      new: "Baru",
    },
    marketing: {
      emailType: "Email",
      socialType: "Media Sosial",
      adsType: "Iklan Berbayar",
    },
  },
  ja: {
    status: {
      pending: "保留中",
      processing: "処理中",
      shipped: "発送済み",
      delivered: "配達済み",
      cancelled: "キャンセル済み",
    },
    export: {
      exportCsv: "CSVをエクスポート",
      exportCsvDesc: "カンマ区切り値 — Excelで開きます",
      exportExcel: "Excelをエクスポート",
      exportExcelDesc: "フォーマット済み.xlsxスプレッドシート",
      copyClipboard: "クリップボードにコピー",
      copyClipboardDesc: "表形式テキストとしてコピー",
      printView: "印刷ビュー",
      printViewDesc: "印刷用テーブルを開く",
      exported: "エクスポートしました！",
      exportAs: "エクスポート形式",
      customizeColumns: "列をカスタマイズ...",
      showingRows: "{total}行中{shown}行を表示",
      selectColumns: "エクスポートする列を選択",
      chooseColumns: "エクスポートに含める列を選択してください。",
      selectedOf: "{total}中{selected}件選択中",
      reset: "リセット",
      exportCount: "エクスポート（{count}列）",
    },
    common: {
      selectAll: "すべて選択",
    },
    sales: {
      orderNumber: "注文番号",
      payment: "支払い",
      guest: "ゲスト",
    },
    inventory: {
      needsRestock: "再入荷が必要",
      totalValue: "総額",
      productsByCategory: "カテゴリ別製品",
      noCategories: "カテゴリが見つかりません",
      tryAdjustingSearch: "検索条件を調整してみてください",
      uncategorized: "未分類",
      units: "{count}個",
      showingOf: "製品{total}件中{shown}件を表示",
    },
    customers: {
      regular: "通常",
      new: "新規",
    },
    marketing: {
      emailType: "メール",
      socialType: "ソーシャルメディア",
      adsType: "有料広告",
    },
  },
  zh: {
    status: {
      pending: "待处理",
      processing: "处理中",
      shipped: "已发货",
      delivered: "已送达",
      cancelled: "已取消",
    },
    export: {
      exportCsv: "导出 CSV",
      exportCsvDesc: "逗号分隔值 — 可在 Excel 中打开",
      exportExcel: "导出 Excel",
      exportExcelDesc: "格式化的 .xlsx 电子表格",
      copyClipboard: "复制到剪贴板",
      copyClipboardDesc: "以表格文本复制",
      printView: "打印视图",
      printViewDesc: "打开便于打印的表格",
      exported: "已导出！",
      exportAs: "导出为",
      customizeColumns: "自定义列...",
      showingRows: "显示 {total} 行中的 {shown} 行",
      selectColumns: "选择要导出的列",
      chooseColumns: "选择要在导出中包含的列。",
      selectedOf: "已选择 {total} 个中的 {selected} 个",
      reset: "重置",
      exportCount: "导出（{count} 列）",
    },
    common: {
      selectAll: "全选",
    },
    sales: {
      orderNumber: "订单号",
      payment: "付款",
      guest: "访客",
    },
    inventory: {
      needsRestock: "需要补货",
      totalValue: "总价值",
      productsByCategory: "按类别划分的产品",
      noCategories: "未找到类别",
      tryAdjustingSearch: "请尝试调整搜索条件",
      uncategorized: "未分类",
      units: "{count} 件",
      showingOf: "显示 {total} 个产品中的 {shown} 个",
    },
    customers: {
      regular: "普通",
      new: "新客户",
    },
    marketing: {
      emailType: "邮件",
      socialType: "社交媒体",
      adsType: "付费广告",
    },
  },
};

for (const [locale, namespaces] of Object.entries(KEYS)) {
  const file = path.join(LOCALES_DIR, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  let added = 0;
  const existed = [];

  for (const [ns, keys] of Object.entries(namespaces)) {
    if (!data[ns]) data[ns] = {};
    for (const [k, v] of Object.entries(keys)) {
      if (Object.prototype.hasOwnProperty.call(data[ns], k)) {
        existed.push(`${ns}.${k}`);
      } else {
        data[ns][k] = v;
        added++;
      }
    }
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(
    `${locale}.json: +${added} keys${existed.length ? ` (skipped existing: ${existed.join(", ")})` : ""}`,
  );
}
