import { NextResponse } from "next/server";
import { getPurchaseOrderById } from "@/lib/purchase-orders-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const po = getPurchaseOrderById(id);

    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const formatRp = (num: number) => "Rp " + Math.round(num).toLocaleString("id-ID");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Purchase Order ${po.poNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #111827; background: #fff; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 30px; }
    .brand { font-size: 24px; font-weight: 800; color: #4f46e5; letter-spacing: -0.5px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; background: #e0e7ff; color: #4338ca; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
    .box { background: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #f3f4f6; }
    .box-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th { text-align: left; padding: 12px 16px; background: #f3f4f6; font-size: 12px; font-weight: 700; color: #4b5563; text-transform: uppercase; }
    td { padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .total-section { margin-left: auto; width: 320px; border-top: 2px solid #111827; padding-top: 12px; margin-top: 20px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .grand-total { font-size: 18px; font-weight: 800; color: #111827; }
    .footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; }
    .signature-line { margin-top: 40px; border-top: 1px dashed #9ca3af; width: 220px; padding-top: 8px; text-align: center; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 24px; text-align: right;">
    <button onclick="window.print()" style="padding: 10px 20px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="header">
    <div>
      <div class="brand">NEXT DASHBOARD ENTERPRISE</div>
      <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Supply Chain Operations & Procurement</div>
    </div>
    <div style="text-align: right;">
      <div class="badge">${po.status}</div>
      <div style="font-size: 20px; font-weight: 800; margin-top: 8px;">${po.poNumber}</div>
      <div style="font-size: 12px; color: #6b7280;">Date: ${new Date(po.issueDate).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="box-title">Vendor / Supplier</div>
      <div style="font-size: 16px; font-weight: 700;">${po.supplierName}</div>
      <div style="font-size: 13px; color: #4b5563; margin-top: 4px;">Email: ${po.supplierEmail}</div>
      <div style="font-size: 13px; color: #4b5563;">Lead Time: ${po.leadTimeDays} business days</div>
    </div>
    <div class="box">
      <div class="box-title">Ship To / Destination Warehouse</div>
      <div style="font-size: 16px; font-weight: 700;">${po.warehouseName}</div>
      <div style="font-size: 13px; color: #4b5563; margin-top: 4px;">Expected Delivery: ${new Date(po.expectedDeliveryDate).toLocaleDateString()}</div>
      <div style="font-size: 13px; color: #4b5563;">Notes: ${po.notes || "Standard shipping"}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>Product Description</th>
        <th style="text-align: right;">Quantity</th>
        <th style="text-align: right;">Unit Cost</th>
        <th style="text-align: right;">Line Total</th>
      </tr>
    </thead>
    <tbody>
      ${po.items
        .map(
          (item) => `
        <tr>
          <td style="font-family: monospace; font-size: 13px; font-weight: 600;">${item.sku}</td>
          <td>${item.productName}</td>
          <td style="text-align: right; font-weight: 600;">${item.quantity.toLocaleString()}</td>
          <td style="text-align: right;">${formatRp(item.unitCost)}</td>
          <td style="text-align: right; font-weight: 700;">${formatRp(item.totalCost)}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>

  <div class="total-section">
    <div class="total-row">
      <span>Subtotal</span>
      <span>${formatRp(po.totalAmount)}</span>
    </div>
    <div class="total-row">
      <span>Taxes & Customs (0%)</span>
      <span>Rp 0</span>
    </div>
    <div class="total-row grand-total">
      <span>Total PO Capital</span>
      <span style="color: #4f46e5;">${formatRp(po.totalAmount)}</span>
    </div>
  </div>

  <div class="footer">
    <div>
      <div>Authorized by: Procurement Director</div>
      <div class="signature-line">Authorized Signatory</div>
    </div>
    <div>
      <div>Received by Warehouse Manager</div>
      <div class="signature-line">Receiving Signature & Stamp</div>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to render purchase order PDF" }, { status: 500 });
  }
}
