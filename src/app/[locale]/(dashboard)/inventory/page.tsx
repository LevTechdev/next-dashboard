"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo } from "react";
import {
  RefreshCwIcon,
  SearchIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  LayersIcon,
  BoxIcon,
} from "lucide-animated";
import {
  Package,
  AlertTriangle,
  BarChart3,
  Truck,
  FileText,
  Warehouse,
  Plus,
  CheckCircle2,
  ExternalLink,
  Download,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building,
  Loader2,
  DollarSign,
} from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency-provider";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { motion } from "framer-motion";
import { DataExportButton } from "@/components/data-export-button";
import { toast } from "sonner";
import {
  ProductReplenishmentMetrics,
  PurchaseOrder,
  WarehouseAllocation,
  DEFAULT_WAREHOUSES,
  VERIFIED_SUPPLIERS,
} from "@/lib/inventory-replenishment";
import { LogisticsFleetTracker } from "@/components/inventory/logistics-fleet-tracker";

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

// â”€â”€â”€ Category Breakdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CategoryBreakdown({
  products,
  categories,
}: {
  products: Product[];
  categories: { id: string; name: string }[];
}) {
  const catCounts: Record<string, number> = {};
  const catStock: Record<string, number> = {};

  categories.forEach((c) => {
    const prods = products.filter((p) => p.categoryId === c.id || p.category?.name === c.name);
    catCounts[c.name] = prods.length;
    catStock[c.name] = prods.reduce((sum, p) => sum + p.stock, 0);
  });

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

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function InventoryPage() {
  const tinventory = useTranslations("inventory");
  const tproducts = useTranslations("products");
  const tcommon = useTranslations("common");
  const { formatMoney } = useCurrency();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("stock");

  // Realtime products
  const { data, lastUpdated, isRefreshing, refresh } = useRealtimeData<InventoryData>(
    "/api/products?includeCategories=true&includeValue=true",
    { interval: 20000 },
  );

  // Replenishment Data
  const [replenishmentData, setReplenishmentData] = useState<{
    items: ProductReplenishmentMetrics[];
    summary: any;
  } | null>(null);
  const [loadingReplenishment, setLoadingReplenishment] = useState(false);

  // Purchase Orders Data
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poSummary, setPoSummary] = useState<any>(null);
  const [loadingPOs, setLoadingPOs] = useState(false);

  // Warehouses Data
  const [warehouses, setWarehouses] = useState<WarehouseAllocation[]>(DEFAULT_WAREHOUSES);

  // Create PO Dialog
  const [createPoOpen, setCreatePoOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(VERIFIED_SUPPLIERS[0].id);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(DEFAULT_WAREHOUSES[0].id);
  const [poNotes, setPoNotes] = useState("");
  const [poLineItems, setPoLineItems] = useState<
    Array<{
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      unitCost: number;
    }>
  >([]);
  const [submittingPo, setSubmittingPo] = useState(false);

  const fetchReplenishment = async () => {
    try {
      setLoadingReplenishment(true);
      const res = await fetch("/api/inventory/replenishment");
      if (res.ok) {
        const d = await res.json();
        setReplenishmentData(d);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingReplenishment(false);
    }
  };

  const fetchPOs = async () => {
    try {
      setLoadingPOs(true);
      const res = await fetch("/api/inventory/purchase-orders");
      if (res.ok) {
        const d = await res.json();
        setPurchaseOrders(d.orders || []);
        setPoSummary(d.summary || null);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingPOs(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await fetch("/api/inventory/warehouses");
      if (res.ok) {
        const d = await res.json();
        if (d.warehouses) setWarehouses(d.warehouses);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchReplenishment();
    fetchPOs();
    fetchWarehouses();
  }, []);

  const products = data?.products || [];
  const categories = data?.categories || [];
  const totalValue = data?.totalValue || 0;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock < 10).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const inStockCount = products.filter((p) => p.stock >= 10).length;

  const filteredProducts = products.filter(
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

  // Open Create PO dialog pre-filled with a product
  const handleOrderProduct = (item: ProductReplenishmentMetrics) => {
    setSelectedSupplierId(item.supplier.id);
    setPoLineItems([
      {
        productId: item.productId,
        productName: item.name,
        sku: item.sku,
        quantity: Math.max(item.suggestedReorderQty, item.supplier.moq),
        unitCost: item.costPrice,
      },
    ]);
    setCreatePoOpen(true);
  };

  // Auto-fill all critical & warning replenishment recommendations
  const handleAutofillLowStock = () => {
    if (!replenishmentData) return;
    const needed = replenishmentData.items.filter((i) => i.reorderNeeded);
    if (needed.length === 0) {
      toast.info("All stock levels are currently healthy!");
      return;
    }
    const supplier =
      VERIFIED_SUPPLIERS.find((s) => s.id === selectedSupplierId) || VERIFIED_SUPPLIERS[0];
    const items = needed.map((i) => ({
      productId: i.productId,
      productName: i.name,
      sku: i.sku,
      quantity: Math.max(i.suggestedReorderQty, supplier.moq),
      unitCost: i.costPrice,
    }));
    setPoLineItems(items);
    toast.success(`Auto-populated ${items.length} recommended restock items!`);
  };

  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poLineItems.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }
    try {
      setSubmittingPo(true);
      const res = await fetch("/api/inventory/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          warehouseId: selectedWarehouseId,
          items: poLineItems,
          notes: poNotes,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        toast.success(tinventory("poCreatedSuccess", { poNumber: created.poNumber }));
        setCreatePoOpen(false);
        setPoLineItems([]);
        setPoNotes("");
        await fetchPOs();
        setActiveTab("purchaseOrders");
      } else {
        const err = await res.json();
        toast.error(err.error || tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setSubmittingPo(false);
    }
  };

  const handleMarkReceived = async (poId: string) => {
    try {
      const res = await fetch(`/api/inventory/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RECEIVED" }),
      });
      if (res.ok) {
        toast.success(tinventory("poMarkedReceived"));
        await fetchPOs();
        refresh(); // Refresh stock
        await fetchReplenishment();
      } else {
        toast.error(tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    }
  };

  const totalPoAmount = poLineItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Package className="h-7 w-7 text-indigo-600" />
            {tinventory("title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tinventory("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            onClick={() => {
              setPoLineItems([]);
              setCreatePoOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {tinventory("createPo")}
          </Button>
          <RealtimeIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              refresh();
              fetchReplenishment();
              fetchPOs();
            }}
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
        <Card className="group hover:shadow-md transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                <Package className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                {tinventory("healthyStock")}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">{tinventory("inStock")}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              <AnimatedCounter end={inStockCount} duration={1200} />
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full">
                {tinventory("warningRisk")}
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

        <Card className="group hover:shadow-md transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                <Truck className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                {purchaseOrders.filter((p) => p.status === "ISSUED").length} Active POs
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              {tinventory("openPoCapital")}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {formatMoney(poSummary?.totalIssued || 32750000)}
            </p>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                Valuation
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              {tinventory("totalValue")}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {formatMoney(totalValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-100 dark:bg-gray-800/80 p-1 border border-gray-200/50 dark:border-gray-700/50">
          <TabsTrigger value="stock" className="gap-1.5 text-xs font-semibold">
            <Package className="h-4 w-4" />
            {tinventory("tabStock")}
          </TabsTrigger>
          <TabsTrigger value="replenishment" className="gap-1.5 text-xs font-semibold">
            <Sparkles className="h-4 w-4 text-amber-500" />
            {tinventory("tabReplenishment")}
            {Boolean(
              replenishmentData?.summary?.reorderRequiredCount &&
              replenishmentData.summary.reorderRequiredCount > 0,
            ) && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                {replenishmentData?.summary?.reorderRequiredCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="purchaseOrders" className="gap-1.5 text-xs font-semibold">
            <FileText className="h-4 w-4 text-indigo-500" />
            {tinventory("tabPurchaseOrders")}
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px]">
              {purchaseOrders.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="gap-1.5 text-xs font-semibold">
            <Warehouse className="h-4 w-4 text-emerald-500" />
            {tinventory("tabWarehouses")}
          </TabsTrigger>
          <TabsTrigger value="logistics" className="gap-1.5 text-xs font-semibold">
            <Truck className="h-4 w-4 text-sky-500" />
            {tinventory("tabLogistics")}
          </TabsTrigger>
        </TabsList>

        {/* â”€â”€â”€ TAB 1: Stock Overview â”€â”€â”€ */}
        <TabsContent value="stock" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-bold">{tinventory("stockList")}</CardTitle>
                  <CardDescription className="text-xs">
                    {tinventory("stockListDesc")}
                  </CardDescription>
                </div>
                <DataExportButton
                  columns={[
                    { key: "SKU", header: "SKU" },
                    { key: "Name", header: "Product" },
                    { key: "Category", header: "Category" },
                    { key: "Price", header: "Price" },
                    { key: "CostPrice", header: "Cost" },
                    { key: "Stock", header: "Stock" },
                    { key: "Status", header: "Status" },
                  ]}
                  data={filteredProducts.map((p) => ({
                    SKU: p.sku || "",
                    Name: p.name,
                    Category: p.category?.name || "Uncategorized",
                    Price: p.price,
                    CostPrice: p.costPrice,
                    Stock: p.stock,
                    Status: p.stock <= 0 ? "Out of Stock" : p.stock < 10 ? "Low Stock" : "In Stock",
                  }))}
                  filename="inventory-stock-report"
                />
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={tinventory("searchPlaceholder")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 text-xs"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                        <TableHead className="text-xs">{tproducts("sku")}</TableHead>
                        <TableHead className="text-xs">{tproducts("name")}</TableHead>
                        <TableHead className="text-xs">{tproducts("category")}</TableHead>
                        <TableHead className="text-xs text-right">{tproducts("stock")}</TableHead>
                        <TableHead className="text-xs text-right">{tproducts("price")}</TableHead>
                        <TableHead className="text-xs">{tproducts("status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.slice(0, 12).map((prod) => (
                        <TableRow key={prod.id}>
                          <TableCell className="font-mono text-xs text-gray-500">
                            {prod.sku || "-"}
                          </TableCell>
                          <TableCell className="font-medium text-xs text-gray-900 dark:text-gray-100">
                            {prod.name}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {prod.category?.name || "Uncategorized"}
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold">
                            {prod.stock.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            {formatMoney(prod.price)}
                          </TableCell>
                          <TableCell>{getStockBadge(prod.stock)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold">{tinventory("categories")}</CardTitle>
                <CardDescription className="text-xs">
                  {tinventory("categoriesDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBreakdown products={products} categories={categories} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* â”€â”€â”€ TAB 2: Smart Replenishment â”€â”€â”€ */}
        <TabsContent value="replenishment" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  {tinventory("replenishmentTitle")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {tinventory("replenishmentSubtitle")}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutofillLowStock}
                className="text-xs font-semibold gap-1.5 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {tinventory("autofillLowStock")}
              </Button>
            </CardHeader>
            <CardContent>
              {loadingReplenishment ? (
                <div className="p-12 text-center text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  Computing sales velocities & days of inventory...
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                        <TableHead className="text-xs">SKU & Product</TableHead>
                        <TableHead className="text-xs text-right">Current Stock</TableHead>
                        <TableHead className="text-xs text-right">Sales Velocity</TableHead>
                        <TableHead className="text-xs text-right">Days Left (DOI)</TableHead>
                        <TableHead className="text-xs text-right">Reorder Point</TableHead>
                        <TableHead className="text-xs">Risk Level</TableHead>
                        <TableHead className="text-xs text-right">Suggested Qty</TableHead>
                        <TableHead className="text-xs">Supplier</TableHead>
                        <TableHead className="text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(replenishmentData?.items || []).map((item) => {
                        const isCritical = item.stockoutRisk === "CRITICAL";
                        const isWarning = item.stockoutRisk === "WARNING";
                        return (
                          <TableRow
                            key={item.productId}
                            className={cn(isCritical && "bg-red-50/30 dark:bg-red-950/20")}
                          >
                            <TableCell>
                              <div className="font-medium text-xs text-gray-900 dark:text-gray-100">
                                {item.name}
                              </div>
                              <div className="font-mono text-[10px] text-gray-400">{item.sku}</div>
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold">
                              {item.stock.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                              {item.salesVelocity} u/d
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono font-bold">
                              <span
                                className={cn(
                                  isCritical
                                    ? "text-red-600"
                                    : isWarning
                                      ? "text-amber-600"
                                      : "text-emerald-600",
                                )}
                              >
                                {item.daysOfInventory > 90 ? ">90d" : `${item.daysOfInventory}d`}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs text-gray-500">
                              {item.reorderPoint} u
                            </TableCell>
                            <TableCell>
                              {isCritical ? (
                                <Badge variant="danger" className="text-[10px] font-bold">
                                  CRITICAL
                                </Badge>
                              ) : isWarning ? (
                                <Badge variant="warning" className="text-[10px] font-bold">
                                  RESTOCK
                                </Badge>
                              ) : (
                                <Badge variant="success" className="text-[10px]">
                                  HEALTHY
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold text-gray-900 dark:text-gray-100">
                              {item.suggestedReorderQty > 0 ? (
                                <span className="text-indigo-600 dark:text-indigo-400">
                                  +{item.suggestedReorderQty.toLocaleString()}
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium truncate max-w-[130px]">
                                {item.supplier.name}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {item.supplier.leadTimeDays}d lead time
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={item.reorderNeeded ? "default" : "outline"}
                                onClick={() => handleOrderProduct(item)}
                                className={cn(
                                  "h-7 text-xs px-2.5 font-semibold gap-1",
                                  item.reorderNeeded
                                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                    : "text-gray-600",
                                )}
                              >
                                <Plus className="h-3 w-3" />
                                <span>PO</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* â”€â”€â”€ TAB 3: Purchase Orders â”€â”€â”€ */}
        <TabsContent value="purchaseOrders" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  {tinventory("purchaseOrdersTitle")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {tinventory("purchaseOrdersSubtitle")}
                </CardDescription>
              </div>
              <Button
                onClick={() => setCreatePoOpen(true)}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                {tinventory("newPurchaseOrder")}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                      <TableHead className="text-xs">PO Number</TableHead>
                      <TableHead className="text-xs">Supplier</TableHead>
                      <TableHead className="text-xs">Destination</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Items</TableHead>
                      <TableHead className="text-xs text-right">Total Capital</TableHead>
                      <TableHead className="text-xs">Expected</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((po) => {
                      const isReceived = po.status === "RECEIVED";
                      return (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            {po.poNumber}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-semibold">{po.supplierName}</div>
                            <div className="text-[10px] text-gray-400">{po.supplierEmail}</div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 dark:text-gray-300">
                            {po.warehouseName}
                          </TableCell>
                          <TableCell>
                            {po.status === "ISSUED" ? (
                              <Badge variant="warning" className="gap-1 text-[10px] font-bold">
                                <Clock className="h-3 w-3" />
                                ISSUED
                              </Badge>
                            ) : po.status === "RECEIVED" ? (
                              <Badge variant="success" className="gap-1 text-[10px] font-bold">
                                <CheckCircle2 className="h-3 w-3" />
                                RECEIVED
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                {po.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold">
                            {po.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()} u
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-gray-900 dark:text-gray-100">
                            {formatMoney(po.totalAmount)}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/api/inventory/purchase-orders/${po.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                              >
                                <Download className="h-3 w-3" />
                                <span>PDF</span>
                              </a>

                              {!isReceived && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMarkReceived(po.id)}
                                  className="h-7 text-xs px-2 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Receive
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* â”€â”€â”€ TAB 4: Multi-Warehouse Allocation â”€â”€â”€ */}
        <TabsContent value="warehouses" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {warehouses.map((wh) => (
              <Card key={wh.id} className="border-gray-200 dark:border-gray-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                      <Warehouse className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {wh.code}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold mt-2">{wh.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {wh.city}, {wh.country} â€¢ {wh.allocationPercent}% Network Share
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">Utilization</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {wh.utilizationRate}% ({wh.totalStockUnits.toLocaleString()} /{" "}
                        {wh.capacityUnits.toLocaleString()} u)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${wh.utilizationRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                      Channel Stock Allocation
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-gray-50 dark:bg-gray-900/50">
                        <span className="text-gray-500 block text-[10px]">Online Store</span>
                        <span className="font-bold">
                          {wh.channelDistribution.onlineStorePercent}%
                        </span>
                      </div>
                      <div className="p-2 rounded bg-gray-50 dark:bg-gray-900/50">
                        <span className="text-gray-500 block text-[10px]">TikTok Shop</span>
                        <span className="font-bold">
                          {wh.channelDistribution.tiktokShopPercent}%
                        </span>
                      </div>
                      <div className="p-2 rounded bg-gray-50 dark:bg-gray-900/50">
                        <span className="text-gray-500 block text-[10px]">Shopee SEA</span>
                        <span className="font-bold">{wh.channelDistribution.shopeePercent}%</span>
                      </div>
                      <div className="p-2 rounded bg-gray-50 dark:bg-gray-900/50">
                        <span className="text-gray-500 block text-[10px]">Retail POS</span>
                        <span className="font-bold">
                          {wh.channelDistribution.posRetailPercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* â”€â”€â”€ TAB 5: Logistics Fleet & Carrier Tracking â”€â”€â”€ */}
        <TabsContent value="logistics" className="space-y-6">
          <LogisticsFleetTracker />
        </TabsContent>
      </Tabs>

      {/* â”€â”€â”€ Create Purchase Order Dialog â”€â”€â”€ */}
      <Dialog open={createPoOpen} onOpenChange={setCreatePoOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreatePoSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                {tinventory("newPurchaseOrder")}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {tinventory("createPoDesc")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    {tinventory("supplier")}
                  </label>
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {VERIFIED_SUPPLIERS.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name} ({s.leadTimeDays}d lead)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    {tinventory("destinationWarehouse")}
                  </label>
                  <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select Warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_WAREHOUSES.map((w) => (
                        <SelectItem key={w.id} value={w.id} className="text-xs">
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items Table in PO */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    PO Line Items ({poLineItems.length})
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutofillLowStock}
                    className="h-7 text-[11px] gap-1 text-amber-600 border-amber-300"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Autofill Recommended
                  </Button>
                </div>

                {poLineItems.length === 0 ? (
                  <div className="p-6 border border-dashed rounded-lg text-center text-xs text-gray-400">
                    No items selected yet. Use &quot;Autofill Recommended&quot; or click
                    &quot;PO&quot; on a product.
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                          <TableHead className="text-[11px]">Product</TableHead>
                          <TableHead className="text-[11px] text-right">Quantity</TableHead>
                          <TableHead className="text-[11px] text-right">Unit Cost</TableHead>
                          <TableHead className="text-[11px] text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {poLineItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-medium">
                              {item.productName}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  const copy = [...poLineItems];
                                  copy[idx].quantity = val;
                                  setPoLineItems(copy);
                                }}
                                className="w-20 text-xs text-right h-7 ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {formatMoney(item.unitCost)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold">
                              {formatMoney(item.quantity * item.unitCost)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                  {tinventory("notes")}
                </label>
                <Input
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="e.g. Priority sea-freight shipment..."
                  className="text-xs"
                />
              </div>

              {/* Total Calculation */}
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  Total Purchase Order Capital:
                </span>
                <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                  {formatMoney(totalPoAmount)}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreatePoOpen(false)}>
                {tcommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={submittingPo || poLineItems.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                {submittingPo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {tinventory("issuePurchaseOrder")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

