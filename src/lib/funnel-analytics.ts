/**
 * Funnel Conversion Intelligence & Sankey Analytics Engine
 * Calculates multi-stage user progression, leakage rates, channel flows, and AI bottleneck diagnostics.
 */

export interface FunnelStage {
  id: string;
  name: string;
  count: number;
  conversionRate: number; // % converted from previous stage
  overallRate: number; // % converted from stage 0 (Impressions)
  dropoffCount: number;
  dropoffRate: number;
  avgDurationSec: number;
  valueEstimate: number;
}

export interface SankeyNode {
  id: string;
  name: string;
  category: "channel" | "stage" | "outcome";
  value: number;
  color: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color?: string;
}

export interface FunnelLeakageAlert {
  id: string;
  stageId: string;
  stageName: string;
  dropoffRate: number;
  severity: "critical" | "warning" | "optimal";
  insightKey: string;
  recommendationKey: string;
  potentialRevenueRecovery: number;
}

export interface DeviceBreakdown {
  device: "all" | "mobile" | "desktop" | "tablet";
  visitors: number;
  conversions: number;
  rate: number;
}

export interface FunnelAnalyticsResponse {
  summary: {
    totalVisitors: number;
    totalConversions: number;
    overallConversionRate: number;
    avgFunnelVelocityMin: number;
    abandonedCartValue: number;
  };
  stages: FunnelStage[];
  sankey: {
    nodes: SankeyNode[];
    links: SankeyLink[];
  };
  devices: DeviceBreakdown[];
  leakageAlerts: FunnelLeakageAlert[];
}

