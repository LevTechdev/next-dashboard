import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

// Register a basic font (Helvetica is built-in)
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40, paddingBottom: 20, borderBottom: '1 solid #eaeaea' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  companyInfo: { textAlign: 'right' },
  companyName: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  textMuted: { color: '#666', marginBottom: 2 },
  customerSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#111', textTransform: 'uppercase' },
  tableHeader: { flexDirection: 'row', borderBottom: '1 solid #eaeaea', paddingBottom: 8, marginBottom: 8, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottom: '1 solid #fafafa' },
  col1: { width: '50%' },
  col2: { width: '15%', textAlign: 'center' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '20%', textAlign: 'right' },
  summary: { marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', width: '40%', marginBottom: 4 },
  summaryTotal: { flexDirection: 'row', justifyContent: 'space-between', width: '40%', marginTop: 8, paddingTop: 8, borderTop: '1 solid #111', fontWeight: 'bold', fontSize: 12 },
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, textAlign: 'center', color: '#888', fontSize: 8, borderTop: '1 solid #eaeaea', paddingTop: 10 }
});

const formatMoney = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
};

export function InvoiceDocument({ order, company }: { order: any, company: any }) {
  const subtotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.1; // Simulated 10% tax
  const total = subtotal + tax;

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
            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{order.customer?.name || 'Guest Customer'}</Text>
            <Text style={styles.textMuted}>{order.customer?.email || ''}</Text>
            <Text style={styles.textMuted}>{order.customer?.city || 'No Address Provided'}</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={styles.sectionTitle}>Payment Status</Text>
            <Text style={{ fontWeight: 'bold', color: order.status === 'DELIVERED' ? '#10b981' : '#f59e0b' }}>
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
              <Text style={styles.col1}>{item.product?.name || 'Unknown Item'}</Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>{formatMoney(item.price)}</Text>
              <Text style={styles.col4}>{formatMoney(item.price * item.quantity)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <View style={{ width: '100%' }}>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={styles.summaryRow}>
                <Text style={styles.textMuted}>Subtotal:</Text>
                <Text>{formatMoney(subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.textMuted}>Tax (10%):</Text>
                <Text>{formatMoney(tax)}</Text>
              </View>
              <View style={styles.summaryTotal}>
                <Text>Total Due:</Text>
                <Text>{formatMoney(total)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Thank you for your business.</Text>
          <Text style={{ marginTop: 2 }}>If you have any questions about this invoice, please contact {company.email}.</Text>
        </View>
      </Page>
    </Document>
  );
}
