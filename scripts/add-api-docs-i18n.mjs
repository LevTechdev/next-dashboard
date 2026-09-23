/**
 * Adds `apiDocs.groups` (sidebar group labels) and `apiDocs.endpoints`
 * (per-endpoint description/param/field copy) to all 4 locales.
 *
 * Keys are derived from src/lib/api-docs-data.ts slugs; en mirrors the
 * English source copy in the data file, id/ja/zh carry translations.
 * Idempotent — re-running overwrites the same keys in place.
 *
 * Run: node scripts/add-api-docs-i18n.mjs
 */
import fs from "node:fs";

const LOCALES = ["en", "id", "ja", "zh"];
const BASE = "src/i18n/locales";

// ── Group labels ────────────────────────────────────────────────────────────
const GROUPS = {
  en: {
    Orders: "Orders",
    Products: "Products",
    Customers: "Customers",
    Dashboard: "Dashboard",
    Search: "Search",
    Notifications: "Notifications",
    Analytics: "Analytics",
    Authentication: "Authentication",
    Team: "Team",
    Billing: "Billing",
    Reports: "Reports",
    System: "System",
    Inventory: "Inventory",
    "API Sandbox": "API Sandbox",
  },
  id: {
    Orders: "Pesanan",
    Products: "Produk",
    Customers: "Pelanggan",
    Dashboard: "Dasbor",
    Search: "Pencarian",
    Notifications: "Notifikasi",
    Analytics: "Analitik",
    Authentication: "Autentikasi",
    Team: "Tim",
    Billing: "Penagihan",
    Reports: "Laporan",
    System: "Sistem",
    Inventory: "Inventaris",
    "API Sandbox": "API Sandbox",
  },
  ja: {
    Orders: "注文",
    Products: "商品",
    Customers: "顧客",
    Dashboard: "ダッシュボード",
    Search: "検索",
    Notifications: "通知",
    Analytics: "アナリティクス",
    Authentication: "認証",
    Team: "チーム",
    Billing: "請求",
    Reports: "レポート",
    System: "システム",
    Inventory: "在庫",
    "API Sandbox": "API Sandbox",
  },
  zh: {
    Orders: "订单",
    Products: "商品",
    Customers: "客户",
    Dashboard: "仪表盘",
    Search: "搜索",
    Notifications: "通知",
    Analytics: "分析",
    Authentication: "认证",
    Team: "团队",
    Billing: "账单",
    Reports: "报表",
    System: "系统",
    Inventory: "库存",
    "API Sandbox": "API Sandbox",
  },
};

