/**
 * One-shot merge of the AI copilot namespace into all 4 locale files.
 * Only adds keys that do not already exist (never overwrites).
 * Usage: node scripts/add-ai-i18n.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  en: {
    ai: {
      title: "Analytics Copilot",
      subtitle: "Ask anything about your business",
      thinking: "Thinking...",
      stop: "Stop",
      tools: {
        getDashboardStats: "Dashboard stats",
        getRecentOrders: "Recent orders",
        getTopProducts: "Top products",
        getSalesByChannel: "Sales by channel",
        getRevenueData: "Revenue data",
        searchBusiness: "Business search",
        getCustomerDetails: "Customer details",
        getOrderDetails: "Order details",
      },
      clearConversation: "Clear conversation",
      greeting: "How can I help you?",
      greetingDesc:
        "Ask about your revenue, orders, customers, products, or get insights about your business.",
      tryAsking: "Try asking",
      placeholder: "Ask about your business...",
      stopGenerating: "Stop generating",
      disclaimer: "Responses are AI-generated and may not reflect real-time data exactly.",
      errorFallback: "An error occurred. Please try again.",
      errorContent: "Sorry, an error occurred. Please try again.",
      rateLimitFallback: "The AI service is temporarily rate-limited (free-tier quota reached).",
      rateLimitRetryIn: "Try again in about {seconds} seconds.",
      rateLimitContent:
        "The AI service is rate-limited right now. Give it a minute and try your question again.",
      rateLimitRetryingIn: "Retrying automatically in {seconds}s…",
      rateLimitRetryNow: "Try again now",
      rateLimitWhyTitle: "Why is this happening?",
      rateLimitWhyBody:
        "The AI provider's free tier allows only a limited number of requests per day per model. When that daily budget runs out, the provider answers with a “rate limited” (429) response instead of generating a reply. The countdown waits for the provider's suggested window, then your question is re-sent automatically — or you can retry now manually.",
      openCopilot: "Open AI Copilot",
      closeCopilot: "Close AI Copilot",
      q1Label: "What's my total revenue?",
      q1Query: "What's my current total revenue and how is it trending?",
      q2Label: "Top selling products",
      q2Query: "Show me my top 5 best selling products",
      q3Label: "Recent orders",
      q3Query: "Show me my most recent orders",
      q4Label: "Customer insights",
      q4Query: "How many customers do I have and what are they worth?",
      q5Label: "Sales by channel",
      q5Query: "How are my sales distributed across channels?",
      q6Label: "Business insights",
      q6Query: "Give me some key insights about my business performance",
    },
  },
  id: {
    ai: {
      title: "Analytics Copilot",
      subtitle: "Tanyakan apa saja tentang bisnis Anda",
      thinking: "Berpikir...",
      stop: "Berhenti",
      tools: {
        getDashboardStats: "Statistik dasbor",
        getRecentOrders: "Pesanan terbaru",
        getTopProducts: "Produk terlaris",
        getSalesByChannel: "Penjualan per saluran",
        getRevenueData: "Data pendapatan",
        searchBusiness: "Pencarian bisnis",
        getCustomerDetails: "Detail pelanggan",
        getOrderDetails: "Detail pesanan",
      },
      clearConversation: "Bersihkan percakapan",
      greeting: "Ada yang bisa saya bantu?",
      greetingDesc:
        "Tanyakan tentang pendapatan, pesanan, pelanggan, produk, atau dapatkan wawasan tentang bisnis Anda.",
      tryAsking: "Coba tanyakan",
      placeholder: "Tanyakan tentang bisnis Anda...",
      stopGenerating: "Hentikan pembuatan",
      disclaimer:
        "Respons dibuat oleh AI dan mungkin tidak mencerminkan data waktu nyata secara persis.",
      errorFallback: "Terjadi kesalahan. Silakan coba lagi.",
      errorContent: "Maaf, terjadi kesalahan. Silakan coba lagi.",
      rateLimitFallback:
        "Layanan AI untuk sementara dibatasi kecepatannya (kuota gratis tercapai).",
      rateLimitRetryIn: "Coba lagi dalam sekitar {seconds} detik.",
      rateLimitContent:
        "Layanan AI sedang dibatasi kecepatannya. Tunggu sebentar lalu coba lagi pertanyaan Anda.",
      rateLimitRetryingIn: "Mencoba ulang otomatis dalam {seconds} dtk…",
      rateLimitRetryNow: "Coba lagi sekarang",
      rateLimitWhyTitle: "Mengapa ini terjadi?",
      rateLimitWhyBody:
        "Kuota gratis penyedia AI hanya mengizinkan sejumlah permintaan per hari per model. Saat anggaran harian habis, penyedia menjawab dengan respons “dibatasi kecepatannya” (429) alih-alih menghasilkan jawaban. Hitung mundur menunggu jendela yang disarankan penyedia, lalu pertanyaan Anda dikirim ulang otomatis — atau Anda dapat mencoba lagi secara manual.",
      openCopilot: "Buka AI Copilot",
      closeCopilot: "Tutup AI Copilot",
      q1Label: "Berapa total pendapatan saya?",
      q1Query: "Berapa total pendapatan saya saat ini dan bagaimana trennya?",
      q2Label: "Produk terlaris",
      q2Query: "Tampilkan 5 produk terlaris saya",
      q3Label: "Pesanan terbaru",
      q3Query: "Tampilkan pesanan terbaru saya",
      q4Label: "Wawasan pelanggan",
      q4Query: "Berapa banyak pelanggan saya dan berapa nilainya?",
      q5Label: "Penjualan per saluran",
      q5Query: "Bagaimana penjualan saya tersebar di berbagai saluran?",
      q6Label: "Wawasan bisnis",
      q6Query: "Berikan beberapa wawasan utama tentang kinerja bisnis saya",
    },
  },
  ja: {
    ai: {
      title: "Analytics Copilot",
      subtitle: "ビジネスについて何でも質問できます",
      thinking: "考え中...",
      stop: "停止",
      tools: {
        getDashboardStats: "ダッシュボード統計",
        getRecentOrders: "最近の注文",
        getTopProducts: "人気商品",
        getSalesByChannel: "チャネル別売上",
        getRevenueData: "収益データ",
        searchBusiness: "ビジネス検索",
        getCustomerDetails: "顧客詳細",
        getOrderDetails: "注文詳細",
      },
      clearConversation: "会話をクリア",
      greeting: "何かお手伝いできますか？",
      greetingDesc:
        "売上、注文、顧客、商品について質問したり、ビジネスに関するインサイトを得ることができます。",
      tryAsking: "試しに聞いてみる",
      placeholder: "ビジネスについて質問...",
      stopGenerating: "生成を停止",
      disclaimer:
        "回答はAIによって生成され、リアルタイムのデータと完全に一致しない場合があります。",
      errorFallback: "エラーが発生しました。もう一度お試しください。",
      errorContent: "申し訳ありません。エラーが発生しました。もう一度お試しください。",
      rateLimitFallback:
        "AIサービスは一時的にレート制限されています（無料枠のクォータに達しました）。",
      rateLimitRetryIn: "約{seconds}秒後にもう一度お試しください。",
      rateLimitContent:
        "AIサービスがレート制限されています。少し待ってからもう一度お尋ねください。",
      rateLimitRetryingIn: "{seconds}秒後に自動再試行します…",
      rateLimitRetryNow: "今すぐ再試行",
      rateLimitWhyTitle: "なぜこれが起きるのですか？",
      rateLimitWhyBody:
        "AIプロバイダーの無料枠では、モデルごとに1日あたりのリクエスト数が制限されています。日ごとの上限に達すると、プロバイダーは回答を生成せず「レート制限（429）」で応答します。カウントダウンはプロバイダーが推奨する時間を待ち、その後質問が自動的に再送信されます。手動で今すぐ再試行することもできます。",
      openCopilot: "AI Copilotを開く",
      closeCopilot: "AI Copilotを閉じる",
      q1Label: "私の総収益は？",
      q1Query: "現在の総収益とその推移を教えてください",
      q2Label: "売れ筋商品",
      q2Query: "売れ筋トップ5の商品を表示してください",
      q3Label: "最近の注文",
      q3Query: "最近の注文を表示してください",
      q4Label: "顧客インサイト",
      q4Query: "顧客は何人いて、その価値はどのくらいですか？",
      q5Label: "チャネル別売上",
      q5Query: "売上はチャネルごとにどのように分布していますか？",
      q6Label: "ビジネスインサイト",
      q6Query: "ビジネスパフォーマンスに関する主なインサイトを教えてください",
    },
  },
  zh: {
    ai: {
      title: "Analytics Copilot",
      subtitle: "询问任何关于您业务的问题",
      thinking: "思考中...",
      stop: "停止",
      tools: {
        getDashboardStats: "仪表盘统计",
        getRecentOrders: "最近订单",
        getTopProducts: "畅销产品",
        getSalesByChannel: "各渠道销售",
        getRevenueData: "收入数据",
        searchBusiness: "业务搜索",
        getCustomerDetails: "客户详情",
        getOrderDetails: "订单详情",
      },
      clearConversation: "清空对话",
      greeting: "有什么可以帮您？",
      greetingDesc: "询问收入、订单、客户、产品相关问题，或获取业务洞察。",
      tryAsking: "试试问",
      placeholder: "询问您的业务...",
      stopGenerating: "停止生成",
      disclaimer: "回答由 AI 生成，可能与实时数据不完全一致。",
      errorFallback: "处理请求时出错，请重试。",
      errorContent: "抱歉，出错了，请重试。",
      rateLimitFallback: "AI 服务暂时受到速率限制（已达到免费配额）。",
      rateLimitRetryIn: "大约 {seconds} 秒后重试。",
      rateLimitContent: "AI 服务当前受到速率限制。请稍等片刻后重试您的问题。",
      rateLimitRetryingIn: "将在 {seconds} 秒后自动重试…",
      rateLimitRetryNow: "立即重试",
      rateLimitWhyTitle: "为什么会这样？",
      rateLimitWhyBody:
        "AI 提供商的免费层级限制每个模型每天可处理的请求数量。当每日预算用尽时，提供商不会生成回复，而是返回“速率受限”(429) 响应。倒计时会等待提供商建议的时间窗口，随后自动重新发送您的问题——您也可以手动立即重试。",
      openCopilot: "打开 AI Copilot",
      closeCopilot: "关闭 AI Copilot",
      q1Label: "我的总收入是多少？",
      q1Query: "我当前的总收入是多少？趋势如何？",
      q2Label: "畅销产品",
      q2Query: "显示我销量前 5 的产品",
      q3Label: "最近订单",
      q3Query: "显示我最近的订单",
      q4Label: "客户洞察",
      q4Query: "我有多少客户？他们的价值是多少？",
      q5Label: "各渠道销售",
      q5Query: "我的销售在各渠道的分布情况如何？",
      q6Label: "业务洞察",
      q6Query: "给我一些关于业务表现的关键洞察",
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
