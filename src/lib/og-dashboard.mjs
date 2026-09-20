/**
 * Shared OG dashboard artwork — the 1200×630 "LevTech Unified" command panel.
 *
 * Plain ESM so both the Next.js route (`/api/og/dashboard`) and the build-time
 * generator (`scripts/generate-og.mjs`) can import it without a transpiler.
 * Both renderers accept live dashboard numbers and fall back to demo data:
 *
 *   buildDashboardSvg({ values, labels, kpis, orders })  → sharp rasterization
 *   buildDashboardHtml({ values, labels, kpis, orders }) → headless Chromium
 */

export const DEFAULT_MONTHLY = [28, 45, 38, 62, 55, 78, 72, 88, 95, 82, 104, 118];
export const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export const DEFAULT_KPIS = [
  { label: "Total Revenue", value: "$284.7k", delta: "+12.5%" },
  { label: "Total Orders", value: "1,847", delta: "+8.3%" },
  { label: "Total Customers", value: "892", delta: "+15.2%" },
  { label: "Total Products", value: "156", delta: "+5.1%" },
];

export const DEFAULT_ORDERS = [
  {
    initials: "SJ",
    name: "Sarah Johnson",
    meta: "ORD-2841 · Online Store",
    status: "Completed",
    amount: "$249.99",
    color: "#22c55e",
  },
  {
    initials: "MC",
    name: "Michael Chen",
    meta: "ORD-2840 · Instagram",
    status: "Processing",
    amount: "$89.50",
    color: "#f59e0b",
  },
  {
    initials: "EW",
    name: "Emma Wilson",
    meta: "ORD-2839 · Shopify",
    status: "Completed",
    amount: "$420.00",
    color: "#22c55e",
  },
];

const STATUS_BG = {
  Completed: "rgba(34,197,94,0.14)",
  Processing: "rgba(245,158,11,0.14)",
  Shipped: "rgba(59,130,246,0.14)",
  Pending: "rgba(245,158,11,0.14)",
  Cancelled: "rgba(239,68,68,0.14)",
  Refunded: "rgba(239,68,68,0.14)",
};

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function renderBars(values, labels, accent) {
  const max = Math.max(...values);
  return values
    .map((v, i) => {
      const h = Math.max(6, Math.round((v / max) * 100));
      return `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:150px;gap:4px">
      <div style="height:${h}%;border-radius:3px;background:${accent};opacity:${0.55 + (v / max) * 0.45}"></div>
      <span style="font-size:9px;color:#71717a;text-align:center">${labels[i] ?? MONTHS[i] ?? ""}</span>
    </div>`;
    })
    .join("");
}

function renderKpis(kpis) {
  return kpis
    .map(
      (
        k,
      ) => `<div style="flex:1;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.08)">
      <p style="margin:0;font-size:10px;color:#a1a1aa;font-weight:500">${k.label}</p>
      <p style="margin:6px 0 0;font-size:26px;font-weight:700;color:#f4f4f5;letter-spacing:-0.02em">${k.value}</p>
      <p style="margin:6px 0 0;font-size:10px;font-weight:600;color:#34d399">&#8593; ${k.delta}</p>
    </div>`,
    )
    .join("");
}