export function computeFunnelAnalytics(
  orderCount: number = 2480,
  averageOrderValue: number = 78.5,
  deviceFilter: string = "all",
  period: string = "30d",
): FunnelAnalyticsResponse {
  const scale = period === "7d" ? 0.35 : period === "90d" ? 2.8 : 1.0;
  const devMult =
    deviceFilter === "mobile"
      ? 0.58
      : deviceFilter === "desktop"
        ? 0.34
        : deviceFilter === "tablet"
          ? 0.08
          : 1.0;

  const baseOrders = Math.max(120, Math.round(orderCount * scale * devMult));
  const aov = averageOrderValue || 78.5;
  const mobileCheckoutPenalty = deviceFilter === "mobile" ? 0.82 : 1.0;

  const purchases = baseOrders;
  const checkoutConversion = Number((0.62 * mobileCheckoutPenalty).toFixed(3));
  const checkouts = Math.round(purchases / checkoutConversion);
  const cartConversion = 0.48;
  const carts = Math.round(checkouts / cartConversion);
  const pdvConversion = 0.41;
  const pdvs = Math.round(carts / pdvConversion);
  const landingConversion = 0.55;
  const impressions = Math.round(pdvs / landingConversion);

  const stageData = [
    { id: "impressions", name: "Landing Impressions", count: impressions, duration: 25 },
    { id: "product_views", name: "Product Detail Views", count: pdvs, duration: 65 },
    { id: "add_to_cart", name: "Add to Cart", count: carts, duration: 110 },
    { id: "checkout", name: "Checkout Initiated", count: checkouts, duration: 195 },
    { id: "purchase", name: "Payment Settled", count: purchases, duration: 240 },
  ];

  const stages: FunnelStage[] = stageData.map((s, idx) => {
    const prevCount = idx === 0 ? s.count : stageData[idx - 1].count;
    const convRate = idx === 0 ? 100 : Number(((s.count / prevCount) * 100).toFixed(1));
    const overallRate = Number(((s.count / stageData[0].count) * 100).toFixed(2));
    const dropCount = idx === 0 ? 0 : prevCount - s.count;
    const dropRate = idx === 0 ? 0 : Number((100 - convRate).toFixed(1));
    const valueEst = Math.round(s.count * aov * (idx / 4));

    return {
      id: s.id,
      name: s.name,
      count: s.count,
      conversionRate: convRate,
      overallRate,
      dropoffCount: dropCount,
      dropoffRate: dropRate,
      avgDurationSec: s.duration,
      valueEstimate: valueEst,
    };
  });

  const channelBreakdown = [
    { id: "ch_organic", name: "Organic Search", pct: 0.32, color: "#10b981" },
    { id: "ch_tiktok", name: "TikTok / Social", pct: 0.28, color: "#06b6d4" },
    { id: "ch_google", name: "Paid Ads (Google)", pct: 0.22, color: "#3b82f6" },
    { id: "ch_direct", name: "Direct / Referral", pct: 0.11, color: "#8b5cf6" },
    { id: "ch_email", name: "Email & SMS", pct: 0.07, color: "#f59e0b" },
  ];

  const sankeyNodes: SankeyNode[] = [
    ...channelBreakdown.map((c) => ({
      id: c.id,
      name: c.name,
      category: "channel" as const,
      value: Math.round(impressions * c.pct),
      color: c.color,
    })),
    { id: "st_browse", name: "Catalog & PDP", category: "stage", value: pdvs, color: "#38bdf8" },
    { id: "st_cart", name: "Cart & Bag", category: "stage", value: carts, color: "#818cf8" },
    {
      id: "st_checkout",
      name: "Checkout Form",
      category: "stage",
      value: checkouts,
      color: "#c084fc",
    },
    {
      id: "out_converted",
      name: "Completed Orders",
      category: "outcome",
      value: purchases,
      color: "#10b981",
    },
    {
      id: "out_dropped",
      name: "Drop-off / Bounced",
      category: "outcome",
      value: impressions - purchases,
      color: "#ef4444",
    },
  ];

  const sankeyLinks: SankeyLink[] = [
    ...channelBreakdown.map((c) => ({
      source: c.id,
      target: "st_browse",
      value: Math.round(pdvs * c.pct),
      color: c.color,
    })),
    { source: "st_browse", target: "st_cart", value: carts, color: "#38bdf8" },
    { source: "st_browse", target: "out_dropped", value: pdvs - carts, color: "#fca5a5" },
    { source: "st_cart", target: "st_checkout", value: checkouts, color: "#818cf8" },
    { source: "st_cart", target: "out_dropped", value: carts - checkouts, color: "#f87171" },
    { source: "st_checkout", target: "out_converted", value: purchases, color: "#34d399" },
    {
      source: "st_checkout",
      target: "out_dropped",
      value: checkouts - purchases,
      color: "#ef4444",
    },
  ];

  const leakageAlerts: FunnelLeakageAlert[] = [
    {
      id: "leak-cart",
      stageId: "add_to_cart",
      stageName: "Add to Cart → Checkout",
      dropoffRate: Number(((1 - checkouts / carts) * 100).toFixed(1)),
      severity: "critical",
      insightKey: "leakCartInsight",
      recommendationKey: "leakCartRec",
      potentialRevenueRecovery: Math.round((carts - checkouts) * 0.22 * aov),
    },
    {
      id: "leak-checkout",
      stageId: "checkout",
      stageName: "Checkout Form → Settlement",
      dropoffRate: Number(((1 - purchases / checkouts) * 100).toFixed(1)),
      severity: "warning",
      insightKey: "leakCheckoutInsight",
      recommendationKey: "leakCheckoutRec",
      potentialRevenueRecovery: Math.round((checkouts - purchases) * 0.35 * aov),
    },
    {
      id: "leak-pdp",
      stageId: "product_views",
      stageName: "PDP Views → Add to Cart",
      dropoffRate: Number(((1 - carts / pdvs) * 100).toFixed(1)),
      severity: "warning",
      insightKey: "leakPdpInsight",
      recommendationKey: "leakPdpRec",
      potentialRevenueRecovery: Math.round((pdvs - carts) * 0.08 * aov),
    },
  ];

  const overallConv = Number(((purchases / impressions) * 100).toFixed(2));
  const abandonedCartVal = Math.round((carts - purchases) * aov);

  return {
    summary: {
      totalVisitors: impressions,
      totalConversions: purchases,
      overallConversionRate: overallConv,
      avgFunnelVelocityMin: 8.4,
      abandonedCartValue: abandonedCartVal,
    },
    stages,
    sankey: {
      nodes: sankeyNodes,
      links: sankeyLinks,
    },
    devices: [
      { device: "all", visitors: impressions, conversions: purchases, rate: overallConv },
      {
        device: "mobile",
        visitors: Math.round(impressions * 0.58),
        conversions: Math.round(purchases * 0.51),
        rate: Number((((purchases * 0.51) / (impressions * 0.58)) * 100).toFixed(2)),
      },
      {
        device: "desktop",
        visitors: Math.round(impressions * 0.34),
        conversions: Math.round(purchases * 0.42),
        rate: Number((((purchases * 0.42) / (impressions * 0.34)) * 100).toFixed(2)),
      },
      {
        device: "tablet",
        visitors: Math.round(impressions * 0.08),
        conversions: Math.round(purchases * 0.07),
        rate: Number((((purchases * 0.07) / (impressions * 0.08)) * 100).toFixed(2)),
      },
    ],
    leakageAlerts,
  };
}
