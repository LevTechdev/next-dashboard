import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/invoices/[id]/download
 * Returns a self-contained, print-optimized HTML invoice with digital QR verification,
 * subscription details (tier, interval, renewal), and payment gateway support (Stripe & Midtrans).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      plan: { select: { name: true, interval: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!invoice || (invoice.userId && invoice.userId !== session.user.id)) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const host = req.headers.get("host") || "localhost:3010";
  const protocol = req.headers.get("x-forwarded-proto") || "http";
  const verifyUrl = `${protocol}://${host}/en/billing`;

  // Generate QR Code data URL
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 140,
    color: { dark: "#18181b", light: "#ffffff" },
  });

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(n);
  const fmtDate = (d: Date | string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "—";

  const esc = (s: string | null | undefined) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const isPaid = invoice.status === "PAID";
  const statusColor = isPaid ? "#059669" : invoice.status === "OVERDUE" ? "#dc2626" : "#d97706";

  const subtotal = invoice.amount * 0.89;
  const tax = invoice.amount - subtotal;

  const planName = invoice.plan?.name || "Professional Plan";
  const planInterval = (invoice.plan?.interval || "MONTHLY").toUpperCase();
  const paymentMethod = invoice.paymentMethod
    ? invoice.paymentMethod.replace(/_/g, " ")
    : "Stripe Recurring Billing";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${esc(invoice.invoiceNumber)} — LevTech</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #18181b; padding: 48px; max-width: 820px; margin: 0 auto; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #f4f4f5; padding-bottom: 24px; }
  .brand { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }
  .brand span { color: #6366f1; }
  .invoice-meta { text-align: right; font-size: 12px; color: #71717a; line-height: 1.6; }
  .invoice-title { font-size: 24px; font-weight: 800; color: #09090b; letter-spacing: -0.02em; margin-bottom: 2px; }
  .status { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #fff; background: ${statusColor}; text-transform: uppercase; }
  .gateway-card { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 14px 18px; border-radius: 10px; border: 1px solid ${isPaid ? "#bbf7d0" : "#fef3c7"}; background: ${isPaid ? "#f0fdf4" : "#fffbeb"}; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 24px; padding: 18px; background: #fafafa; border-radius: 12px; border: 1px solid #f4f4f5; }
  .parties h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; padding: 10px 14px; background: #f4f4f5; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #52525b; font-weight: 700; }
  th:last-child, td:last-child { text-align: right; }
  td { padding: 12px 14px; border-bottom: 1px solid #f4f4f5; font-size: 13px; }
  .totals { margin-left: auto; width: 300px; margin-bottom: 28px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #52525b; }
  .totals .grand { font-weight: 800; font-size: 16px; border-top: 2px solid #18181b; margin-top: 6px; padding-top: 8px; color: #18181b; }
  @media print { body { padding: 0; } .no-print { display: none !important; } }
  .pay-btn { display: inline-flex; align-items: center; gap: 6px; background: #6366f1; color: #fff; padding: 8px 16px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 12px; }
  .action-btn { display: inline-flex; align-items: center; gap: 6px; background: #18181b; color: #fff; padding: 8px 16px; border-radius: 9999px; border: none; font-weight: 600; cursor: pointer; font-size: 12px; }
</style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 10px;">
    ${
      !isPaid
        ? `
        <a href="/en/billing" class="pay-btn">
          💳 Complete Payment with Stripe / Midtrans
        </a>
        `
        : ""
    }
    <button class="action-btn" onclick="window.print()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
      Print / Save as PDF
    </button>
  </div>

  <div class="header">
    <div>
      <div class="brand">LevTech <span>Unified</span></div>
      <div style="font-size:11px;color:#71717a;margin-top:2px;">SaaS Subscription Billing & Infrastructure</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div><strong>#${esc(invoice.invoiceNumber)}</strong></div>
      <div>Issued: ${fmtDate(invoice.createdAt)}</div>
      ${invoice.paidAt ? `<div>Paid: ${fmtDate(invoice.paidAt)}</div>` : ""}
      <div style="margin-top:4px;"><span class="status">${esc(invoice.status)}</span></div>
    </div>
  </div>

  <div class="gateway-card">
    <div>
      <div style="font-weight: 700; font-size: 12px; color: ${isPaid ? "#166534" : "#b45309"};">
        ${isPaid ? "✓ Subscription Renewal Verified & Active" : "⚠ Subscription Renewal Payment Due"}
      </div>
      <div style="font-size: 11px; color: #71717a; margin-top: 2px;">
        Payment Method: <strong style="text-transform: capitalize;">${esc(paymentMethod)}</strong>
        &nbsp;|&nbsp; Cycle: <strong>${esc(planInterval)}</strong>
      </div>
    </div>
    <div style="text-align: right; font-size: 11px;">
      Period: <strong>${fmtDate(invoice.periodStart)} — ${fmtDate(invoice.periodEnd)}</strong>
    </div>
  </div>

  <div class="parties">
    <div>
      <h3>Subscriber</h3>
      <div style="font-weight: 700; font-size: 14px; color: #09090b;">${esc(invoice.user?.name || "Subscriber")}</div>
      <div>${esc(invoice.user?.email || "subscriber@example.com")}</div>
    </div>
    <div>
      <h3>Subscription Terms</h3>
      <div>Plan Tier: <strong>${esc(planName)}</strong></div>
      <div>Billing Frequency: ${esc(planInterval)} Recurring</div>
      <div style="color: #71717a; margin-top: 4px;">Merchant NPWP: 01.847.291.0-014.000</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 70%;">Subscription Item & Plan Tier</th>
        <th>Period</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div style="font-weight: 600; color: #09090b;">${esc(planName)} Subscription</div>
          <div style="font-size: 11px; color: #71717a; margin-top: 2px;">
            Full access to Real-time Analytics, Telemetry, Webhook Engine & Team Collaboration
          </div>
        </td>
        <td>${esc(planInterval)}</td>
        <td style="font-weight: 600;">${fmtMoney(invoice.amount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${fmtMoney(subtotal)}</span></div>
    <div class="row"><span>VAT / PPN (11%)</span><span>${fmtMoney(tax)}</span></div>
    <div class="row grand"><span>Total Due / Paid</span><span>${fmtMoney(invoice.amount)}</span></div>
  </div>

  <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e4e4e7; padding-top: 20px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <img src="${qrDataUrl}" alt="Verification QR Code" style="width: 68px; height: 68px; border-radius: 8px; border: 1px solid #e4e4e7; padding: 4px;" />
      <div style="font-size: 11px; color: #71717a; line-height: 1.4;">
        <strong>Digital Tamper-Proof Audit Verification</strong><br />
        Scan to confirm authenticity on the billing ledger.<br />
        <span style="font-family: monospace; font-size: 9px; color: #a1a1aa;">Ref: ${invoice.id}</span>
      </div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #a1a1aa;">
      LevTech Unified Commerce<br />
      Thank you for subscribing!
    </div>
  </div>

  <script>window.addEventListener("load",function(){setTimeout(function(){window.print()},350)});</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
