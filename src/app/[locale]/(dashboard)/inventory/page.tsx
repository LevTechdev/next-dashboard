"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  RefreshCwIcon,
  SearchIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  LayersIcon,
  BoxIcon,
} from "lucide-animated";
import { Package, AlertTriangle, BarChart3 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { motion } from "framer-motion";
import { DataExportButton } from "@/components/data-export-button";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  costPrice: number;
  stock: number;
  category?: { name: string } | null;
  categoryId?: string | null;
}

interface InventoryData {
  products: Product[];
  categories: { id: string; name: string }[];
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  inStockCount: number;
}

// ─── Category Breakdown ─────────────────────────────────────────────────────

function CategoryBreakdown({
  products,
  categories,
}: {
  products: Product[];
  categories: { id: string; name: string }[];
}) {
  // Count products by category
  const catCounts: Record<string, number> = {};
  const catStock: Record<string, number> = {};

  categories.forEach((c) => {
    const prods = products.filter((p) => p.categoryId === c.id || p.category?.name === c.name);
    catCounts[c.name] = prods.length;
    catStock[c.name] = prods.reduce((sum, p) => sum + p.stock, 0);
  });

  // Uncategorized
  const uncategorized = products.filter((p) => !p.category && !p.categoryId);
  if (uncategorized.length > 0) {
    catCounts["Uncategorized"] = uncategorized.length;
    catStock["Uncategorized"] = uncategorized.reduce((sum, p) => sum + p.stock, 0);
  }

  const maxCount = Math.max(...Object.values(catCounts), 1);

  return (
    <div className="space-y-2.5">
      {Object.entries(catCounts).map(([name, count], i) => {
        const stock = catStock[name] || 0;
        return (
          <motion.div
            key={name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="flex items-center gap-3"
          >
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-28 truncate shrink-0">
              {name}
            </span>
            <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(count / maxCount) * 100}%` }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "h-full rounded-full",
                  name === "Uncategorized"
                    ? "bg-gray-400 dark:bg-gray-600"
                    : "bg-indigo-400 dark:bg-indigo-500",
                )}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-10 text-right">
              {count}
            </span>
            <span className="text-[10px] text-gray-400 w-16 text-right">{stock} units</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const tinventory = useTranslations("inventory");
  const tproducts = useTranslations("products");
  const tcommon = useTranslations("common");
  const [search, setSearch] = useState("");

  const { data, lastUpdated, isRefreshing, refresh } = useRealtimeData<InventoryData>(
    "/api/products?includeCategories=true&includeValue=true",
    {
      interval: 20000,
    },
  );

  const products = data?.products || [];
  const categories = data?.categories || [];
  const totalValue = data?.totalValue || 0;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock < 10).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const inStockCount = products.filter((p) => p.stock >= 10).length;

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()),
  );

  const getStockBadge = (stock: number) => {
    if (stock <= 0) return <Badge variant="danger">{tinventory("outOfStock")}</Badge>;
    if (stock < 10)
      return (
        <Badge variant="warning">
          {tinventory("lowStock")} ({stock})
        </Badge>
      );
    return (
      <Badge variant="success">
        {tinventory("inStock")} ({stock})
      </Badge>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {tinventory("title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tinventory("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} />
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
            className="gap-1"
          >
            <RefreshCwIcon
              size={14}
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
            <span className="hidden sm:inline">{tcommon("refresh")}</span>
          </Button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0, duration: 0.4 }}
        >
          <Card className="group hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 transition-transform group-hover:scale-110 duration-300">
                  <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="flex items-center gap-0.5 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                  <TrendingUpIcon size={12} className="h-3 w-3" />
                  In Stock
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                {tinventory("inStock")}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                <AnimatedCounter end={inStockCount} duration={1200} />
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
        >
          <Card className="group hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 transition-transform group-hover:scale-110 duration-300">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <span className="flex items-center gap-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-3 w-3" />
                  Needs Restock
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                {tinventory("lowStock")}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                <AnimatedCounter end={lowStockCount} duration={1200} />
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.4 }}
        >
          <Card className="group hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 transition-transform group-hover:scale-110 duration-300">
                  <BoxIcon size={20} className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <span className="flex items-center gap-0.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                  <TrendingDownIcon size={12} className="h-3 w-3" />
                  Out of Stock
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                {tinventory("outOfStock")}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                <AnimatedCounter end={outOfStockCount} duration={1200} />
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.4 }}
        >
          <Card className="group hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 transition-transform group-hover:scale-110 duration-300">
                  <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="flex items-center gap-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                  <BarChart3 className="h-3 w-3" />
                  Total Value
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">{tproducts("price")}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                <AnimatedCounter
                  end={totalValue}
                  duration={1600}
                  formatter={(v) => formatCurrency(v)}
                />
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Category Breakdown & Inventory Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <LayersIcon size={16} className="h-4 w-4 text-indigo-500" />
              <CardTitle className="text-base">{tcommon("filter")}</CardTitle>
            </div>
            <CardDescription>Products by category</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length > 0 || products.length > 0 ? (
              <CategoryBreakdown products={products} categories={categories} />
            ) : (
              <div className="text-center py-6 text-sm text-gray-400">
                <LayersIcon size={32} className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No categories found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inventory Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base">{tproducts("title")}</CardTitle>
              <div className="relative max-w-xs w-full">
                <SearchIcon
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                />
                <Input
                  placeholder={tcommon("search")}
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tinventory("product")}</TableHead>
                    <TableHead>{tproducts("sku") || "SKU"}</TableHead>
                    <TableHead>{tproducts("price") || "Price"}</TableHead>
                    <TableHead>{tinventory("currentStock")}</TableHead>
                    <TableHead>{tcommon("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p: Product) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-100 dark:border-gray-800 transition-all duration-200"
                    >
                      <TableCell className="py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {p.name}
                          </p>
                          {p.category?.name && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{p.category.name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 font-mono">
                        {p.sku || "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatCurrency(p.price)}
                      </TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums">
                        {p.stock}
                      </TableCell>
                      <TableCell>{getStockBadge(p.stock)}</TableCell>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                        <BoxIcon size={32} className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">{tproducts("noProducts")}</p>
                        <p className="text-xs mt-1">Try adjusting your search</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Footer summary */}
            {filtered.length > 0 && (
              <div className="flex items-center justify-between mt-4 px-2">
                <p className="text-xs text-gray-400">
                  Showing {filtered.length} of {products.length} products
                </p>
                <DataExportButton
                  columns={[
                    { key: "name", header: "Product" },
                    { key: (p: any) => p.sku || "—", header: "SKU" },
                    { key: (p: any) => p.price, header: "Price" },
                    { key: (p: any) => p.stock, header: "Stock" },
                    {
                      key: (p: any) =>
                        p.stock <= 0 ? "Out of Stock" : p.stock < 10 ? "Low Stock" : "In Stock",
                      header: "Status",
                    },
                    { key: (p: any) => p.category?.name || "", header: "Category" },
                    { key: (p: any) => p.costPrice, header: "Cost Price" },
                  ]}
                  data={filtered}
                  filename={`inventory-export-${new Date().toISOString().split("T")[0]}`}
                  label="Export"
                  variant="ghost"
                  size="sm"
                  showColumnSelector
                  totalCount={products.length}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
