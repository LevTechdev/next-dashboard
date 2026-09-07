"use client";

import React from "react";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useTranslations } from "next-intl";

interface ReportsExportMenuProps {
  orders: any[];
  stats: {
    totalRevenue: number;
    totalOrders: number;
    totalCustomers: number;
    avgOrderValue: number;
  };
}

export function ReportsExportMenu({ orders, stats }: ReportsExportMenuProps) {
  const t = useTranslations("reportsExport");

  const exportCSV = () => {
    try {
      const headers = ["Order Number", "Date", "Customer", "Channel", "Status", "Total Amount"];
      const rows = orders.map((o) => [
        o.orderNumber,
        new Date(o.createdAt).toISOString().split("T")[0],
        o.customer?.name || "Guest",
        o.channel?.name || "Direct",
        o.status,
        (o.grandTotal || 0).toFixed(2),
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `revenue-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(t("csvSuccess"));
    } catch (err) {
      toast.error(t("exportFailed"));
    }
  };

  const exportExcel = () => {
    try {
      const exportData = orders.map((o) => ({
        "Order #": o.orderNumber,
        Date: new Date(o.createdAt).toLocaleDateString(),
        Customer: o.customer?.name || "Guest",
        Email: o.customer?.email || "—",
        Channel: o.channel?.name || "Direct",
        Status: o.status,
        Subtotal: o.totalAmount || 0,
        Tax: o.taxAmount || 0,
        "Grand Total": o.grandTotal || 0,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Revenue Report");

      // Add Summary sheet
      const summaryData = [
        { Metric: "Total Gross Revenue", Value: stats.totalRevenue },
        { Metric: "Total Orders Count", Value: stats.totalOrders },
        { Metric: "Active Customers", Value: stats.totalCustomers },
        { Metric: "Average Order Value", Value: Number(stats.avgOrderValue.toFixed(2)) },
      ];
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Executive Summary");

      XLSX.writeFile(workbook, `executive-report-${Date.now()}.xlsx`);
      toast.success(t("excelSuccess"));
    } catch (err) {
      toast.error(t("exportFailed"));
    }
  };

  const printPDF = () => {
    window.print();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Download className="h-3.5 w-3.5" />
          {t("exportReport")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">{t("exportOptions")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportCSV} className="gap-2 text-xs cursor-pointer">
          <FileText className="h-4 w-4 text-emerald-500" />
          {t("exportCsv")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel} className="gap-2 text-xs cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-blue-500" />
          {t("exportExcel")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={printPDF} className="gap-2 text-xs cursor-pointer">
          <Printer className="h-4 w-4 text-purple-500" />
          {t("printPdf")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
