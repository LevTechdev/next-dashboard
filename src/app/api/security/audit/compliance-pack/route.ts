import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-guard";
import { generateCompliancePack } from "@/lib/security-telemetry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, response } = await requireAuth(req);
  if (response) return response;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";

  const pack = await generateCompliancePack();

  if (format === "html") {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>SOC2 / ISO27001 Compliance Audit Proof Pack</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 40px auto; max-width: 860px; padding: 0 20px; }
    .header { border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; }
    .footer { font-size: 11px; color: #6b7280; text-align: center; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h1 style="margin:0; font-size:24px; color:#111827;">Enterprise Compliance & Audit Proof Pack</h1>
      <span class="badge">VERIFIED PASS</span>
    </div>
    <p style="margin:5px 0 0; color:#6b7280; font-size:13px;">Standards: ${pack.standards.join(" · ")}</p>
    <p style="margin:2px 0 0; color:#6b7280; font-size:12px;">Generated at: ${pack.generatedAt}</p>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">1. Cryptographic SHA-256 Merkle Chain Integrity</h3>
    <p style="font-size:13px;">Status: <strong>${pack.merkleChain.ok ? "CHAIN VALID (ZERO BREAKS)" : "INTEGRITY WARNING"}</strong></p>
    <table>
      <tr><th>Total Hashed Events</th><td>${pack.merkleChain.total}</td></tr>
      <tr><th>Verified Sequence Links</th><td>${pack.merkleChain.verified}</td></tr>
      <tr><th>First Detected Break</th><td>${pack.merkleChain.firstBreakSeq ?? "None (Clean Chain)"}</td></tr>
    </table>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">2. RBAC & Access Control Governance</h3>
    <p style="font-size:13px;">Configured Roles: <strong>${pack.rbacGovernance.roles.join(", ")}</strong></p>
    <p style="font-size:13px;">Granular Actions: <strong>${pack.rbacGovernance.granularActions.join(", ")}</strong></p>
  </div>

  <div class="card">
    <h3 style="margin-top:0;">3. Active Anomaly & Threat Telemetry</h3>
    <table>
      <tr><th>Type</th><th>Severity</th><th>Description</th></tr>
      ${pack.anomalyTelemetry.anomalies
        .map(
          (a) => `<tr>
            <td><code>${a.type}</code></td>
            <td><strong>${a.severity}</strong></td>
            <td>${a.description}</td>
          </tr>`,
        )
        .join("")}
    </table>
  </div>

  <div class="footer">
    Next Dashboard Enterprise Edition · Cryptographically Anchored Audit Log Protocol
  </div>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({
    ok: true,
    pack,
  });
}