// ── Endpoint copy per locale: description + params + fields ─────────────────
const ENDPOINTS = {
  en: {
    "orders-get": {
      description: "List all orders with customer and channel details",
      params: { status: "Filter by order status", limit: "Max results (default 100)" },
    },
    "orders-post": {
      description: "Create a new order",
      fields: {
        customerId: "Customer ID",
        items: "Array of { productId, quantity, price }",
        channel: "Sales channel name",
      },
    },
    "orders-put": {
      description: "Update order status",
      fields: {
        id: "Order ID",
        status: "New status (PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED)",
      },
    },
    "products-get": {
      description: "List all products with category info",
      params: { includeCategories: "Include category list (true/false)" },
    },
    "products-post": {
      description: "Create a new product",
      fields: {
        name: "Product name",
        price: "Price in cents",
        costPrice: "Cost price",
        stock: "Initial stock",
        sku: "SKU code",
        categoryId: "Category ID",
      },
    },
    "products-put": {
      description: "Update an existing product",
      fields: { id: "Product ID", name: "Updated name", price: "Updated price" },
    },
    "products-delete": { description: "Delete a product", fields: { id: "Product ID to delete" } },
    "customers-get": { description: "List all customers with order counts and spending" },
    "customers-post": {
      description: "Create a new customer",
      fields: {
        name: "Customer name",
        email: "Email address",
        phone: "Phone number",
        city: "City",
        segment: "Customer segment",
      },
    },
    "dashboard-get": {
      description:
        "Get dashboard stats, revenue data, sales channels, recent orders, and top products",
    },
    "search-get": {
      description: "Global search across orders, customers, and products",
      params: { q: "Search query (min 2 chars)" },
    },
    "notifications-get": {
      description: "List notifications with unread counts",
      params: {
        type: "Filter by type",
        read: "Filter by read status (true/false)",
        limit: "Max results",
      },
    },
    "notifications-put": {
      description: "Mark notification as read/unread",
      fields: { id: "Notification ID", action: "mark-read or mark-unread" },
    },
    "analytics-get": { description: "Get analytics data including trends and breakdowns" },
    "auth-login-post": {
      description: "Authenticate user and create session",
      fields: { email: "User email", password: "User password" },
    },
    "auth-register-post": {
      description: "Create a new user account",
      fields: { name: "Full name", email: "Email", password: "Password (min 8 chars)" },
    },
    "team-get": { description: "List team members and pending invitations" },
    "team-post": {
      description: "Invite a new team member",
      fields: { email: "Invitee email", role: "Role (ADMIN, MANAGER, STAFF, VIEWER)" },
    },
    "billing-get": { description: "Get current subscription plan and billing info" },
    "reports-get": {
      description: "Get report data with date range filtering",
      params: {
        from: "Start date (YYYY-MM-DD)",
        to: "End date (YYYY-MM-DD)",
        period: "daily, weekly, or monthly",
      },
    },
    "health-get": { description: "Health check endpoint" },
    "inventory-get": { description: "Get inventory levels and stock alerts" },
    "v1-ping-get": {
      description:
        "Smoke-test an API key — verifies it exists, is active, unexpired, and within the sandbox rate limit",
    },
    "v1-me-get": { description: "Key metadata plus the user and workspace the key acts for" },
    "v1-products-get": {
      description: "List products in the key's workspace (paginated)",
      params: {
        limit: "Results per page, 1–100 (default 20)",
        page: "Page number (default 1)",
        active: "Filter by active state (true/false)",
      },
    },
    "v1-products-id-get": { description: "A single product from the key's workspace" },
    "v1-orders-get": {
      description: "List orders in the key's workspace with customer and channel info (paginated)",
      params: {
        status: "PENDING, PROCESSING, SHIPPED, DELIVERED or CANCELLED",
        paymentStatus: "UNPAID, PAID or REFUNDED",
        limit: "Results per page, 1–100 (default 20)",
        page: "Page number (default 1)",
      },
    },
    "v1-orders-id-get": { description: "A single order with line items, from the key's workspace" },
    "v1-customers-get": {
      description: "List customers in the key's workspace with spending totals (paginated)",
      params: {
        segment: "Filter by segment (VIP, REGULAR, NEW)",
        limit: "Results per page, 1–100 (default 20)",
        page: "Page number (default 1)",
      },
    },
    "v1-customers-id-get": { description: "A single customer from the key's workspace" },
  },
  id: {
    "orders-get": {
      description: "Menampilkan semua pesanan dengan detail pelanggan dan kanal",
      params: {
        status: "Filter berdasarkan status pesanan",
        limit: "Jumlah hasil maksimum (default 100)",
      },
    },
    "orders-post": {
      description: "Membuat pesanan baru",
      fields: {
        customerId: "ID pelanggan",
        items: "Array { productId, quantity, price }",
        channel: "Nama kanal penjualan",
      },
    },
    "orders-put": {
      description: "Memperbarui status pesanan",
      fields: {
        id: "ID pesanan",
        status: "Status baru (PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED)",
      },
    },
    "products-get": {
      description: "Menampilkan semua produk dengan info kategori",
      params: { includeCategories: "Sertakan daftar kategori (true/false)" },
    },
    "products-post": {
      description: "Membuat produk baru",
      fields: {
        name: "Nama produk",
        price: "Harga dalam sen",
        costPrice: "Harga pokok",
        stock: "Stok awal",
        sku: "Kode SKU",
        categoryId: "ID kategori",
      },
    },
    "products-put": {
      description: "Memperbarui produk yang ada",
      fields: { id: "ID produk", name: "Nama baru", price: "Harga baru" },
    },
    "products-delete": {
      description: "Menghapus produk",
      fields: { id: "ID produk yang akan dihapus" },
    },
    "customers-get": {
      description: "Menampilkan semua pelanggan dengan jumlah pesanan dan pengeluaran",
    },
    "customers-post": {
      description: "Membuat pelanggan baru",
      fields: {
        name: "Nama pelanggan",
        email: "Alamat email",
        phone: "Nomor telepon",
        city: "Kota",
        segment: "Segmen pelanggan",
      },
    },
    "dashboard-get": {
      description:
        "Mendapatkan statistik dasbor, data pendapatan, kanal penjualan, pesanan terbaru, dan produk teratas",
    },
    "search-get": {
      description: "Pencarian global di seluruh pesanan, pelanggan, dan produk",
      params: { q: "Kueri pencarian (min 2 karakter)" },
    },
    "notifications-get": {
      description: "Menampilkan notifikasi dengan jumlah belum dibaca",
      params: {
        type: "Filter berdasarkan jenis",
        read: "Filter berdasarkan status baca (true/false)",
        limit: "Jumlah hasil maksimum",
      },
    },
    "notifications-put": {
      description: "Menandai notifikasi sebagai dibaca/belum dibaca",
      fields: { id: "ID notifikasi", action: "mark-read atau mark-unread" },
    },
    "analytics-get": { description: "Mendapatkan data analitik termasuk tren dan rincian" },
    "auth-login-post": {
      description: "Autentikasi pengguna dan buat sesi",
      fields: { email: "Email pengguna", password: "Kata sandi pengguna" },
    },
    "auth-register-post": {
      description: "Membuat akun pengguna baru",
      fields: { name: "Nama lengkap", email: "Email", password: "Kata sandi (min 8 karakter)" },
    },
    "team-get": { description: "Menampilkan anggota tim dan undangan tertunda" },
    "team-post": {
      description: "Mengundang anggota tim baru",
      fields: { email: "Email penerima undangan", role: "Peran (ADMIN, MANAGER, STAFF, VIEWER)" },
    },
    "billing-get": { description: "Mendapatkan paket langganan saat ini dan info penagihan" },
    "reports-get": {
      description: "Mendapatkan data laporan dengan filter rentang tanggal",
      params: {
        from: "Tanggal mulai (YYYY-MM-DD)",
        to: "Tanggal akhir (YYYY-MM-DD)",
        period: "harian, mingguan, atau bulanan",
      },
    },
    "health-get": { description: "Endpoint pemeriksaan kesehatan" },
    "inventory-get": { description: "Mendapatkan tingkat inventaris dan peringatan stok" },
    "v1-ping-get": {
      description:
        "Uji coba kunci API — memastikan kunci ada, aktif, tidak kedaluwarsa, dan dalam batas laju sandbox",
    },
    "v1-me-get": {
      description: "Metadata kunci serta pengguna dan ruang kerja tempat kunci berlaku",
    },
    "v1-products-get": {
      description: "Menampilkan produk di ruang kerja kunci (dipaginasi)",
      params: {
        limit: "Hasil per halaman, 1–100 (default 20)",
        page: "Nomor halaman (default 1)",
        active: "Filter status aktif (true/false)",
      },
    },
    "v1-products-id-get": { description: "Satu produk dari ruang kerja kunci" },
    "v1-orders-get": {
      description:
        "Menampilkan pesanan di ruang kerja kunci dengan info pelanggan dan kanal (dipaginasi)",
      params: {
        status: "PENDING, PROCESSING, SHIPPED, DELIVERED atau CANCELLED",
        paymentStatus: "UNPAID, PAID, atau REFUNDED",
        limit: "Hasil per halaman, 1–100 (default 20)",
        page: "Nomor halaman (default 1)",
      },
    },
    "v1-orders-id-get": { description: "Satu pesanan dengan item baris, dari ruang kerja kunci" },
    "v1-customers-get": {
      description:
        "Menampilkan pelanggan di ruang kerja kunci dengan total pengeluaran (dipaginasi)",
      params: {
        segment: "Filter berdasarkan segmen (VIP, REGULAR, NEW)",
        limit: "Hasil per halaman, 1–100 (default 20)",
        page: "Nomor halaman (default 1)",
      },
    },
    "v1-customers-id-get": { description: "Satu pelanggan dari ruang kerja kunci" },
  },
  ja: {
    "orders-get": {
      description: "顧客とチャネルの詳細を含むすべての注文を一覧表示",
      params: { status: "注文ステータスで絞り込み", limit: "最大件数（デフォルト100）" },
    },
    "orders-post": {
      description: "新しい注文を作成",
      fields: {
        customerId: "顧客ID",
        items: "{ productId, quantity, price } の配列",
        channel: "販売チャネル名",
      },
    },
    "orders-put": {
      description: "注文ステータスを更新",
      fields: {
        id: "注文ID",
        status: "新しいステータス（PENDING、PROCESSING、SHIPPED、DELIVERED、CANCELLED）",
      },
    },
    "products-get": {
      description: "カテゴリ情報を含むすべての商品を一覧表示",
      params: { includeCategories: "カテゴリ一覧を含める (true/false)" },
    },
    "products-post": {
      description: "新しい商品を作成",
      fields: {
        name: "商品名",
        price: "価格（セント）",
        costPrice: "原価",
        stock: "初期在庫",
        sku: "SKUコード",
        categoryId: "カテゴリID",
      },
    },
    "products-put": {
      description: "既存の商品を更新",
      fields: { id: "商品ID", name: "更新後の名前", price: "更新後の価格" },
    },
    "products-delete": { description: "商品を削除", fields: { id: "削除する商品ID" } },
    "customers-get": { description: "注文数と支出を含むすべての顧客を一覧表示" },
    "customers-post": {
      description: "新しい顧客を作成",
      fields: {
        name: "顧客名",
        email: "メールアドレス",
        phone: "電話番号",
        city: "都市",
        segment: "顧客セグメント",
      },
    },
    "dashboard-get": {
      description: "ダッシュボードの統計、売上データ、販売チャネル、最近の注文、人気商品を取得",
    },
    "search-get": {
      description: "注文・顧客・商品を横断するグローバル検索",
      params: { q: "検索クエリ（2文字以上）" },
    },
    "notifications-get": {
      description: "未読数を含む通知を一覧表示",
      params: {
        type: "種類で絞り込み",
        read: "既読状態で絞り込み (true/false)",
        limit: "最大件数",
      },
    },
    "notifications-put": {
      description: "通知を既読/未読にする",
      fields: { id: "通知ID", action: "mark-read または mark-unread" },
    },
    "analytics-get": { description: "トレンドや内訳を含むアナリティクスデータを取得" },
    "auth-login-post": {
      description: "ユーザーを認証してセッションを作成",
      fields: { email: "ユーザーのメール", password: "ユーザーのパスワード" },
    },
    "auth-register-post": {
      description: "新しいユーザーアカウントを作成",
      fields: { name: "氏名", email: "メール", password: "パスワード（8文字以上）" },
    },
    "team-get": { description: "チームメンバーと保留中の招待を一覧表示" },
    "team-post": {
      description: "新しいチームメンバーを招待",
      fields: { email: "招待先のメール", role: "ロール（ADMIN、MANAGER、STAFF、VIEWER）" },
    },
    "billing-get": { description: "現在のサブスクリプションプランと請求情報を取得" },
    "reports-get": {
      description: "日付範囲フィルター付きレポートデータを取得",
      params: {
        from: "開始日 (YYYY-MM-DD)",
        to: "終了日 (YYYY-MM-DD)",
        period: "daily、weekly、monthly のいずれか",
      },
    },
    "health-get": { description: "ヘルスチェックエンドポイント" },
    "inventory-get": { description: "在庫レベルと在庫アラートを取得" },
    "v1-ping-get": {
      description:
        "APIキーのスモークテスト — キーの存在、有効化、有効期限、サンドボックスレート制限内であることを検証",
    },
    "v1-me-get": {
      description: "キーのメタデータ、およびキーが操作対象とするユーザーとワークスペース",
    },
    "v1-products-get": {
      description: "キーのワークスペース内の商品を一覧表示（ページネーション）",
      params: {
        limit: "1ページの件数、1〜100（デフォルト20）",
        page: "ページ番号（デフォルト1）",
        active: "アクティブ状態で絞り込み (true/false)",
      },
    },
    "v1-products-id-get": { description: "キーのワークスペースから単一の商品を取得" },
    "v1-orders-get": {
      description:
        "キーのワークスペース内の注文を顧客・チャネル情報付きで一覧表示（ページネーション）",
      params: {
        status: "PENDING、PROCESSING、SHIPPED、DELIVERED、CANCELLED のいずれか",
        paymentStatus: "UNPAID、PAID、REFUNDED のいずれか",
        limit: "1ページの件数、1〜100（デフォルト20）",
        page: "ページ番号（デフォルト1）",
      },
    },
    "v1-orders-id-get": { description: "キーのワークスペースから、明細行を含む単一の注文を取得" },
    "v1-customers-get": {
      description: "キーのワークスペース内の顧客を支出合計付きで一覧表示（ページネーション）",
      params: {
        segment: "セグメントで絞り込み（VIP、REGULAR、NEW）",
        limit: "1ページの件数、1〜100（デフォルト20）",
        page: "ページ番号（デフォルト1）",
      },
    },
    "v1-customers-id-get": { description: "キーのワークスペースから単一の顧客を取得" },
  },
  zh: {
    "orders-get": {
      description: "列出所有订单及其客户与渠道详情",
      params: { status: "按订单状态筛选", limit: "最大返回条数（默认 100）" },
    },
    "orders-post": {
      description: "创建新订单",
      fields: {
        customerId: "客户 ID",
        items: "{ productId, quantity, price } 数组",
        channel: "销售渠道名称",
      },
    },
    "orders-put": {
      description: "更新订单状态",
      fields: {
        id: "订单 ID",
        status: "新状态（PENDING、PROCESSING、SHIPPED、DELIVERED、CANCELLED）",
      },
    },
    "products-get": {
      description: "列出所有商品及其分类信息",
      params: { includeCategories: "是否包含分类列表 (true/false)" },
    },
    "products-post": {
      description: "创建新商品",
      fields: {
        name: "商品名称",
        price: "价格（分）",
        costPrice: "成本价",
        stock: "初始库存",
        sku: "SKU 编码",
        categoryId: "分类 ID",
      },
    },
    "products-put": {
      description: "更新已有商品",
      fields: { id: "商品 ID", name: "新名称", price: "新价格" },
    },
    "products-delete": { description: "删除商品", fields: { id: "要删除的商品 ID" } },
    "customers-get": { description: "列出所有客户及其订单数与消费金额" },
    "customers-post": {
      description: "创建新客户",
      fields: {
        name: "客户名称",
        email: "电子邮箱",
        phone: "电话号码",
        city: "城市",
        segment: "客户分层",
      },
    },
    "dashboard-get": { description: "获取仪表盘统计、收入数据、销售渠道、最近订单与热销商品" },
    "search-get": {
      description: "跨订单、客户与商品的全局搜索",
      params: { q: "搜索关键词（至少 2 个字符）" },
    },
    "notifications-get": {
      description: "列出通知及未读数量",
      params: { type: "按类型筛选", read: "按已读状态筛选 (true/false)", limit: "最大返回条数" },
    },
    "notifications-put": {
      description: "将通知标记为已读/未读",
      fields: { id: "通知 ID", action: "mark-read 或 mark-unread" },
    },
    "analytics-get": { description: "获取包含趋势与细分维度的分析数据" },
    "auth-login-post": {
      description: "验证用户身份并创建会话",
      fields: { email: "用户邮箱", password: "用户密码" },
    },
    "auth-register-post": {
      description: "创建新用户账号",
      fields: { name: "姓名", email: "邮箱", password: "密码（至少 8 位）" },
    },
    "team-get": { description: "列出团队成员与待处理邀请" },
    "team-post": {
      description: "邀请新的团队成员",
      fields: { email: "被邀请人邮箱", role: "角色（ADMIN、MANAGER、STAFF、VIEWER）" },
    },
    "billing-get": { description: "获取当前订阅套餐与账单信息" },
    "reports-get": {
      description: "获取支持日期范围筛选的报表数据",
      params: {
        from: "开始日期 (YYYY-MM-DD)",
        to: "结束日期 (YYYY-MM-DD)",
        period: "daily、weekly 或 monthly",
      },
    },
    "health-get": { description: "健康检查端点" },
    "inventory-get": { description: "获取库存水平与库存预警" },
    "v1-ping-get": {
      description: "API 密钥冒烟测试 — 校验密钥存在、处于启用状态、未过期且在沙箱限流范围内",
    },
    "v1-me-get": { description: "密钥元数据，以及该密钥所属的用户与工作区" },
    "v1-products-get": {
      description: "列出密钥工作区内的商品（分页）",
      params: {
        limit: "每页条数，1–100（默认 20）",
        page: "页码（默认 1）",
        active: "按启用状态筛选 (true/false)",
      },
    },
    "v1-products-id-get": { description: "获取密钥工作区中的单个商品" },
    "v1-orders-get": {
      description: "列出密钥工作区内的订单，含客户与渠道信息（分页）",
      params: {
        status: "PENDING、PROCESSING、SHIPPED、DELIVERED 或 CANCELLED",
        paymentStatus: "UNPAID、PAID 或 REFUNDED",
        limit: "每页条数，1–100（默认 20）",
        page: "页码（默认 1）",
      },
    },
    "v1-orders-id-get": { description: "获取密钥工作区中含明细行的单个订单" },
    "v1-customers-get": {
      description: "列出密钥工作区内的客户及其消费总额（分页）",
      params: {
        segment: "按分层筛选（VIP、REGULAR、NEW）",
        limit: "每页条数，1–100（默认 20）",
        page: "页码（默认 1）",
      },
    },
    "v1-customers-id-get": { description: "获取密钥工作区中的单个客户" },
  },
};

for (const locale of LOCALES) {
  const file = `${BASE}/${locale}.json`;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.apiDocs = data.apiDocs || {};
  data.apiDocs.groups = GROUPS[locale];
  // Convert { description, params, fields } dicts to plain nested objects.
  data.apiDocs.endpoints = Object.fromEntries(
    Object.entries(ENDPOINTS[locale]).map(([slug, entry]) => [slug, { ...entry }]),
  );
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(
    `${locale}: apiDocs.groups (${Object.keys(GROUPS[locale]).length}) + apiDocs.endpoints (${Object.keys(ENDPOINTS[locale]).length}) written`,
  );
}
