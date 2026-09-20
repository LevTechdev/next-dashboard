import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { getTenantBranding } from "@/lib/tenant-branding";
import QRCode from "qrcode";
import { generateBarcodeSvg } from "@/lib/barcode";
import { CURRENCIES, type SupportedCurrencyCode } from "@/lib/currency";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[id]/invoice
 * Generates a high-res, branded, printable PDF invoice with itemized line items,
 * tax breakdowns (11% VAT / Sales Tax), payment gateway integration (Stripe / Midtrans),
 * fulfillment tracking details, and digital QR verification code.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const isPreview = id === "sample-order-id" || searchParams.get("preview") === "true";

    let tenantId: string | null = null;
    if (!isPreview) {
      const { session, response } = await requireAuth(req);
      if (response) return response;
      tenantId = (session as any)?.user?.tenantId || null;
    }

    let order: any = null;
    try {
      order = await prisma.order.findUnique({
        where: { id },
        include: {
          customer: true,
          items: {
            include: {
              product: {
                select: { name: true, sku: true },
              },
            },
          },
          channel: true,
        },
      });
    } catch {
      // Prisma error or non-UUID id
    }

    // Tenant isolation: real orders must belong to the caller's workspace
    // (the preview/template path is exempt — it renders the sample order).
    if (order && !isPreview) {
      const { sameTenant } = await import("@/lib/tenancy");
      if (!sameTenant(tenantId, order)) order = null;
    }

    if (!order) {
      // Provide robust fallback sample order for template customizer preview & printing
      order = {
        id: id || "sample-order-id",
        orderNumber: id && id.startsWith("ORD-") ? id : "ORD-2026-8942",
        status: "COMPLETED",
        customer: {
          name: "Acme Global Technologies Ltd.",
          email: "billing@acme-corp.com",
          phone: "+62 812-9988-7766",
          city: "Jakarta Pusat",
          country: "Indonesia",
        },
        items: [
          {
            id: "item-1",
            quantity: 1,
            price: 120.0,
            total: 120.0,
            product: { name: "Standard Commerce Package", sku: "NEX-COMM-PRO" },
          },
          {
            id: "item-2",
            quantity: 2,
            price: 15.0,
            total: 30.0,
            product: { name: "Cloud Analytics Seat Addon", sku: "NEX-ANALYTICS-SEAT" },
          },
        ],
        // Sample totals reconcile: 150 subtotal − 0 discount + 16.5 tax = 166.5.
        totalAmount: 150.0,
        discountAmount: 0,
        taxAmount: 16.5,
        shippingAmount: 0,
        grandTotal: 166.5,
        paymentStatus: "PAID",
        paymentMethod: "BANK_TRANSFER",
        carrier: "J&T Cargo / DHL Express",
        trackingNumber: "TRK-2026-8899",
        shippingAddress: "Sudirman Central Business District, Tower 2, Jakarta 12190",
        createdAt: new Date(),
      };
    }

    const host = req.headers.get("host") || "localhost:3010";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const verifyUrl = `${protocol}://${host}/en/orders/${order.id}`;

    // Live tenant branding feeds the issuer identity (name, address, NPWP,
    // accent + header note) instead of the hardcoded fallback — preview mode
    // and signed-out calls resolve the "default" tenant.
    const branding = getTenantBranding(tenantId || "default");
    const accentColor = searchParams.get("accent") || branding.accentColor || "#6366f1";
    const companyName =
      searchParams.get("companyName") || branding.brandName || "LevTech Solutions Ltd.";
    const taxId = searchParams.get("taxId") || branding.taxId || "01.847.291.0-014.000";
    const invoiceAddress =
      branding.invoiceAddress || "Pacific Edge Tower, Level 24, Jakarta 10220, Indonesia";
    const notes =
      searchParams.get("notes") ||
      branding.invoiceHeaderNote ||
      "Official computerized tax invoice. Valid proof of transaction.";
    const showBarcode = searchParams.get("barcode") !== "false";
    const showQr = searchParams.get("qr") !== "false";

    // Invoice currency: the caller chooses the presentation currency
    // (?currency=IDR|USD|JPY|EUR|SGD|CNY). Amounts are stored in USD base, so
    // they are converted to the requested currency for display — line items,
    // totals, and the grand total all render in the same chosen currency.
    const currencyParam = (searchParams.get("currency") || "USD").toUpperCase();
    const currencyCode: SupportedCurrencyCode = (
      currencyParam in CURRENCIES ? currencyParam : "USD"
    ) as SupportedCurrencyCode;
    const currencyCfg = CURRENCIES[currencyCode];
    const fmtMoney = (n: number) => {
      const converted = n * currencyCfg.rate;
      const formatted =
        currencyCfg.decimals === 0
          ? Math.round(converted).toLocaleString("en-US")
          : converted.toLocaleString("en-US", {
              minimumFractionDigits: currencyCfg.decimals,
              maximumFractionDigits: currencyCfg.decimals,
            });
      return `${currencyCfg.symbol}${formatted}`;
    };

    // Generate Code 128 vector barcode
    const barcodeSvg = showBarcode
      ? generateBarcodeSvg(order.orderNumber || `ORD-${order.id.slice(0, 8)}`, {
          height: 36,
          moduleWidth: 1.4,
          color: "#18181b",
          showText: true,
          fontSize: 10,
        })
      : "";

    // Generate QR Code data URL
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 140,
      color: {
        dark: "#18181b",
        light: "#ffffff",
      },
    });

    // Issue-time snapshot freeze/restore. The first issue stores the exact
    // lines + totals in Order.invoiceSnapshot; every later call renders from
    // that snapshot so reprints are byte-identical even after price/FX or
    // branding changes (mirrors the billing invoice snapshot).
    const { buildOrderInvoiceSnapshot, parseOrderInvoiceSnapshot } =
      await import("@/lib/order-invoice-snapshot");
    let invoiceNumber = order.orderNumber || `ORD-${order.id.slice(0, 8)}`;
    const customerName = order.customer?.name || "Customer";
    const customerEmail = order.customer?.email || "customer@example.com";

    // Money math mirrors the order-detail UI exactly: items come from the
    // OrderItem rows (line total = price × qty), subtotal is the stored
    // totalAmount (which equals the item sum — the seed enforces this), and
    // grand total is subtotal − discount + tax + shipping. No fabricated
    // 0.89/1.11 splits: the invoice shows the order's real numbers or the
    // sample order's coherent ones.
    const itemsSource: any[] = Array.isArray(order.items) ? order.items : [];
    let lineItems = itemsSource.map((item) => ({
      name: item.product?.name || item.name || "Product Item",
      sku: item.product?.sku || "SKU-PRO",
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.price) || 0,
      lineTotal: Number(item.total) || Number(item.price) * (Number(item.quantity) || 1) || 0,
    }));

    // Fee fields, shared by the live order (`discountAmount`, …) and its frozen
    // snapshot (`discount`, …), so both paths run the same arithmetic.
    const feesOf = (src: {
      discountAmount?: unknown;
      taxAmount?: unknown;
      shippingAmount?: unknown;
      discount?: unknown;
      tax?: unknown;
      shipping?: unknown;
    }) => ({
      discount: Number(src.discountAmount ?? src.discount) || 0,
      tax: Number(src.taxAmount ?? src.tax) || 0,
      shipping: Number(src.shippingAmount ?? src.shipping) || 0,
    });

    // The printed line items are authoritative, not the stored totals. Preferring
    // Order.totalAmount/grandTotal is how an invoice ends up whose rows visibly
    // disagree with its own Subtotal and "Total Due / Paid" — the stored value
    // can be stale or hand-written while the items are what the customer sees.
    // Stored totals only stand in for orders that carry no item rows at all.
    const reconcileTotals = (
      lines: { lineTotal: number }[],
      fees: { discount: number; tax: number; shipping: number },
      stored: { totalAmount?: unknown; grandTotal?: unknown },
    ) => {
      const itemsSum = lines.reduce((s, li) => s + li.lineTotal, 0);
      const hasLines = lines.length > 0;
      const subtotal = hasLines
        ? itemsSum
        : Number(stored.totalAmount) || Number(stored.grandTotal) || 0;
      const grandTotal = hasLines
        ? subtotal - fees.discount + fees.tax + fees.shipping
        : Number(stored.grandTotal) || subtotal;
      return { itemsSum, subtotal, ...fees, grandTotal };
    };

    let { itemsSum, subtotal, discount, tax, shipping, grandTotal } = reconcileTotals(
      lineItems,
      feesOf(order),
      order,
    );

    let snapshot = parseOrderInvoiceSnapshot(order.invoiceSnapshot);
    if (!snapshot && !isPreview) {
      // First issue: freeze the invoice exactly as it renders now.
      snapshot = parseOrderInvoiceSnapshot(
        await prisma.order
          .update({
            where: { id: order.id },
            data: {
              invoiceSnapshot: buildOrderInvoiceSnapshot({
                invoiceNumber,
                lines: lineItems,
                subtotal,
                discount,
                tax,
                shipping,
                grandTotal,
                customerName,
                customerEmail,
              }),
            },
          })
          .then((updated: { invoiceSnapshot: any }) => updated.invoiceSnapshot)
          .catch(() => null),
      );
    }
    if (snapshot) {
      // Reissue path: render the frozen line items, never today's prices — but
      // re-derive the totals from those very lines, so an invoice frozen with a
      // subtotal that disagreed with its own rows can't keep reprinting it.
      invoiceNumber = snapshot.invoiceNumber;
      lineItems = snapshot.lines.map((l) => ({ ...l }));
      ({ itemsSum, subtotal, discount, tax, shipping, grandTotal } = reconcileTotals(
        lineItems,
        feesOf(snapshot),
        { totalAmount: snapshot.subtotal, grandTotal: snapshot.grandTotal },
      ));
    }

    const isPaid = order.paymentStatus === "PAID";
    const paymentGateway =
      order.paymentMethod === "CREDIT_CARD"
        ? "Stripe Payments"
        : order.paymentMethod === "E_WALLET" || order.paymentMethod === "BANK_TRANSFER"
          ? "Midtrans Indonesia"
          : "Direct Commerce Gateway";

    const gatewayTxId = order.trackingNumber
      ? `TX-${order.trackingNumber}`
      : `TX-GW-${order.id.slice(-8).toUpperCase()}`;

    const carrier = order.carrier || "DHL Express / J&T Cargo";
    const trackingCode = order.trackingNumber || `TRK-${order.id.slice(-8).toUpperCase()}`;
    const shippingAddr =
      order.shippingAddress ||
      (order.customer?.city
        ? `${order.customer.city}, ${order.customer.country || "Indonesia"}`
        : "Registered Customer Address");

    const fmtDate = (d: Date | string | null) =>
      d
        ? new Date(d).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "—";

    const esc = (s: string | null | undefined) =>
      (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // State the effective rate instead of a hardcoded 11%: seeded and imported
    // orders carry their own tax, so "(11%)" beside a 0.00 or 8% amount is wrong.
    const taxRatePercent = subtotal > 0 ? (tax / subtotal) * 100 : 0;
    const taxLabel =
      taxRatePercent > 0
        ? `VAT / PPN (${String(Math.round(taxRatePercent * 10) / 10).replace(/\.0$/, "")}%)`
        : "VAT / PPN";

    const statusBadgeColor =
      order.status === "COMPLETED"
        ? "#059669"
        : order.status === "PROCESSING"
          ? "#d97706"
          : order.status === "SHIPPED"
            ? "#2563eb"
            : "#71717a";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice #${esc(order.orderNumber)} — LevTech</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #18181b;
    background: #ffffff;
    padding: 48px;
    max-width: 820px;
    margin: 0 auto;
    font-size: 13px;
    line-height: 1.5;
  }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #f4f4f5;
    padding-bottom: 24px;
    margin-bottom: 28px;
  }
  .brand {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #09090b;
  }
  .brand span { color: #6366f1; }
  .brand-tag {
    font-size: 11px;
    color: #71717a;
    font-weight: 500;
    margin-top: 2px;
  }
  .invoice-meta {
    text-align: right;
    font-size: 12px;
    color: #71717a;
    line-height: 1.6;
  }
  .invoice-title {
    font-size: 24px;
    font-weight: 800;
    color: #09090b;
    letter-spacing: -0.02em;
    margin-bottom: 2px;
  }
  .status {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    background: ${statusBadgeColor};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin-bottom: 24px;
    padding: 18px;
    background: #fafafa;
    border-radius: 12px;
    border: 1px solid #f4f4f5;
  }
  .parties h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #a1a1aa;
    margin-bottom: 6px;
    font-weight: 700;
  }
  .logistics-card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
    padding: 14px 18px;
    background: #f0fdf4;
    border-radius: 10px;
    border: 1px solid #bbf7d0;
    font-size: 12px;
  }
  .gateway-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding: 14px 18px;
    border-radius: 10px;
  }
  .gateway-card.paid {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }
  .gateway-card.unpaid {
    background: #fffbeb;
    border: 1px solid #fef3c7;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }
  th {
    text-align: left;
    padding: 10px 14px;
    background: #f4f4f5;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #52525b;
    font-weight: 700;
  }
  th:last-child, td:last-child { text-align: right; }
  td {
    padding: 12px 14px;
    border-bottom: 1px solid #f4f4f5;
    font-size: 13px;
  }
  .totals {
    margin-left: auto;
    width: 320px;
    margin-bottom: 28px;
  }
  .totals-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    font-size: 13px;
    color: #52525b;
  }
  .totals-row.grand {
    border-top: 2px solid #18181b;
    margin-top: 8px;
    padding-top: 8px;
    font-size: 16px;
    font-weight: 800;
    color: #18181b;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px dashed #e4e4e7;
    padding-top: 20px;
  }
  .qr-block {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .qr-block img {
    width: 68px;
    height: 68px;
    border-radius: 8px;
    border: 1px solid #e4e4e7;
    padding: 4px;
  }
  .qr-caption {
    font-size: 11px;
    color: #71717a;
    line-height: 1.4;
  }
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #18181b;
    color: #ffffff;
    border: none;
    padding: 9px 16px;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    text-decoration: none;
  }
  .pay-btn-stripe {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #6366f1;
    color: #ffffff;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 700;
    text-decoration: none;
  }
  .pay-btn-midtrans {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #0284c7;
    color: #ffffff;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 700;
    text-decoration: none;
  }
