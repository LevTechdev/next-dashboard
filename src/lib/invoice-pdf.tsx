import React from "react";
import { Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";
import { CURRENCIES, type SupportedCurrencyCode } from "@/lib/currency";

// Register a basic font (Helvetica is built-in)
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#333" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
    paddingBottom: 20,
    borderBottom: "1 solid #eaeaea",
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#111" },
  companyInfo: { textAlign: "right" },
  companyName: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  textMuted: { color: "#666", marginBottom: 2 },
  customerSection: { flexDirection: "row", justifyContent: "space-between", marginBottom: 40 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#111",
    textTransform: "uppercase",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1 solid #eaeaea",
    paddingBottom: 8,
    marginBottom: 8,
    fontWeight: "bold",
  },
  tableRow: { flexDirection: "row", paddingVertical: 8, borderBottom: "1 solid #fafafa" },
  col1: { width: "50%" },
  col2: { width: "15%", textAlign: "center" },
  col3: { width: "15%", textAlign: "right" },
  col4: { width: "20%", textAlign: "right" },
  summary: { marginTop: 20, flexDirection: "row", justifyContent: "flex-end" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "40%",
    marginBottom: 4,
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "40%",
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1 solid #111",
    fontWeight: "bold",
    fontSize: 12,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#888",
    fontSize: 8,
    borderTop: "1 solid #eaeaea",
    paddingTop: 10,
  },
});

/**
 * Money rendering for the PDF document, in the invoice's own currency.
 *
 * Deliberately mirrors the printable HTML invoice: values are converted to the
 * requested currency once, rounded to that currency's minor unit (IDR and JPY
 * have none), and then formatted with the currency's own symbol — so a rupiah
 * invoice never prints a decimal fraction or a dollar sign.
 */
const money = (currency: string) => {
  const code = (currency in CURRENCIES ? currency : "USD") as SupportedCurrencyCode;
  const cfg = CURRENCIES[code];
  const convert = (amountUsd: number) => {
    const converted = amountUsd * cfg.rate;
    return cfg.decimals === 0 ? Math.round(converted) : Number(converted.toFixed(cfg.decimals));
  };
  const format = (amountInCurrency: number) =>
    `${cfg.symbol}${amountInCurrency.toLocaleString("en-US", {
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    })}`;
  return { convert, format, cfg };
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

export function InvoiceDocument({
  order,
  company,
  currency,
}: {
  order: any;
  company: any;
  currency?: string;
}) {
  // Amounts render in the invoice/order's own currency when provided,
  // falling back to USD for legacy documents.
  const moneyCurrency: string = currency || order?.currency || "USD";
  const { convert, format, cfg } = money(moneyCurrency);
  const fmtMoney = (amountUsd: number) => format(convert(amountUsd));

  // The order's own figures are authoritative when present. Recomputing a
  // subtotal from the rows and inventing a flat 10% tax is what made this
  // document disagree with the order and with the printable invoice — the real
  // tax rate is the order's, and a discount or shipping line must survive.
  const itemsSum = (order.items ?? []).reduce(
    (sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0,
  );
  const storedSubtotal = Number(order.subtotal ?? order.totalAmount);
  const subtotal =
    Number.isFinite(storedSubtotal) && storedSubtotal > 0 ? storedSubtotal : itemsSum;
  const discount = Number(order.discountAmount ?? order.discount) || 0;
  const tax = Number(order.taxAmount ?? order.tax) || 0;
  const shipping = Number(order.shippingAmount ?? order.shipping) || 0;
  const storedTotal = Number(order.grandTotal);
  const total =
    Number.isFinite(storedTotal) && storedTotal > 0
      ? storedTotal
      : subtotal - discount + tax + shipping;
  const taxRatePercent = subtotal > 0 ? Math.round((tax / subtotal) * 1000) / 10 : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={[styles.textMuted, { marginTop: 4 }]}>#{order.orderNumber}</Text>
            <Text style={styles.textMuted}>Date: {formatDate(new Date(order.createdAt))}</Text>
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{company.name}</Text>
            <Text style={styles.textMuted}>{company.address}</Text>
            <Text style={styles.textMuted}>{company.email}</Text>
          </View>
        </View>

        <View style={styles.customerSection}>
          <View>
            <Text style={styles.sectionTitle}>Bill To:</Text>
            <Text style={{ fontWeight: "bold", marginBottom: 2 }}>
              {order.customer?.name || "Guest Customer"}
            </Text>
            <Text style={styles.textMuted}>{order.customer?.email || ""}</Text>
            <Text style={styles.textMuted}>{order.customer?.city || "No Address Provided"}</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={styles.sectionTitle}>Payment Status</Text>
            <Text
              style={{
                fontWeight: "bold",
                color: order.status === "DELIVERED" ? "#10b981" : "#f59e0b",
              }}
            >
              {order.status}
            </Text>
          </View>
        </View>

        <View>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Item Description</Text>
            <Text style={styles.col2}>Qty</Text>
            <Text style={styles.col3}>Price</Text>
            <Text style={styles.col4}>Amount</Text>
          </View>

          {order.items.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{item.product?.name || "Unknown Item"}</Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>{fmtMoney(item.price)}</Text>
              <Text style={styles.col4}>{fmtMoney(item.price * item.quantity)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <View style={{ width: "100%" }}>
            <View style={{ alignItems: "flex-end" }}>
              <View style={styles.summaryRow}>
                <Text style={styles.textMuted}>Subtotal:</Text>
                <Text>{fmtMoney(subtotal)}</Text>
              </View>
              {discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.textMuted}>Discount:</Text>
                  <Text>-{fmtMoney(discount)}</Text>
                </View>
              )}
              {shipping > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.textMuted}>Shipping:</Text>
                  <Text>{fmtMoney(shipping)}</Text>
                </View>
              )}
              {tax !== 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.textMuted}>
                    Tax{taxRatePercent > 0 ? ` (${taxRatePercent}%)` : ""}:
                  </Text>
                  <Text>{fmtMoney(tax)}</Text>
                </View>
              )}
              <View style={styles.summaryTotal}>
                <Text>Total Due:</Text>
                <Text>{fmtMoney(total)}</Text>
              </View>
              {cfg.code !== "USD" && (
                <Text style={[styles.textMuted, { marginTop: 6, textAlign: "right" }]}>
                  Converted at 1 USD = {cfg.symbol}
                  {cfg.rate.toLocaleString("en-US", { maximumFractionDigits: 2 })} and rounded to
                  the nearest {cfg.decimals === 0 ? "whole unit" : "cent"}.
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Thank you for your business.</Text>
          <Text style={{ marginTop: 2 }}>
            If you have any questions about this invoice, please contact {company.email}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