function renderOrders(orders) {
  return orders
    .map(
      (
        o,
      ) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <div style="width:30px;height:30px;border-radius:50%;background:rgba(99,102,241,0.16);color:#a5b4fc;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${o.initials}</div>
        <div style="min-width:0">
          <p style="margin:0;font-size:12px;font-weight:600;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.name}</p>
          <p style="margin:2px 0 0;font-size:9px;color:#71717a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.meta}</p>
        </div>
      </div>
      <div style="text-align:right">
        <span style="font-size:9px;font-weight:600;padding:3px 8px;border-radius:999px;color:#86efac;background:${STATUS_BG[o.status] || "rgba(148,163,184,0.14)"}">${o.status}</span>
        <p style="margin:4px 0 0;font-size:11px;font-weight:700;color:#f4f4f5">${o.amount}</p>
      </div>
    </div>`,
    )
    .join("");
}

export function buildDashboardHtml({
  values = DEFAULT_MONTHLY,
  labels = MONTHS,
  kpis = DEFAULT_KPIS,
  orders = DEFAULT_ORDERS,
} = {}) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { width: 1200px; height: 630px; font-family: ${FONT_STACK}; background: #0b0c11; color: #f4f4f5; overflow: hidden; }
    .wrap { position: relative; width: 100%; height: 100%; padding: 34px 42px; display: flex; flex-direction: column; }
    .glow { position: absolute; top: -180px; right: -120px; width: 560px; height: 560px; border-radius: 50%;
      background: radial-gradient(circle, rgba(56,189,248,0.16) 0%, transparent 62%); pointer-events: none; }
    .glow2 { position: absolute; bottom: -220px; left: -160px; width: 600px; height: 600px; border-radius: 50%;
      background: radial-gradient(circle, rgba(129,140,248,0.14) 0%, transparent 62%); pointer-events: none; }
    .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .logo { width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(135deg, #6366f1, #22d3ee);
      display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; }
    .brand-name { font-size: 15px; font-weight: 700; letter-spacing: 0.01em; }
    .live { display: flex; align-items: center; gap: 7px; font-size: 10px; font-weight: 700; color: #6ee7b7;
      background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25); padding: 5px 12px; border-radius: 999px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; }
    .kpis { display: flex; gap: 14px; margin-bottom: 20px; }
    .mid { display: flex; gap: 14px; flex: 1; min-height: 0; }
    .panel { border-radius: 16px; background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.08); padding: 18px; }
    .panel-title { font-size: 12px; font-weight: 700; color: #e4e4e7; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
    .panel-eyebrow { font-size: 9px; color: #a1a1aa; font-weight: 500; }
    .bars { display: flex; gap: 8px; align-items: flex-end; }
    .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; color: #71717a; }
    .foot b { color: #34d399; font-weight: 600; }
  </style></head><body><div class="wrap">
    <div class="glow"></div><div class="glow2"></div>
    <div class="top">
      <div class="brand">
        <div class="logo">L</div>
        <span class="brand-name">LevTech Unified</span>
      </div>
      <span class="live"><span class="dot"></span>LIVE · 14 EDGE REGIONS</span>
    </div>
    <div class="kpis">${renderKpis(kpis)}</div>
    <div class="mid">
      <div class="panel" style="flex:3;display:flex;flex-direction:column">
        <div class="panel-title"><span>Monthly Revenue</span><span class="panel-eyebrow">LIVE UPDATES · 15s</span></div>
        <div class="bars">${renderBars(values, labels, "linear-gradient(180deg,#818cf8,#38bdf8)")}</div>
      </div>
      <div class="panel" style="flex:2;overflow:hidden">
        <div class="panel-title"><span>Recent Orders</span><span class="panel-eyebrow">VIEW ALL &rsaquo;</span></div>
        ${renderOrders(orders)}
      </div>
    </div>
    <div class="foot"><span><b>GET</b> /api/v1/orders &rarr; 200 OK &middot; 12ms</span><span>SSE &middot; order.completed &middot; webhook &#10003;</span></div>
  </div></body></html>`;
}

export function buildDashboardSvg({
  values = DEFAULT_MONTHLY,
  labels = MONTHS,
  kpis = DEFAULT_KPIS,
  orders = DEFAULT_ORDERS,
} = {}) {
  const max = Math.max(...values);
  const barW = 46;
  const gap = 14;
  const bars = values
    .map((v, i) => {
      const h = Math.max(8, Math.round((v / max) * 150));
      const x = i * (barW + gap);
      return `<rect x="${x}" y="${170 - h}" width="${barW}" height="${h}" rx="3" fill="#818cf8" opacity="${0.55 + (v / max) * 0.45}"/><text x="${x + barW / 2}" y="188" font-size="9" fill="#71717a" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${labels[i] ?? ""}</text>`;
    })
    .join("");
  const kpiEls = kpis
    .map((k, i) => {
      const x = 42 + i * 282;
      return `<rect x="${x}" y="120" width="260" height="104" rx="14" fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.08)"/><text x="${x + 16}" y="144" font-size="10" fill="#a1a1aa" font-family="Segoe UI, Arial, sans-serif">${k.label}</text><text x="${x + 16}" y="176" font-size="26" font-weight="700" fill="#f4f4f5" font-family="Segoe UI, Arial, sans-serif">${k.value}</text><text x="${x + 16}" y="200" font-size="10" font-weight="600" fill="#34d399" font-family="Segoe UI, Arial, sans-serif">&#8593; ${k.delta}</text>`;
    })
    .join("");
  const orderEls = orders
    .map((o, i) => {
      const y = 296 + i * 74;
      return `<circle cx="756" cy="${y + 14}" r="15" fill="rgba(99,102,241,0.16)"/><text x="756" y="${y + 19}" font-size="10" font-weight="700" fill="#a5b4fc" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${o.initials}</text><text x="784" y="${y + 11}" font-size="12" font-weight="600" fill="#e4e4e7" font-family="Segoe UI, Arial, sans-serif">${o.name}</text><text x="784" y="${y + 26}" font-size="9" fill="#71717a" font-family="Segoe UI, Arial, sans-serif">${o.meta}</text><text x="1134" y="${y + 12}" font-size="9" font-weight="600" text-anchor="end" fill="#86efac" font-family="Segoe UI, Arial, sans-serif">${o.status}</text><text x="1134" y="${y + 30}" font-size="11" font-weight="700" text-anchor="end" fill="#f4f4f5" font-family="Segoe UI, Arial, sans-serif">${o.amount}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#0b0c11"/>
    <circle cx="1000" cy="90" r="320" fill="rgba(56,189,248,0.10)"/>
    <circle cx="120" cy="560" r="340" fill="rgba(129,140,248,0.10)"/>
    <rect x="42" y="44" width="30" height="30" rx="9" fill="#6366f1"/><text x="58" y="65" font-size="14" font-weight="800" fill="#fff" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">L</text>
    <text x="84" y="66" font-size="15" font-weight="700" fill="#f4f4f5" font-family="Segoe UI, Arial, sans-serif">LevTech Unified</text>
    <rect x="930" y="50" width="228" height="22" rx="11" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.25)"/>
    <circle cx="948" cy="61" r="3.5" fill="#34d399"/><text x="958" y="65" font-size="10" font-weight="700" fill="#6ee7b7" font-family="Segoe UI, Arial, sans-serif">LIVE · 14 EDGE REGIONS</text>
    ${kpiEls}
    <rect x="42" y="248" width="658" height="300" rx="16" fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.08)"/>
    <text x="60" y="276" font-size="12" font-weight="700" fill="#e4e4e7" font-family="Segoe UI, Arial, sans-serif">Monthly Revenue</text>
    <text x="640" y="276" font-size="9" fill="#a1a1aa" font-family="Segoe UI, Arial, sans-serif">LIVE UPDATES · 15s</text>
    ${bars}
    <rect x="722" y="248" width="436" height="300" rx="16" fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.08)"/>
    <text x="740" y="276" font-size="12" font-weight="700" fill="#e4e4e7" font-family="Segoe UI, Arial, sans-serif">Recent Orders</text>
    <text x="1090" y="276" font-size="9" fill="#a1a1aa" font-family="Segoe UI, Arial, sans-serif">VIEW ALL &#8250;</text>
    ${orderEls}
    <text x="42" y="590" font-size="10" fill="#71717a" font-family="ui-monospace, Menlo, monospace"><tspan fill="#34d399">GET</tspan> /api/v1/orders &#8594; 200 OK &#183; 12ms</text>
    <text x="930" y="590" font-size="10" fill="#71717a" font-family="ui-monospace, Menlo, monospace">SSE &#183; order.completed &#183; webhook &#10003;</text>
  </svg>`;
}

/** Compact "$284.7k"-style formatting for live revenue values. */
export function formatCompactUsd(value) {
  if (value == null || Number.isNaN(value)) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** First/last-name initials for live orders. */
export function initialsOf(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