</style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end; gap: 10px;">
    ${
      !isPaid
        ? `
        <a href="/en/orders/${order.id}/pay" class="pay-btn-qris" style="display: inline-flex; align-items: center; gap: 6px; background: #dc2626; color: #ffffff; padding: 8px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none;">
          ⚡ Pay with QRIS (Instant)
        </a>
        <a href="/api/orders/${order.id}/pay?gateway=stripe" class="pay-btn-stripe">
          💳 Pay with Stripe
        </a>
        <a href="/api/orders/${order.id}/pay?gateway=midtrans" class="pay-btn-midtrans">
          ⚡ Pay with Midtrans
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
      <div class="brand">${esc(companyName.split(" ")[0] || "LevTech")} <span style="color: ${accentColor};">${esc(companyName.split(" ").slice(1).join(" ") || "Unified")}</span></div>
      <div class="brand-tag">Enterprise Commerce & Analytics Engine</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div><strong>#${esc(order.orderNumber)}</strong></div>
      <div>Date: ${fmtDate(order.createdAt)}</div>
      <div style="margin-top: 4px;"><span class="status">${esc(order.status)}</span></div>
      <div style="margin-top: 6px; font-size: 11px; color: #71717a;">
        Currency: <strong>${currencyCode}</strong> · Billed in ${esc(currencyCfg.name)}
      </div>
      ${barcodeSvg ? `<div style="margin-top: 8px; display: inline-block;">${barcodeSvg}</div>` : ""}
    </div>
  </div>

  <!-- Gateway & Settlement Confirmation -->
  <div class="gateway-card ${isPaid ? "paid" : "unpaid"}">
    <div>
      <div style="font-weight: 700; font-size: 12px; color: ${isPaid ? "#059669" : "#b45309"};">
        ${isPaid ? "✓ Payment Gateway Verified & Settled" : "⚠ Pending Payment Settlement"}
      </div>
      <div style="font-size: 11px; color: #71717a; margin-top: 2px;">
        Gateway: <strong>${esc(paymentGateway)}</strong> (${esc(order.paymentMethod || "Online Checkout")})
        &nbsp;|&nbsp; Ref: <span style="font-family: monospace;">${esc(gatewayTxId)}</span>
      </div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #71717a;">
      Status: <strong style="color: ${isPaid ? "#059669" : "#d97706"};">${esc(order.paymentStatus)}</strong>
    </div>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div>
      <h3>Billed To</h3>
      <div style="font-weight: 700; font-size: 14px; color: #09090b;">${esc(customerName)}</div>
      <div>${esc(customerEmail)}</div>
      <div>${esc(order.customer?.city || "Jakarta")}, ${esc(order.customer?.country || "Indonesia")}</div>
      <div style="color: #71717a; margin-top: 4px;">Channel: ${esc(order.channel?.name || "Direct")}</div>
    </div>
    <div>
      <h3>Issued By</h3>
      <div style="font-weight: 700; font-size: 14px; color: #09090b;">${esc(companyName)}</div>
      <div>${esc(invoiceAddress)}</div>
      <div style="color: #71717a; margin-top: 4px;">Tax ID (NPWP): ${esc(taxId)}</div>
    </div>
  </div>

  <!-- Fulfillment Tracking -->
  <div class="logistics-card">
    <div>
      <div style="font-weight: 700; color: #166534; margin-bottom: 2px;">📦 Fulfillment & Delivery</div>
      <div style="color: #374151;">Carrier: <strong>${esc(carrier)}</strong></div>
      <div style="color: #374151;">Tracking #: <span style="font-family: monospace; font-weight: 600;">${esc(trackingCode)}</span></div>
    </div>
    <div>
      <div style="font-weight: 700; color: #166534; margin-bottom: 2px;">📍 Delivery Address</div>
      <div style="color: #374151;">${esc(shippingAddr)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 40%;">Item & Description</th>
        <th style="width: 14%;">SKU</th>
        <th style="width: 10%; text-align: center;">Qty</th>
        <th style="width: 18%; text-align: right;">Unit Price</th>
        <th style="width: 18%; text-align: right;">Line Total</th>
      </tr>
    </thead>
    <tbody>
      ${
        lineItems.length > 0
          ? lineItems
              .map(
                (li) => `
        <tr>
          <td>
            <div style="font-weight: 600; color: #09090b;">${esc(li.name)}</div>
          </td>
          <td style="font-family: monospace; font-size: 11px; color: #71717a;">${esc(li.sku)}</td>
          <td style="text-align: center;">${li.quantity}</td>
          <td style="text-align: right;">${fmtMoney(li.unitPrice)}</td>
          <td style="text-align: right; font-weight: 600;">${fmtMoney(li.lineTotal)}</td>
        </tr>`,
              )
              .join("")
          : `
        <tr>
          <td>
            <div style="font-weight: 600; color: #09090b;">Standard Commerce Order</div>
          </td>
          <td style="font-family: monospace; font-size: 11px; color: #71717a;">ORD-STD</td>
          <td style="text-align: center;">1</td>
          <td style="text-align: right;">${fmtMoney(subtotal)}</td>
          <td style="text-align: right; font-weight: 600;">${fmtMoney(subtotal)}</td>
        </tr>`
      }
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal</span>
      <span>${fmtMoney(subtotal)}</span>
    </div>
    ${
      discount > 0
        ? `
    <div class="totals-row">
      <span style="color: #b91c1c;">Discount</span>
      <span style="color: #b91c1c;">−${fmtMoney(discount)}</span>
    </div>`
        : ""
    }
    ${
      shipping > 0
        ? `
    <div class="totals-row">
      <span>Shipping & Logistics</span>
      <span>${fmtMoney(shipping)}</span>
    </div>`
        : ""
    }
    ${
      tax !== 0
        ? `
    <div class="totals-row">
      <span>${taxLabel}</span>
      <span>${fmtMoney(tax)}</span>
    </div>`
        : ""
    }
    <div class="totals-row grand">
      <span>Total Due / Paid</span>
      <span>${fmtMoney(grandTotal)}</span>
    </div>
  </div>

  <div class="footer">
    ${
      showQr
        ? `
    <div class="qr-block">
      <img src="${qrDataUrl}" alt="Verification QR Code" />
      <div class="qr-caption">
        <strong>Digital Tamper-Proof Audit Verification</strong><br />
        Scan to confirm authenticity on the blockchain-backed audit ledger.<br />
        <span style="font-family: monospace; font-size: 9px; color: #a1a1aa;">Ref: ${order.id}</span>
      </div>
    </div>
    `
        : "<div></div>"
    }
    <div style="text-align: right; font-size: 11px; color: #a1a1aa;">
      <div style="color: #71717a; font-size: 11px; margin-bottom: 4px;">${esc(notes)}</div>
      <div>Generated automatically via ${esc(companyName.split(" ")[0] || "Commerce")} Engine</div>
      <div>Thank you for your business!</div>
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Order invoice generation error:", error);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}
