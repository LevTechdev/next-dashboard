/**
 * One-shot merge of new i18n keys for detail pages, password reset,
 * invoice download, and CSV import into all 4 locale files.
 * Only adds keys that do not already exist (never overwrites).
 * Usage: node scripts/add-i18n-keys.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: {
    orders: {
      notFound: "Order not found",
      backToOrders: "Back to Orders",
    },
    customers: {
      notFound: "Customer not found",
      backToCustomers: "Back to Customers",
      memberSince: "Customer since",
      recentOrders: "Order History",
      avgOrderValue: "Avg. Order Value",
    },
    products: {
      notFound: "Product not found",
      backToProducts: "Back to Products",
      recentOrders: "Recent Orders",
      inventoryHistory: "Inventory History",
      margin: "Margin",
      selectedCount: "{count} selected",
      bulkDeleteConfirm: "Delete {count} selected products?",
      bulkDeleted: "{count} products deleted",
    },
    auth: {
      forgotPasswordTitle: "Forgot Password?",
      forgotPasswordSubtitle: "Enter your email and we'll send you a reset link",
      sendResetLink: "Send Reset Link",
      sendingResetLink: "Sending...",
      resetLinkSent: "Reset link sent",
      resetLinkSentDesc: "If an account exists for that email, a reset link has been sent",
      backToLogin: "Back to login",
      resetPasswordTitle: "Reset Password",
      resetPasswordSubtitle: "Choose a new password for your account",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
      resetPasswordButton: "Reset Password",
      resettingPassword: "Resetting...",
      passwordResetSuccess: "Password reset successfully. Please sign in.",
      passwordMismatch: "Passwords do not match",
      passwordTooShort: "Password must be at least 8 characters",
      invalidResetToken: "Invalid or expired reset link",
      resetError: "Something went wrong. Please try again.",
    },
    csvImport: {
      importCsv: "Import CSV",
      expectedFormat: "Expected columns:",
      emptyFile: "The file is empty or has no data rows",
      missingColumns: "Missing required columns: {columns}",
      previewCount: "{count} rows from {file}",
      moreRows: "...and {count} more rows",
      importRows: "Import {count} rows",
      importResult: "{imported} imported, {skipped} skipped",
    },
  },
  id: {
    orders: {
      notFound: "Pesanan tidak ditemukan",
      backToOrders: "Kembali ke Pesanan",
    },
    customers: {
      notFound: "Pelanggan tidak ditemukan",
      backToCustomers: "Kembali ke Pelanggan",
      memberSince: "Pelanggan sejak",
      recentOrders: "Riwayat Pesanan",
      avgOrderValue: "Rata-rata Nilai Pesanan",
    },
    products: {
      notFound: "Produk tidak ditemukan",
      backToProducts: "Kembali ke Produk",
      recentOrders: "Pesanan Terbaru",
      inventoryHistory: "Riwayat Inventaris",
      margin: "Margin",
      selectedCount: "{count} dipilih",
      bulkDeleteConfirm: "Hapus {count} produk terpilih?",
      bulkDeleted: "{count} produk dihapus",
    },
    auth: {
      forgotPasswordTitle: "Lupa Kata Sandi?",
      forgotPasswordSubtitle: "Masukkan email Anda dan kami akan mengirimkan tautan reset",
      sendResetLink: "Kirim Tautan Reset",
      sendingResetLink: "Mengirim...",
      resetLinkSent: "Tautan reset terkirim",
      resetLinkSentDesc: "Jika akun dengan email tersebut ada, tautan reset telah dikirim",
      backToLogin: "Kembali ke halaman masuk",
      resetPasswordTitle: "Reset Kata Sandi",
      resetPasswordSubtitle: "Pilih kata sandi baru untuk akun Anda",
      newPassword: "Kata Sandi Baru",
      confirmPassword: "Konfirmasi Kata Sandi",
      resetPasswordButton: "Reset Kata Sandi",
      resettingPassword: "Mereset...",
      passwordResetSuccess: "Kata sandi berhasil direset. Silakan masuk.",
      passwordMismatch: "Kata sandi tidak cocok",
      passwordTooShort: "Kata sandi minimal 8 karakter",
      invalidResetToken: "Tautan reset tidak valid atau kedaluwarsa",
      resetError: "Terjadi kesalahan. Silakan coba lagi.",
    },
    csvImport: {
      importCsv: "Impor CSV",
      expectedFormat: "Kolom yang diharapkan:",
      emptyFile: "File kosong atau tidak memiliki baris data",
      missingColumns: "Kolom wajib tidak ditemukan: {columns}",
      previewCount: "{count} baris dari {file}",
      moreRows: "...dan {count} baris lainnya",
      importRows: "Impor {count} baris",
      importResult: "{imported} diimpor, {skipped} dilewati",
    },
  },
  zh: {
    orders: {
      notFound: "未找到订单",
      backToOrders: "返回订单列表",
    },
    customers: {
      notFound: "未找到客户",
      backToCustomers: "返回客户列表",
      memberSince: "注册时间",
      recentOrders: "订单历史",
      avgOrderValue: "平均订单金额",
    },
    products: {
      notFound: "未找到产品",
      backToProducts: "返回产品列表",
      recentOrders: "最近订单",
      inventoryHistory: "库存记录",
      margin: "利润率",
      selectedCount: "已选择 {count} 项",
      bulkDeleteConfirm: "删除选中的 {count} 个产品？",
      bulkDeleted: "已删除 {count} 个产品",
    },
    auth: {
      forgotPasswordTitle: "忘记密码？",
      forgotPasswordSubtitle: "输入您的邮箱，我们将发送重置链接",
      sendResetLink: "发送重置链接",
      sendingResetLink: "发送中...",
      resetLinkSent: "重置链接已发送",
      resetLinkSentDesc: "如果该邮箱对应的账户存在，重置链接已发送",
      backToLogin: "返回登录",
      resetPasswordTitle: "重置密码",
      resetPasswordSubtitle: "为您的账户设置新密码",
      newPassword: "新密码",
      confirmPassword: "确认密码",
      resetPasswordButton: "重置密码",
      resettingPassword: "重置中...",
      passwordResetSuccess: "密码重置成功，请重新登录。",
      passwordMismatch: "两次输入的密码不一致",
      passwordTooShort: "密码至少需要 8 个字符",
      invalidResetToken: "重置链接无效或已过期",
      resetError: "出现错误，请重试。",
    },
    csvImport: {
      importCsv: "导入 CSV",
      expectedFormat: "所需列：",
      emptyFile: "文件为空或没有数据行",
      missingColumns: "缺少必需列：{columns}",
      previewCount: "来自 {file} 的 {count} 行数据",
      moreRows: "...另有 {count} 行",
      importRows: "导入 {count} 行",
      importResult: "已导入 {imported} 条，跳过 {skipped} 条",
    },
  },
  ja: {
    orders: {
      notFound: "注文が見つかりません",
      backToOrders: "注文一覧に戻る",
    },
    customers: {
      notFound: "顧客が見つかりません",
      backToCustomers: "顧客一覧に戻る",
      memberSince: "登録日",
      recentOrders: "注文履歴",
      avgOrderValue: "平均注文額",
    },
    products: {
      notFound: "商品が見つかりません",
      backToProducts: "商品一覧に戻る",
      recentOrders: "最近の注文",
      inventoryHistory: "在庫履歴",
      margin: "利益率",
      selectedCount: "{count} 件選択中",
      bulkDeleteConfirm: "選択した {count} 件の商品を削除しますか？",
      bulkDeleted: "{count} 件の商品を削除しました",
    },
    auth: {
      forgotPasswordTitle: "パスワードをお忘れですか？",
      forgotPasswordSubtitle: "メールアドレスを入力すると、リセットリンクをお送りします",
      sendResetLink: "リセットリンクを送信",
      sendingResetLink: "送信中...",
      resetLinkSent: "リセットリンクを送信しました",
      resetLinkSentDesc: "該当するアカウントが存在する場合、リセットリンクが送信されました",
      backToLogin: "ログインに戻る",
      resetPasswordTitle: "パスワードのリセット",
      resetPasswordSubtitle: "新しいパスワードを設定してください",
      newPassword: "新しいパスワード",
      confirmPassword: "パスワードの確認",
      resetPasswordButton: "パスワードをリセット",
      resettingPassword: "リセット中...",
      passwordResetSuccess: "パスワードがリセットされました。再度ログインしてください。",
      passwordMismatch: "パスワードが一致しません",
      passwordTooShort: "パスワードは8文字以上で入力してください",
      invalidResetToken: "リセットリンクが無効または期限切れです",
      resetError: "エラーが発生しました。もう一度お試しください。",
    },
    csvImport: {
      importCsv: "CSV インポート",
      expectedFormat: "必要な列：",
      emptyFile: "ファイルが空、またはデータ行がありません",
      missingColumns: "必須列がありません：{columns}",
      previewCount: "{file} から {count} 行",
      moreRows: "...他 {count} 行",
      importRows: "{count} 行をインポート",
      importResult: "{imported} 件インポート、{skipped} 件スキップ",
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
