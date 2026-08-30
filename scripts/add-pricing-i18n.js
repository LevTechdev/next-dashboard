/**
 * One-shot merge of the pricing namespace (and 4 orders keys) that were missing
 * from the ja and zh locale files — discovered by the locales-parity test.
 * Only adds keys that do not already exist (never overwrites).
 * Usage: node scripts/add-pricing-i18n.js
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");

const KEYS = {
  ja: {
    orders: {
      totalOrders: "注文総数",
      totalRevenue: "総売上",
      pending: "保留中",
      avgOrder: "平均注文額",
    },
    pricing: {
      badge: "シンプルな料金体系",
      title: "料金プラン",
      subtitle:
        "ビジネスに最適なプランをお選びください。隠れた料金もサプライズもありません。14日間の無料トライアルから始めましょう。",
      monthly: "月払い",
      yearly: "年払い",
      savePercent: "20%お得",
      billedMonthly: "毎月請求",
      billedYearly: "毎年請求",
      includes: "含まれるもの",
      cta: "無料トライアルを開始",
      ctaContact: "営業に問い合わせ",
      popular: "一番人気",
      compareTitle: "プランを比較",
      compareSubtitle: "すべてのプランに14日間の無料トライアルが含まれます。クレジットカードは不要です。",
      faqTitle: "よくある質問",
      faqQ1: "プランはいつでもアップグレード・ダウングレードできますか？",
      faqA1:
        "はい、いつでもプランを変更できます。アップグレード時は日割り差額が請求され、ダウングレード時は次の請求サイクル開始時に新しい料金が適用されます。",
      faqQ2: "無料トライアルはありますか？",
      faqA2:
        "はい！すべてのプランに14日間の無料トライアルが付いています。クレジットカードは不要です。トライアル期間中に選択したプランの全機能をお試しいただけます。",
      faqQ3: "対応している支払い方法は？",
      faqA3:
        "主要なクレジットカード、PayPal、年間プランの銀行振込に対応しています。すべての支払いはStripeを通じて安全に処理されます。",
      faqQ4: "サブスクリプションを解約できますか？",
      faqA4: "はい、いつでも解約できます。現在の請求期間の終了までアクセスは継続されます。",
      trustBusinesses: "導入企業数",
      trustOrders: "処理済み注文数",
      trustUsers: "アクティブユーザー数",
      trustCountries: "対応国",
      bottomTitle: "どのプランかお迷いですか？",
      bottomSubtitle: "どのプランでも14日間の無料トライアルから始められます。クレジットカードは不要です。",
      bottomButton: "ダッシュボードへ",
      featureOrders: "注文/月",
      featureTeam: "チームメンバー",
      featureAnalytics: "基本の分析ダッシュボード",
      featureExport: "CSVエクスポート",
      featureSupport: "メールサポート",
      featureMultiChannel: "マルチチャネル注文",
      featureReports: "高度なレポート",
      featureRbac: "ロールベースのアクセス",
      featureApi: "APIアクセス",
      featureAdvancedAnalytics: "高度な分析とチャート",
      featurePrioritySupport: "優先メール・チャットサポート",
      featureReportsInsights: "高度なレポートとインサイト",
      featureRbacAll: "ロールベースのアクセス（管理者/マネージャー/スタッフ）",
      featureUnlimited: "無制限",
      featureTeamUnlimited: "無制限のチームメンバー",
      featureCustomExports: "カスタムエクスポート",
      featureDedicatedSupport: "24時間365日の専任サポート",
      featureAllRoles: "ロールベースのアクセス（全ロール）",
      featureFullApi: "フルAPIアクセスとウェブフック",
      planStarter: "スターター",
      planProfessional: "プロフェッショナル",
      planEnterprise: "エンタープライズ",
      descStarter: "始めたばかりの小規模ビジネスに最適。",
      descProfessional: "複数チャネルで成長中のビジネスに最適。",
      descEnterprise: "高度なニーズを持つ大規模組織向け。",
      perMonth: "/月",
      perYear: "/年",
      starterOrders: "最大500",
      starterTeam: "3",
      proOrders: "最大5,000",
      proTeam: "10",
      enterpriseOrders: "無制限",
      enterpriseTeam: "無制限",
    },
  },
  zh: {
    orders: {
      totalOrders: "订单总数",
      totalRevenue: "总收入",
      pending: "待处理",
      avgOrder: "平均订单",
    },
    pricing: {
      badge: "简单的定价",
      title: "定价方案",
      subtitle:
        "为您的业务选择最合适的方案。无隐藏费用，无意外收费。从 14 天免费试用开始。",
      monthly: "按月",
      yearly: "按年",
      savePercent: "节省 20%",
      billedMonthly: "按月计费",
      billedYearly: "按年计费",
      includes: "包含",
      cta: "开始免费试用",
      ctaContact: "联系销售",
      popular: "最受欢迎",
      compareTitle: "比较方案",
      compareSubtitle: "每个方案都包含 14 天免费试用，无需信用卡。",
      faqTitle: "常见问题",
      faqQ1: "我可以随时升级或降级方案吗？",
      faqA1:
        "可以，您可以随时更改方案。升级时按比例收取差额费用；降级时，新费率将在下一个计费周期开始时生效。",
      faqQ2: "有免费试用吗？",
      faqA2:
        "有！所有方案都附带 14 天免费试用，无需信用卡。试用期间可以体验所选方案的全部功能。",
      faqQ3: "你们接受哪些支付方式？",
      faqA3:
        "我们接受所有主流信用卡、PayPal 以及年度方案的银行转账。所有支付均通过 Stripe 安全处理。",
      faqQ4: "我可以取消订阅吗？",
      faqA4: "可以，您可以随时取消。在当前计费周期结束前，您的访问权限仍然有效。",
      trustBusinesses: "服务企业数",
      trustOrders: "处理订单数",
      trustUsers: "活跃用户数",
      trustCountries: "覆盖国家",
      bottomTitle: "不确定选哪个方案？",
      bottomSubtitle: "任何方案均可从 14 天免费试用开始，无需信用卡。",
      bottomButton: "前往仪表盘",
      featureOrders: "订单/月",
      featureTeam: "团队成员",
      featureAnalytics: "基础分析仪表盘",
      featureExport: "CSV 导出",
      featureSupport: "邮件支持",
      featureMultiChannel: "多渠道订单",
      featureReports: "高级报表",
      featureRbac: "基于角色的访问",
      featureApi: "API 访问",
      featureAdvancedAnalytics: "高级分析与图表",
      featurePrioritySupport: "优先邮件和聊天支持",
      featureReportsInsights: "高级报表与洞察",
      featureRbacAll: "基于角色的访问（管理员/经理/员工）",
      featureUnlimited: "无限制",
      featureTeamUnlimited: "无限制的团队成员",
      featureCustomExports: "自定义导出",
      featureDedicatedSupport: "7×24 小时专属支持",
      featureAllRoles: "基于角色的访问（所有角色）",
      featureFullApi: "完整 API 访问与 Webhook",
      planStarter: "入门版",
      planProfessional: "专业版",
      planEnterprise: "企业版",
      descStarter: "适合刚开始创业的小型企业。",
      descProfessional: "适合多渠道发展的成长型企业。",
      descEnterprise: "适合有高级需求的大型组织。",
      perMonth: "/月",
      perYear: "/年",
      starterOrders: "最高 500",
      starterTeam: "3",
      proOrders: "最高 5,000",
      proTeam: "10",
      enterpriseOrders: "无限制",
      enterpriseTeam: "无限制",
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
