import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/invoices/[id]/download
 * Returns a self-contained, print-optimized HTML invoice. Opening it triggers
 * the browser print dialog so the user can save it as a PDF — no PDF library
 * dependency required.
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

  if (!invoice || invoice.userId !== session.user.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(n);
  const fmtDate = (d: Date | string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "—";

  const esc = (s: string | null | undefined) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const statusColor =
    invoice.status === "PAID" ? "#059669" : invoice.status === "OVERDUE" ? "#dc2626" : "#d97706";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice ${esc(invoice.invoiceNumber)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #18181b; padding: 48px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
  .brand { font-size: 22px; font-weight: 700; }
  .brand span { color: #6366f1; }
  .invoice-meta { text-align: right; font-size: 13px; color: #52525b; line-height: 1.7; }
  .invoice-title { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #fff; background: ${statusColor}; }
  .parties { display: flex; gap: 64px; margin-bottom: 40px; font-size: 13px; line-height: 1.8; }
  .parties h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #a1a1aa; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 14px; }
  th { text-align: left; padding: 10px 12px; background: #f4f4f5; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #52525b; }
  th:last-child, td:last-child { text-align: right; }
  td { padding: 14px 12px; border-bottom: 1px solid #e4e4e7; }
  .totals { margin-left: auto; width: 280px; font-size: 14px; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 12px; }
  .totals .grand { font-weight: 700; font-size: 18px; border-top: 2px solid #18181b; margin-top: 4px; padding-top: 12px; }
  .footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid #e4e4e7; font-size: 12px; color: #a1a1aa; text-align: center; }
  @media print { body { padding: 24px; } .no-print { display: none; } }
  .no-print { position: fixed; bottom: 24px; right: 24px; }
  .no-print button { background: #6366f1; color: #fff; border: 0; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(99,102,241,.3); }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Next<span>Dashboard</span></div>
      <div style="font-size:12px;color:#a1a1aa;margin-top:4px;">next-dashboard-apps.vercel.app</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div><strong>${esc(invoice.invoiceNumber)}</strong></div>
      <div>Issued: ${fmtDate(invoice.createdAt)}</div>
      ${invoice.paidAt ? `<div>Paid: ${fmtDate(invoice.paidAt)}</div>` : ""}
      <div style="margin-top:8px;"><span class="status">${esc(invoice.status)}</span></div>
    </div>
  </div>

  <div class="parties">
    <div>
      <h3>Billed To</h3>
      <div><strong>${esc(invoice.user?.name)}</strong></div>
      <div>${esc(invoice.user?.email)}</div>
    </div>
    <div>
      <h3>Billing Period</h3>
      <div>${fmtDate(invoice.periodStart)} — ${fmtDate(invoice.periodEnd)}</div>
      ${invoice.paymentMethod ? `<h3 style="margin-top:12px;">Payment Method</h3><div style="text-transform:capitalize;">${esc(invoice.paymentMethod.replace(/_/g, " "))}</div>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th>Amount</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>${esc(invoice.description || `${invoice.plan?.name || "Subscription"} plan${invoice.plan?.interval ? ` (${invoice.plan.interval.toLowerCase()})` : ""}`)}</td>
        <td>${fmtMoney(invoice.amount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${fmtMoney(invoice.amount)}</span></div>
    <div class="row grand"><span>Total</span><span>${fmtMoney(invoice.amount)}</span></div>
  </div>

  <div class="footer">
    Thank you for your business. This is a system-generated invoice.
  </div>

  <div class="no-print">
    <button onclick="window.print()">Download PDF</button>
  </div>
  <script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)});</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
